use futures_util::StreamExt;
use serde_json::json;
use tauri::State;
use url::Url;

use crate::{
    dto::{AiEndpointDescriptor, AiEventChannel, AiExecuteRequest, AiStreamEvent, CredentialScope},
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    platform,
    security::endpoint_policy,
    state::AppState,
};

const MAX_AI_REQUEST_BYTES: usize = 16 * 1024 * 1024;
const MAX_AI_RESPONSE_BYTES: usize = 64 * 1024 * 1024;

fn endpoint_origin(endpoint: &AiEndpointDescriptor) -> RuntimeResult<String> {
    let base = endpoint_policy::resolve_base_url(endpoint)?;
    let url = Url::parse(&base).map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "AI 服务地址无法解析",
            "ai.endpoint",
        )
    })?;
    Ok(url.origin().ascii_serialization())
}

fn validate_credential_scope(scope: &CredentialScope, endpoint: &AiEndpointDescriptor) -> bool {
    match scope {
        CredentialScope::Ai {
            provider,
            profile_id,
            operation,
            configured_base_url,
        } => {
            let expected_operation = if endpoint.operation == "models" {
                "chat-completions"
            } else {
                endpoint.operation.as_str()
            };
            provider == &endpoint.provider
                && profile_id == &endpoint.profile_id
                && operation == expected_operation
                && endpoint_policy::normalize_base_url(configured_base_url).ok()
                    == endpoint_policy::normalize_base_url(&endpoint.configured_base_url).ok()
        }
        CredentialScope::GithubGist => false,
    }
}

#[tauri::command]
pub async fn runtime_ai_approve_endpoint(
    endpoint: AiEndpointDescriptor,
    state: State<'_, AppState>,
) -> RuntimeResult<Option<String>> {
    endpoint_policy::validate_network_destination(&endpoint)?;
    if !endpoint_policy::requires_explicit_approval(&endpoint)? {
        return Ok(None);
    }
    let origin = endpoint_origin(&endpoint)?;
    if let Some(approval) = state.approval_for_origin(&origin) {
        return Ok(Some(approval));
    }
    let prompt_origin = origin.clone();
    let approved = tauri::async_runtime::spawn_blocking(move || {
        platform::confirm_custom_endpoint(&prompt_origin)
    })
    .await
    .map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::Unknown,
            "AI 授权工作线程失败",
            "ai.endpoint.approve",
        )
    })?;
    if !approved {
        return Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "用户未授权自定义 AI 服务",
            "ai.endpoint.approve",
        ));
    }
    state.store_approval(origin).map(Some)
}

#[tauri::command]
pub async fn runtime_ai_execute(
    request: AiExecuteRequest,
    channel: AiEventChannel,
    state: State<'_, AppState>,
) -> RuntimeResult<()> {
    let request_id = request.request_id.clone();
    let token = state.register_cancellation(&request_id)?;
    let result = execute_inner(&request, &channel, &state, &token).await;
    state.finish_request(&request_id);

    if let Err(error) = result {
        let outcome = if matches!(error.code, RuntimeErrorCode::Aborted) {
            "aborted"
        } else {
            "failed"
        };
        state.record(json!({
            "kind": "network-attempt",
            "service": "ai",
            "operation": request.endpoint.operation,
            "outcome": outcome,
            "errorCode": error.code,
        }));
        let _ = channel.send(AiStreamEvent::Error {
            error: error.clone(),
        });
    }
    Ok(())
}

async fn execute_inner(
    request: &AiExecuteRequest,
    channel: &AiEventChannel,
    state: &AppState,
    token: &tokio_util::sync::CancellationToken,
) -> RuntimeResult<()> {
    endpoint_policy::validate_network_destination(&request.endpoint)?;
    if endpoint_policy::requires_explicit_approval(&request.endpoint)? {
        let origin = endpoint_origin(&request.endpoint)?;
        let approval = request.endpoint.approval_id.as_deref().ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::PermissionDenied,
                "自定义 AI 服务尚未授权",
                "ai.execute",
            )
        })?;
        if !state.approval_matches(&origin, approval) {
            return Err(RuntimeError::new(
                RuntimeErrorCode::PermissionDenied,
                "自定义 AI 服务授权已失效",
                "ai.execute",
            ));
        }
    }

    let body = serde_json::to_vec(&request.body).map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "AI 请求内容无法编码",
            "ai.execute",
        )
    })?;
    if body.len() > MAX_AI_REQUEST_BYTES {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "AI 请求内容过大",
            "ai.execute",
        ));
    }
    let url = endpoint_policy::request_url(&request.endpoint)?;
    let client = if endpoint_policy::is_loopback_endpoint(&request.endpoint)? {
        &state.loopback_client
    } else {
        &state.client
    };
    let mut builder = if request.endpoint.operation == "models" {
        client.get(url)
    } else {
        client
            .post(url)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body)
    };
    if let Some(credential_id) = request.credential_id.as_deref() {
        let credential = state.resolve_secret(credential_id)?;
        if !validate_credential_scope(&credential.descriptor.scope, &request.endpoint) {
            return Err(RuntimeError::new(
                RuntimeErrorCode::PermissionDenied,
                "AI 凭据与当前服务范围不匹配",
                "ai.execute",
            ));
        }
        builder = builder.bearer_auth(credential.value);
    }

    let _slot = tokio::select! {
        result = state.network_slots.acquire() => result.map_err(|_| RuntimeError::new(
            RuntimeErrorCode::Unavailable,
            "网络请求队列不可用",
            "ai.execute",
        ))?,
        _ = token.cancelled() => return Err(RuntimeError::new(
            RuntimeErrorCode::Aborted,
            "AI 请求已中止",
            "ai.execute",
        )),
    };
    let response = tokio::select! {
        response = builder.send() => response.map_err(|_| RuntimeError::new(
            RuntimeErrorCode::Network,
            "AI 网络请求失败",
            "ai.execute",
        ).retryable())?,
        _ = token.cancelled() => return Err(RuntimeError::new(
            RuntimeErrorCode::Aborted,
            "AI 请求已中止",
            "ai.execute",
        )),
    };
    let status = response.status();
    channel
        .send(AiStreamEvent::Started {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").to_string(),
        })
        .map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::Cancelled,
                "AI 响应接收端已关闭",
                "ai.execute",
            )
        })?;

    let mut received = 0usize;
    let mut stream = response.bytes_stream();
    loop {
        let next = tokio::select! {
            value = stream.next() => value,
            _ = token.cancelled() => return Err(RuntimeError::new(
                RuntimeErrorCode::Aborted,
                "AI 请求已中止",
                "ai.execute",
            )),
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.map_err(|_| {
            RuntimeError::new(RuntimeErrorCode::Network, "AI 响应流中断", "ai.execute").retryable()
        })?;
        received = received.saturating_add(chunk.len());
        if received > MAX_AI_RESPONSE_BYTES {
            return Err(RuntimeError::new(
                RuntimeErrorCode::RemoteError,
                "AI 响应超过桌面端安全上限",
                "ai.execute",
            ));
        }
        channel
            .send(AiStreamEvent::Chunk {
                bytes: chunk.to_vec(),
            })
            .map_err(|_| {
                RuntimeError::new(
                    RuntimeErrorCode::Cancelled,
                    "AI 响应接收端已关闭",
                    "ai.execute",
                )
            })?;
    }
    channel.send(AiStreamEvent::Done).map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::Cancelled,
            "AI 响应接收端已关闭",
            "ai.execute",
        )
    })?;
    state.record(json!({
        "kind": "network-attempt",
        "service": "ai",
        "operation": request.endpoint.operation,
        "outcome": "completed",
        "status": status.as_u16(),
        "responseBytes": received,
    }));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_credential_scope;
    use crate::dto::{AiEndpointDescriptor, CredentialScope};

    #[test]
    fn models_reuses_the_chat_completion_credential_scope() {
        let endpoint = AiEndpointDescriptor {
            provider: "custom".into(),
            profile_id: "preset-a".into(),
            operation: "models".into(),
            configured_base_url: "https://models.example.test/v1".into(),
            approval_id: None,
        };
        let scope = CredentialScope::Ai {
            provider: "custom".into(),
            profile_id: "preset-a".into(),
            operation: "chat-completions".into(),
            configured_base_url: "https://models.example.test/v1".into(),
        };

        assert!(validate_credential_scope(&scope, &endpoint));
    }
}

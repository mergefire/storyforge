use futures_util::StreamExt;
use reqwest::{header, Method, RequestBuilder};
use serde_json::{json, Map, Value};
use tauri::State;
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::{
    dto::{
        CredentialScope, GistBackupMeta, GistCredentialRequest, GistReadRequest, GistRevisionMeta,
        GistRevisionsRequest, GistWriteRequest,
    },
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    state::AppState,
};

const GIST_API: &str = "https://api.github.com/gists";
const MAX_GIST_RESPONSE_BYTES: usize = 128 * 1024 * 1024;
const MAX_GIST_WRITE_BYTES: usize = 128 * 1024 * 1024;

fn validate_credential(state: &AppState, credential_id: &str) -> RuntimeResult<String> {
    let credential = state.resolve_secret(credential_id)?;
    if credential.descriptor.scope != CredentialScope::GithubGist {
        return Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "凭据不属于 GitHub Gist 范围",
            "gist.credential",
        ));
    }
    Ok(credential.value)
}

fn validate_gist_id(value: &str, operation: &'static str) -> RuntimeResult<()> {
    if (16..=64).contains(&value.len()) && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "Gist 标识无效",
            operation,
        ))
    }
}

fn validate_revision(value: &str) -> RuntimeResult<()> {
    if value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "Gist 历史版本标识无效",
            "gist.readBackup",
        ))
    }
}

fn validate_filename(value: &str) -> RuntimeResult<()> {
    let valid = !value.is_empty()
        && value.len() <= 180
        && value.starts_with("storyforge-")
        && value.ends_with(".json")
        && !value.contains('/')
        && !value.contains('\\')
        && !value.contains("..");
    if valid {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "Gist 备份文件名无效",
            "gist.writeBackup",
        ))
    }
}

fn github_request(
    client: &reqwest::Client,
    method: Method,
    url: &str,
    token: &str,
) -> RequestBuilder {
    client
        .request(method, url)
        .header(header::ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .bearer_auth(token)
}

async fn bounded_response(
    response: reqwest::Response,
    token: &CancellationToken,
    operation: &'static str,
) -> RuntimeResult<(reqwest::StatusCode, Vec<u8>)> {
    let status = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > MAX_GIST_RESPONSE_BYTES as u64)
    {
        return Err(RuntimeError::new(
            RuntimeErrorCode::RemoteError,
            "GitHub 响应超过桌面端安全上限",
            operation,
        ));
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    loop {
        let next = tokio::select! {
            value = stream.next() => value,
            _ = token.cancelled() => return Err(RuntimeError::new(
                RuntimeErrorCode::Aborted,
                "Gist 请求已中止",
                operation,
            )),
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.map_err(|_| {
            RuntimeError::new(RuntimeErrorCode::Network, "GitHub 响应流中断", operation).retryable()
        })?;
        if bytes.len().saturating_add(chunk.len()) > MAX_GIST_RESPONSE_BYTES {
            return Err(RuntimeError::new(
                RuntimeErrorCode::RemoteError,
                "GitHub 响应超过桌面端安全上限",
                operation,
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok((status, bytes))
}

async fn send_json(
    builder: RequestBuilder,
    state: &AppState,
    token: &CancellationToken,
    operation: &'static str,
) -> RuntimeResult<(reqwest::StatusCode, Value)> {
    let _slot = tokio::select! {
        result = state.network_slots.acquire() => result.map_err(|_| RuntimeError::new(
            RuntimeErrorCode::Unavailable,
            "网络请求队列不可用",
            operation,
        ))?,
        _ = token.cancelled() => return Err(RuntimeError::new(RuntimeErrorCode::Aborted, "Gist 请求已中止", operation)),
    };
    let response = tokio::select! {
        result = builder.send() => result.map_err(|_| RuntimeError::new(
            RuntimeErrorCode::Network,
            "GitHub 网络请求失败",
            operation,
        ).retryable())?,
        _ = token.cancelled() => return Err(RuntimeError::new(RuntimeErrorCode::Aborted, "Gist 请求已中止", operation)),
    };
    let (status, bytes) = bounded_response(response, token, operation).await?;
    let payload = serde_json::from_slice(&bytes).map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::RemoteError,
            "GitHub 响应格式无效",
            operation,
        )
    })?;
    if !status.is_success() {
        let code = if matches!(status.as_u16(), 401 | 403) {
            RuntimeErrorCode::PermissionDenied
        } else {
            RuntimeErrorCode::RemoteError
        };
        let error = RuntimeError::new(code, "GitHub Gist 请求失败", operation);
        return Err(if status.as_u16() == 429 || status.is_server_error() {
            error.retryable()
        } else {
            error
        });
    }
    Ok((status, payload))
}

fn start_request(state: &AppState, request_id: &str) -> RuntimeResult<CancellationToken> {
    state.register_cancellation(request_id)
}

#[tauri::command]
pub async fn runtime_gist_validate(
    request: GistCredentialRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<Value> {
    let token = start_request(&state, &request.request_id)?;
    let result = async {
        let secret = validate_credential(&state, &request.credential_id)?;
        let (_, payload) = send_json(
            github_request(
                &state.client,
                Method::GET,
                "https://api.github.com/user",
                &secret,
            ),
            &state,
            &token,
            "gist.validateCredential",
        )
        .await?;
        let login = payload
            .get("login")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                RuntimeError::new(
                    RuntimeErrorCode::RemoteError,
                    "GitHub 响应缺少登录名",
                    "gist.validateCredential",
                )
            })?;
        Ok(json!({ "login": login }))
    }
    .await;
    state.finish_request(&request.request_id);
    result
}

#[tauri::command]
pub async fn runtime_gist_write(
    request: GistWriteRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<Value> {
    validate_filename(&request.filename)?;
    if request.content.len() > MAX_GIST_WRITE_BYTES || request.description.len() > 512 {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "Gist 备份内容过大",
            "gist.writeBackup",
        ));
    }
    if let Some(gist_id) = request.gist_id.as_deref() {
        validate_gist_id(gist_id, "gist.writeBackup")?;
    }
    let token = start_request(&state, &request.request_id)?;
    let result = async {
        let secret = validate_credential(&state, &request.credential_id)?;
        let url = request
            .gist_id
            .as_ref()
            .map(|id| format!("{GIST_API}/{id}"))
            .unwrap_or_else(|| GIST_API.to_string());
        let method = if request.gist_id.is_some() {
            Method::PATCH
        } else {
            Method::POST
        };
        let mut files = Map::new();
        files.insert(
            request.filename.clone(),
            json!({ "content": request.content }),
        );
        let payload = json!({
            "description": request.description,
            "public": false,
            "files": files,
        });
        let (_, response) = send_json(
            github_request(&state.client, method, &url, &secret).json(&payload),
            &state,
            &token,
            "gist.writeBackup",
        )
        .await?;
        let id = response.get("id").and_then(Value::as_str).ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::RemoteError,
                "GitHub 响应缺少 Gist 标识",
                "gist.writeBackup",
            )
        })?;
        let url = response
            .get("html_url")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                RuntimeError::new(
                    RuntimeErrorCode::RemoteError,
                    "GitHub 响应缺少 Gist 地址",
                    "gist.writeBackup",
                )
            })?;
        Ok(json!({ "gistId": id, "url": url }))
    }
    .await;
    state.finish_request(&request.request_id);
    result
}

fn backup_file(files: &Map<String, Value>) -> Option<(&str, &Value)> {
    files.iter().find_map(|(name, value)| {
        (name.starts_with("storyforge-") && name.ends_with(".json"))
            .then_some((name.as_str(), value))
    })
}

#[tauri::command]
pub async fn runtime_gist_list(
    request: GistCredentialRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<Vec<GistBackupMeta>> {
    let token = start_request(&state, &request.request_id)?;
    let result = async {
        let secret = validate_credential(&state, &request.credential_id)?;
        let (_, payload) = send_json(
            github_request(
                &state.client,
                Method::GET,
                &format!("{GIST_API}?per_page=100"),
                &secret,
            ),
            &state,
            &token,
            "gist.listBackups",
        )
        .await?;
        let items = payload.as_array().ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::RemoteError,
                "GitHub Gist 列表格式无效",
                "gist.listBackups",
            )
        })?;
        let mut backups = Vec::new();
        for item in items {
            let Some(record) = item.as_object() else {
                continue;
            };
            let Some(files) = record.get("files").and_then(Value::as_object) else {
                continue;
            };
            let Some((filename, _)) = backup_file(files) else {
                continue;
            };
            let (Some(gist_id), Some(updated_at)) = (
                record.get("id").and_then(Value::as_str),
                record.get("updated_at").and_then(Value::as_str),
            ) else {
                continue;
            };
            backups.push(GistBackupMeta {
                gist_id: gist_id.to_string(),
                filename: filename.to_string(),
                description: record
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                updated_at: updated_at.to_string(),
            });
        }
        Ok(backups)
    }
    .await;
    state.finish_request(&request.request_id);
    result
}

#[tauri::command]
pub async fn runtime_gist_read(
    request: GistReadRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<Value> {
    validate_gist_id(&request.gist_id, "gist.readBackup")?;
    if let Some(revision) = request.revision.as_deref() {
        validate_revision(revision)?;
    }
    let token = start_request(&state, &request.request_id)?;
    let result = async {
        let secret = validate_credential(&state, &request.credential_id)?;
        let url = request
            .revision
            .as_ref()
            .map(|revision| format!("{GIST_API}/{}/{}", request.gist_id, revision))
            .unwrap_or_else(|| format!("{GIST_API}/{}", request.gist_id));
        let (_, payload) = send_json(
            github_request(&state.client, Method::GET, &url, &secret),
            &state,
            &token,
            "gist.readBackup",
        )
        .await?;
        let files = payload
            .get("files")
            .and_then(Value::as_object)
            .ok_or_else(|| {
                RuntimeError::new(
                    RuntimeErrorCode::RemoteError,
                    "Gist 响应缺少备份文件",
                    "gist.readBackup",
                )
            })?;
        let (filename, file) = backup_file(files).ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::NotFound,
                "Gist 中没有 StoryForge 备份",
                "gist.readBackup",
            )
        })?;
        let content = if let Some(content) = file.get("content").and_then(Value::as_str) {
            content.to_string()
        } else {
            let raw_url = file.get("raw_url").and_then(Value::as_str).ok_or_else(|| {
                RuntimeError::new(
                    RuntimeErrorCode::RemoteError,
                    "Gist 备份内容不可用",
                    "gist.readBackup",
                )
            })?;
            let parsed = Url::parse(raw_url).map_err(|_| {
                RuntimeError::new(
                    RuntimeErrorCode::RemoteError,
                    "Gist 原始内容地址无效",
                    "gist.readBackup",
                )
            })?;
            if parsed.scheme() != "https" || parsed.host_str() != Some("gist.githubusercontent.com")
            {
                return Err(RuntimeError::new(
                    RuntimeErrorCode::PermissionDenied,
                    "Gist 原始内容地址不在允许范围内",
                    "gist.readBackup",
                ));
            }
            let _slot = tokio::select! {
                result = state.network_slots.acquire() => result.map_err(|_| RuntimeError::new(
                    RuntimeErrorCode::Unavailable,
                    "网络请求队列不可用",
                    "gist.readBackup",
                ))?,
                _ = token.cancelled() => return Err(RuntimeError::new(
                    RuntimeErrorCode::Aborted,
                    "Gist 请求已中止",
                    "gist.readBackup",
                )),
            };
            let response = tokio::select! {
                result = state.client.get(parsed).send() => result.map_err(|_| RuntimeError::new(
                    RuntimeErrorCode::Network,
                    "Gist 原始内容请求失败",
                    "gist.readBackup",
                ).retryable())?,
                _ = token.cancelled() => return Err(RuntimeError::new(
                    RuntimeErrorCode::Aborted,
                    "Gist 请求已中止",
                    "gist.readBackup",
                )),
            };
            let (status, bytes) = bounded_response(response, &token, "gist.readBackup").await?;
            if !status.is_success() {
                return Err(RuntimeError::new(
                    RuntimeErrorCode::RemoteError,
                    "Gist 原始内容请求失败",
                    "gist.readBackup",
                ));
            }
            String::from_utf8(bytes).map_err(|_| {
                RuntimeError::new(
                    RuntimeErrorCode::IntegrityError,
                    "Gist 备份不是有效 UTF-8",
                    "gist.readBackup",
                )
            })?
        };
        Ok(json!({ "filename": filename, "content": content }))
    }
    .await;
    state.finish_request(&request.request_id);
    result
}

#[tauri::command]
pub async fn runtime_gist_revisions(
    request: GistRevisionsRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<Vec<GistRevisionMeta>> {
    validate_gist_id(&request.gist_id, "gist.listRevisions")?;
    let token = start_request(&state, &request.request_id)?;
    let result = async {
        let secret = validate_credential(&state, &request.credential_id)?;
        let (_, payload) = send_json(
            github_request(
                &state.client,
                Method::GET,
                &format!("{GIST_API}/{}/commits", request.gist_id),
                &secret,
            ),
            &state,
            &token,
            "gist.listRevisions",
        )
        .await?;
        let items = payload.as_array().ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::RemoteError,
                "Gist 历史版本格式无效",
                "gist.listRevisions",
            )
        })?;
        Ok(items
            .iter()
            .filter_map(|item| {
                let version = item.get("version")?.as_str()?.to_string();
                let committed_at = item.get("committed_at")?.as_str()?.to_string();
                let changes = item.get("change_status");
                Some(GistRevisionMeta {
                    version,
                    committed_at,
                    additions: changes
                        .and_then(|value| value.get("additions"))
                        .and_then(Value::as_u64),
                    deletions: changes
                        .and_then(|value| value.get("deletions"))
                        .and_then(Value::as_u64),
                })
            })
            .collect())
    }
    .await;
    state.finish_request(&request.request_id);
    result
}

use crate::{
    dto::AiEndpointDescriptor,
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
};
use std::{
    collections::HashMap,
    net::{IpAddr, ToSocketAddrs},
};
use url::Url;

const MAX_BASE_URL_LENGTH: usize = 2048;

fn provider_bases() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("deepseek", "https://api.deepseek.com/v1"),
        ("qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        ("doubao", "https://ark.cn-beijing.volces.com/api/v3"),
        ("minimax", "https://api.minimax.chat/v1"),
        ("glm", "https://open.bigmodel.cn/api/paas/v4"),
        ("wenxin", "https://qianfan.baidubce.com/v2"),
        (
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta/openai",
        ),
        ("poe", "https://api.poe.com/v1"),
        ("openai", "https://api.openai.com/v1"),
        ("kimi", "https://api.moonshot.cn/v1"),
        ("claude", "https://api.anthropic.com/v1"),
        ("nvidia", "https://integrate.api.nvidia.com/v1"),
        ("modelscope", "https://api-inference.modelscope.cn/v1"),
        ("agnes", "https://apihub.agnes-ai.com/v1"),
        ("longcat", "https://api.longcat.chat/openai/v1"),
        ("ollama", "http://localhost:11434/v1"),
    ])
}

fn proxy_bases() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("/deepseek-proxy/v1", "https://api.deepseek.com/v1"),
        ("/openai-proxy/v1", "https://api.openai.com/v1"),
        ("/kimi-proxy/v1", "https://api.moonshot.cn/v1"),
        ("/claude-proxy/v1", "https://api.anthropic.com/v1"),
        ("/nvidia-proxy/v1", "https://integrate.api.nvidia.com/v1"),
        (
            "/doubao-proxy/api/v3",
            "https://ark.cn-beijing.volces.com/api/v3",
        ),
        ("/agnes-proxy/v1", "https://apihub.agnes-ai.com/v1"),
        (
            "/longcat-proxy/openai/v1",
            "https://api.longcat.chat/openai/v1",
        ),
        ("/siliconflow-proxy/v1", "https://api.siliconflow.cn/v1"),
        (
            "/qwen-proxy/compatible-mode/v1",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
        ),
        (
            "/glm-proxy/api/paas/v4",
            "https://open.bigmodel.cn/api/paas/v4",
        ),
    ])
}

fn invalid_input(message: &'static str) -> RuntimeError {
    RuntimeError::new(RuntimeErrorCode::InvalidInput, message, "ai.endpoint")
}

pub fn normalize_base_url(raw: &str) -> RuntimeResult<String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed.len() > MAX_BASE_URL_LENGTH {
        return Err(invalid_input("AI 服务地址无效"));
    }
    if trimmed.chars().any(|value| value.is_control()) || trimmed.contains('@') {
        return Err(invalid_input("AI 服务地址包含不安全内容"));
    }
    let suffixes = [
        "/chat/completions",
        "/completions",
        "/models",
        "/embeddings",
    ];
    let mut normalized = trimmed.to_string();
    for suffix in suffixes {
        if normalized.to_ascii_lowercase().ends_with(suffix) {
            normalized.truncate(normalized.len() - suffix.len());
            normalized = normalized.trim_end_matches('/').to_string();
            break;
        }
    }
    while normalized.to_ascii_lowercase().ends_with("/v1/v1") {
        normalized.truncate(normalized.len() - 3);
    }
    Ok(normalized)
}

pub fn resolve_base_url(endpoint: &AiEndpointDescriptor) -> RuntimeResult<String> {
    let normalized = normalize_base_url(&endpoint.configured_base_url)?;
    if normalized.starts_with('/') {
        return proxy_bases()
            .get(normalized.as_str())
            .map(|value| (*value).to_string())
            .ok_or_else(|| invalid_input("桌面端不支持未知的开发代理别名"));
    }
    Ok(normalized)
}

pub fn operation_path(operation: &str) -> RuntimeResult<&'static str> {
    match operation {
        "chat-completions" => Ok("chat/completions"),
        "embeddings" => Ok("embeddings"),
        _ => Err(invalid_input("AI 操作类型无效")),
    }
}

pub fn request_url(endpoint: &AiEndpointDescriptor) -> RuntimeResult<Url> {
    let base = resolve_base_url(endpoint)?;
    let parsed = Url::parse(&base).map_err(|_| invalid_input("AI 服务地址无法解析"))?;
    if parsed.username() != ""
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(invalid_input("AI 服务地址不能包含账号、查询参数或片段"));
    }
    let joined = format!(
        "{}/{}",
        base.trim_end_matches('/'),
        operation_path(&endpoint.operation)?
    );
    Url::parse(&joined).map_err(|_| invalid_input("AI 请求地址无法解析"))
}

fn is_disallowed_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_link_local()
                || ip.is_multicast()
                || ip.is_broadcast()
                || ip.is_unspecified()
                || ip.octets()[0] == 0
                || ip.octets()[0] >= 224
        }
        IpAddr::V6(ip) => {
            let first = ip.segments()[0];
            ip.is_multicast()
                || ip.is_unspecified()
                || first & 0xfe00 == 0xfc00
                || first & 0xffc0 == 0xfe80
        }
    }
}

fn is_loopback_host(url: &Url) -> bool {
    match url.host_str().map(|value| value.to_ascii_lowercase()) {
        Some(host) if host == "localhost" => true,
        Some(host) => host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback()),
        None => false,
    }
}

pub fn is_loopback_endpoint(endpoint: &AiEndpointDescriptor) -> RuntimeResult<bool> {
    let base = resolve_base_url(endpoint)?;
    let url = Url::parse(&base).map_err(|_| invalid_input("AI 服务地址无法解析"))?;
    Ok(is_loopback_host(&url))
}

pub fn is_builtin_endpoint(endpoint: &AiEndpointDescriptor, base_url: &str) -> bool {
    provider_bases()
        .get(endpoint.provider.as_str())
        .is_some_and(|expected| normalize_base_url(expected).ok().as_deref() == Some(base_url))
}

pub fn requires_explicit_approval(endpoint: &AiEndpointDescriptor) -> RuntimeResult<bool> {
    let base = resolve_base_url(endpoint)?;
    let url = Url::parse(&base).map_err(|_| invalid_input("AI 服务地址无法解析"))?;
    match url.scheme() {
        "https" if is_builtin_endpoint(endpoint, &base) => Ok(false),
        "https" => Ok(true),
        "http" if is_loopback_host(&url) => Ok(false),
        _ => Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "桌面端只允许 HTTPS 或明确的本机模型地址",
            "ai.endpoint",
        )),
    }
}

pub fn validate_network_destination(endpoint: &AiEndpointDescriptor) -> RuntimeResult<()> {
    let base = resolve_base_url(endpoint)?;
    let url = Url::parse(&base).map_err(|_| invalid_input("AI 服务地址无法解析"))?;
    if url.scheme() == "http" && is_loopback_host(&url) {
        return Ok(());
    }
    if url.scheme() != "https" {
        return Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "桌面端拒绝不安全的远程 AI 地址",
            "ai.endpoint",
        ));
    }
    if let Some(host) = url.host_str() {
        if let Ok(ip) = host.parse::<IpAddr>() {
            if is_disallowed_ip(ip) || ip.is_loopback() {
                return Err(RuntimeError::new(
                    RuntimeErrorCode::PermissionDenied,
                    "桌面端拒绝私网、链路本地或组播 AI 地址",
                    "ai.endpoint",
                ));
            }
        } else if let Some(port) = url.port_or_known_default() {
            if let Ok(addresses) = (host, port).to_socket_addrs() {
                if addresses.into_iter().any(|address| {
                    let ip = address.ip();
                    is_disallowed_ip(ip) || ip.is_loopback()
                }) {
                    return Err(RuntimeError::new(
                        RuntimeErrorCode::PermissionDenied,
                        "AI 域名解析到了受保护网络地址",
                        "ai.endpoint",
                    ));
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn endpoint(provider: &str, base: &str) -> AiEndpointDescriptor {
        AiEndpointDescriptor {
            provider: provider.into(),
            profile_id: "primary".into(),
            operation: "chat-completions".into(),
            configured_base_url: base.into(),
            approval_id: None,
        }
    }

    #[test]
    fn maps_known_web_proxy_aliases_to_exact_origins() {
        assert_eq!(
            resolve_base_url(&endpoint("deepseek", "/deepseek-proxy/v1")).unwrap(),
            "https://api.deepseek.com/v1"
        );
        assert!(resolve_base_url(&endpoint("custom", "/attacker-proxy/v1")).is_err());
    }

    #[test]
    fn allows_builtin_https_and_loopback_but_requires_custom_https_approval() {
        assert!(
            !requires_explicit_approval(&endpoint("openai", "https://api.openai.com/v1")).unwrap()
        );
        assert!(
            !requires_explicit_approval(&endpoint("ollama", "http://localhost:11434/v1")).unwrap()
        );
        assert!(is_loopback_endpoint(&endpoint("custom", "http://127.0.0.1:43123/v1")).unwrap());
        assert!(
            requires_explicit_approval(&endpoint("custom", "https://models.example.test/v1"))
                .unwrap()
        );
        assert!(
            requires_explicit_approval(&endpoint("custom", "http://192.168.1.7:8080/v1")).is_err()
        );
    }

    #[test]
    fn rejects_userinfo_and_dangerous_ip_ranges() {
        assert!(request_url(&endpoint("custom", "https://user@example.test/v1")).is_err());
        assert!(
            validate_network_destination(&endpoint("custom", "https://169.254.169.254/v1"))
                .is_err()
        );
        assert!(validate_network_destination(&endpoint("custom", "https://127.0.0.1/v1")).is_err());
    }
}

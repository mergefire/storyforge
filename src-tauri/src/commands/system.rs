use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::{
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    platform,
    state::AppState,
};

const MAX_CLIPBOARD_BYTES: usize = 2 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DurabilityStatus {
    persisted: bool,
}

#[tauri::command]
pub fn runtime_cancel_request(request_id: String, state: State<'_, AppState>) -> bool {
    state.cancel(&request_id)
}

#[tauri::command]
pub async fn runtime_clipboard_write(purpose: String, text: String) -> RuntimeResult<()> {
    if !matches!(
        purpose.as_str(),
        "ai-image-prompt" | "workflow-output" | "chapter-ai-output"
    ) || text.len() > MAX_CLIPBOARD_BYTES
    {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "剪贴板写入请求无效",
            "clipboard.writeText",
        ));
    }
    tauri::async_runtime::spawn_blocking(move || platform::write_clipboard_text(&text))
        .await
        .map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::Unknown,
                "剪贴板工作线程失败",
                "clipboard.writeText",
            )
        })?
}

#[tauri::command]
pub async fn runtime_external_open(destination: String) -> RuntimeResult<()> {
    let url = match destination.as_str() {
        "github-gist-token" => {
            "https://github.com/settings/tokens/new?scopes=gist&description=StoryForge"
        }
        "project-repository" => "https://github.com/yuanbw2025/storyforge",
        _ => {
            return Err(RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "外部链接目标无效",
                "external.open",
            ))
        }
    };
    tauri::async_runtime::spawn_blocking(move || platform::open_external(url))
        .await
        .map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::Unknown,
                "外部链接工作线程失败",
                "external.open",
            )
        })?
}

#[tauri::command]
pub fn runtime_durability_status() -> DurabilityStatus {
    DurabilityStatus { persisted: true }
}

#[tauri::command]
pub fn runtime_diagnostics_snapshot(state: State<'_, AppState>) -> Vec<Value> {
    state.diagnostics_snapshot()
}

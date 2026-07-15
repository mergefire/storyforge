use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEndpointDescriptor {
    pub provider: String,
    pub profile_id: String,
    pub operation: String,
    pub configured_base_url: String,
    pub approval_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExecuteRequest {
    pub request_id: String,
    pub endpoint: AiEndpointDescriptor,
    pub credential_id: Option<String>,
    pub body: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum AiStreamEvent {
    Started { status: u16, status_text: String },
    Chunk { bytes: Vec<u8> },
    Done,
    Error { error: crate::error::RuntimeError },
}

pub type AiEventChannel = Channel<AiStreamEvent>;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum CredentialScope {
    Ai {
        provider: String,
        #[serde(rename = "profileId")]
        profile_id: String,
        operation: String,
        #[serde(rename = "configuredBaseUrl")]
        configured_base_url: String,
    },
    GithubGist,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretDescriptor {
    pub key: String,
    pub persistence: String,
    pub scope: CredentialScope,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretPutRequest {
    pub descriptor: SecretDescriptor,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistWriteRequest {
    pub request_id: String,
    pub credential_id: String,
    pub gist_id: Option<String>,
    pub filename: String,
    pub description: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistCredentialRequest {
    pub request_id: String,
    pub credential_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistReadRequest {
    pub request_id: String,
    pub credential_id: String,
    pub gist_id: String,
    pub revision: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistRevisionsRequest {
    pub request_id: String,
    pub credential_id: String,
    pub gist_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistBackupMeta {
    pub gist_id: String,
    pub filename: String,
    pub description: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistRevisionMeta {
    pub version: String,
    pub committed_at: String,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupBinding {
    pub binding_id: String,
    pub label: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum NativeOutcome<T> {
    Completed { value: T },
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedFile {
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFile {
    pub name: String,
    pub media_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub name: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteSessionStarted {
    pub session_id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub name: String,
}

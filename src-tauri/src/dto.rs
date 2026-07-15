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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MigrationJournalPhase {
    AwaitingChoice,
    ArchiveReceived,
    ArchiveVerified,
    Importing,
    DataVerified,
    Activated,
    Failed,
    RolledBack,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationJournal {
    pub phase: MigrationJournalPhase,
    pub export_id: Option<String>,
    pub archive_sha256: Option<String>,
    pub updated_at: String,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationWriteJournalRequest {
    pub journal: MigrationJournal,
    pub expected_phase: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationTableResult {
    pub name: String,
    pub expected_count: u64,
    pub actual_count: u64,
    pub expected_sha256: String,
    pub actual_sha256: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationBlobResult {
    pub table: String,
    pub primary_key: Value,
    pub field: String,
    pub expected_size: u64,
    pub actual_size: i64,
    pub expected_sha256: String,
    pub actual_sha256: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationReceipt {
    pub export_id: String,
    pub archive_sha256: String,
    pub source_app_version: String,
    pub source_schema_version: u64,
    pub target_app_version: String,
    pub imported_at: String,
    pub table_results: Vec<MigrationTableResult>,
    pub blob_results: Vec<MigrationBlobResult>,
    pub rebuild_queue: Vec<String>,
    pub reauthorization: Vec<String>,
    pub integrity_errors: Vec<String>,
    pub status: String,
}

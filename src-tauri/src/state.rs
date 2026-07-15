use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
    dto::{CredentialScope, SecretDescriptor},
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    platform,
};

const METADATA_FILE: &str = "runtime-metadata.json";
const MAX_DIAGNOSTIC_EVENTS: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSecretMetadata {
    pub descriptor: SecretDescriptor,
    pub credential_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBinding {
    pub directory: PathBuf,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeMetadata {
    #[serde(default)]
    pub device_secrets: HashMap<String, StoredSecretMetadata>,
    #[serde(default)]
    pub backup_bindings: HashMap<String, StoredBinding>,
    #[serde(default)]
    pub endpoint_approvals: HashMap<String, String>,
}

#[derive(Debug, Clone)]
struct SessionSecret {
    descriptor: SecretDescriptor,
    credential_id: String,
    value: String,
}

#[derive(Debug, Clone)]
pub struct ResolvedSecret {
    pub descriptor: SecretDescriptor,
    pub value: String,
}

pub struct WriteSession {
    pub file: File,
    pub temporary_path: PathBuf,
    pub final_path: PathBuf,
    pub display_name: String,
    pub bytes_written: usize,
    pub max_bytes: usize,
}

pub struct AppState {
    pub client: reqwest::Client,
    pub loopback_client: reqwest::Client,
    pub network_slots: Semaphore,
    pub cancellations: Mutex<HashMap<String, CancellationToken>>,
    pub writes: Mutex<HashMap<String, WriteSession>>,
    pub diagnostics: Mutex<Vec<Value>>,
    pub migration_io: Mutex<()>,
    metadata_path: PathBuf,
    app_data_dir: PathBuf,
    metadata: Mutex<RuntimeMetadata>,
    session_secrets: Mutex<HashMap<String, SessionSecret>>,
}

fn read_metadata(path: &Path) -> RuntimeMetadata {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

impl AppState {
    pub fn new(app: &AppHandle) -> RuntimeResult<Self> {
        let app_data = app.path().app_data_dir().map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::Unavailable,
                "无法定位桌面应用数据目录",
                "runtime.initialize",
            )
        })?;
        fs::create_dir_all(&app_data)
            .map_err(|error| RuntimeError::io("runtime.initialize", &error))?;
        let metadata_path = app_data.join(METADATA_FILE);
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(120))
            .user_agent("StoryForge-Desktop/3.8.0")
            .build()
            .map_err(|_| {
                RuntimeError::new(
                    RuntimeErrorCode::Unavailable,
                    "无法初始化受限网络客户端",
                    "runtime.initialize",
                )
            })?;
        let loopback_client = reqwest::Client::builder()
            .no_proxy()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(120))
            .user_agent("StoryForge-Desktop/3.8.0")
            .build()
            .map_err(|_| {
                RuntimeError::new(
                    RuntimeErrorCode::Unavailable,
                    "无法初始化本机模型客户端",
                    "runtime.initialize",
                )
            })?;

        Ok(Self {
            client,
            loopback_client,
            network_slots: Semaphore::new(4),
            cancellations: Mutex::new(HashMap::new()),
            writes: Mutex::new(HashMap::new()),
            diagnostics: Mutex::new(Vec::new()),
            migration_io: Mutex::new(()),
            metadata: Mutex::new(read_metadata(&metadata_path)),
            metadata_path,
            app_data_dir: app_data,
            session_secrets: Mutex::new(HashMap::new()),
        })
    }

    fn persist_metadata(&self, metadata: &RuntimeMetadata) -> RuntimeResult<()> {
        let encoded = serde_json::to_vec_pretty(metadata).map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::IntegrityError,
                "无法编码运行时元数据",
                "runtime.metadata",
            )
        })?;
        let temporary = self.metadata_path.with_extension("json.tmp");
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| RuntimeError::io("runtime.metadata", &error))?;
        file.write_all(&encoded)
            .and_then(|_| file.sync_all())
            .map_err(|error| RuntimeError::io("runtime.metadata", &error))?;
        drop(file);
        crate::platform::atomic_replace(&temporary, &self.metadata_path)
    }

    pub fn register_cancellation(&self, request_id: &str) -> RuntimeResult<CancellationToken> {
        if request_id.len() > 128 || request_id.is_empty() {
            return Err(RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "请求标识无效",
                "runtime.request",
            ));
        }
        let token = CancellationToken::new();
        let mut cancellations = self
            .cancellations
            .lock()
            .expect("cancellation mutex poisoned");
        if cancellations.contains_key(request_id) {
            return Err(RuntimeError::new(
                RuntimeErrorCode::Busy,
                "请求标识正在使用",
                "runtime.request",
            ));
        }
        cancellations.insert(request_id.to_string(), token.clone());
        Ok(token)
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        self.cancellations
            .lock()
            .expect("cancellation mutex poisoned")
            .get(request_id)
            .map(|token| {
                token.cancel();
                true
            })
            .unwrap_or(false)
    }

    pub fn finish_request(&self, request_id: &str) {
        self.cancellations
            .lock()
            .expect("cancellation mutex poisoned")
            .remove(request_id);
    }

    pub fn record(&self, mut event: Value) {
        if let Some(object) = event.as_object_mut() {
            object.entry("timestamp").or_insert_with(|| {
                Value::from(
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                )
            });
        }
        let mut events = self.diagnostics.lock().expect("diagnostics mutex poisoned");
        events.push(event);
        if events.len() > MAX_DIAGNOSTIC_EVENTS {
            events.remove(0);
        }
    }

    pub fn diagnostics_snapshot(&self) -> Vec<Value> {
        self.diagnostics
            .lock()
            .expect("diagnostics mutex poisoned")
            .clone()
    }

    pub fn put_secret(&self, descriptor: SecretDescriptor, value: String) -> RuntimeResult<String> {
        validate_secret_descriptor(&descriptor)?;
        if value.is_empty() || value.len() > 32 * 1024 {
            return Err(RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "凭据内容无效",
                "secrets.put",
            ));
        }
        let credential_id = format!("cred_{}", Uuid::new_v4().simple());
        if descriptor.persistence == "session" {
            self.session_secrets
                .lock()
                .expect("session secret mutex poisoned")
                .insert(
                    descriptor.key.clone(),
                    SessionSecret {
                        descriptor,
                        credential_id: credential_id.clone(),
                        value,
                    },
                );
            return Ok(credential_id);
        }
        if descriptor.persistence != "device" {
            return Err(RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "凭据持久化范围无效",
                "secrets.put",
            ));
        }

        let key = descriptor.key.clone();
        let target = credential_target(&key);
        platform::credential_write(&target, &value)?;
        let mut metadata = self.metadata.lock().expect("metadata mutex poisoned");
        metadata.device_secrets.insert(
            key.clone(),
            StoredSecretMetadata {
                descriptor,
                credential_id: credential_id.clone(),
            },
        );
        if let Err(error) = self.persist_metadata(&metadata) {
            metadata.device_secrets.remove(&key);
            let _ = platform::credential_delete(&target);
            return Err(error);
        }
        Ok(credential_id)
    }

    pub fn has_secret(&self, key: &str) -> bool {
        if self
            .session_secrets
            .lock()
            .expect("session secret mutex poisoned")
            .contains_key(key)
        {
            return true;
        }
        let exists = self
            .metadata
            .lock()
            .expect("metadata mutex poisoned")
            .device_secrets
            .contains_key(key);
        exists
            && platform::credential_read(&credential_target(key))
                .ok()
                .flatten()
                .is_some()
    }

    pub fn secret_reference(&self, key: &str) -> Option<String> {
        if let Some(record) = self
            .session_secrets
            .lock()
            .expect("session secret mutex poisoned")
            .get(key)
        {
            return Some(record.credential_id.clone());
        }
        let record = self
            .metadata
            .lock()
            .expect("metadata mutex poisoned")
            .device_secrets
            .get(key)
            .cloned()?;
        platform::credential_read(&credential_target(key))
            .ok()
            .flatten()
            .map(|_| record.credential_id)
    }

    pub fn resolve_secret(&self, credential_id: &str) -> RuntimeResult<ResolvedSecret> {
        if let Some(record) = self
            .session_secrets
            .lock()
            .expect("session secret mutex poisoned")
            .values()
            .find(|record| record.credential_id == credential_id)
            .cloned()
        {
            return Ok(ResolvedSecret {
                descriptor: record.descriptor,
                value: record.value,
            });
        }
        let record = self
            .metadata
            .lock()
            .expect("metadata mutex poisoned")
            .device_secrets
            .values()
            .find(|record| record.credential_id == credential_id)
            .cloned()
            .ok_or_else(|| {
                RuntimeError::new(
                    RuntimeErrorCode::NotFound,
                    "凭据引用不存在或已失效",
                    "secrets.reference",
                )
            })?;
        let value = platform::credential_read(&credential_target(&record.descriptor.key))?
            .ok_or_else(|| {
                RuntimeError::new(
                    RuntimeErrorCode::NotFound,
                    "Windows 凭据不存在",
                    "secrets.reference",
                )
            })?;
        Ok(ResolvedSecret {
            descriptor: record.descriptor,
            value,
        })
    }

    pub fn delete_secret(&self, key: &str) -> RuntimeResult<()> {
        self.session_secrets
            .lock()
            .expect("session secret mutex poisoned")
            .remove(key);
        platform::credential_delete(&credential_target(key))?;
        let mut metadata = self.metadata.lock().expect("metadata mutex poisoned");
        metadata.device_secrets.remove(key);
        self.persist_metadata(&metadata)
    }

    pub fn binding(&self, binding_id: &str) -> Option<StoredBinding> {
        self.metadata
            .lock()
            .expect("metadata mutex poisoned")
            .backup_bindings
            .get(binding_id)
            .cloned()
    }

    pub fn store_binding(&self, binding_id: String, binding: StoredBinding) -> RuntimeResult<()> {
        validate_binding_id(&binding_id)?;
        let mut metadata = self.metadata.lock().expect("metadata mutex poisoned");
        metadata.backup_bindings.insert(binding_id, binding);
        self.persist_metadata(&metadata)
    }

    pub fn clear_binding(&self, binding_id: &str) -> RuntimeResult<()> {
        let mut metadata = self.metadata.lock().expect("metadata mutex poisoned");
        metadata.backup_bindings.remove(binding_id);
        self.persist_metadata(&metadata)
    }

    pub fn approval_for_origin(&self, origin: &str) -> Option<String> {
        self.metadata
            .lock()
            .expect("metadata mutex poisoned")
            .endpoint_approvals
            .get(origin)
            .cloned()
    }

    pub fn store_approval(&self, origin: String) -> RuntimeResult<String> {
        let approval = format!("approval_{}", Uuid::new_v4().simple());
        let mut metadata = self.metadata.lock().expect("metadata mutex poisoned");
        metadata.endpoint_approvals.insert(origin, approval.clone());
        self.persist_metadata(&metadata)?;
        Ok(approval)
    }

    pub fn approval_matches(&self, origin: &str, approval_id: &str) -> bool {
        self.approval_for_origin(origin).as_deref() == Some(approval_id)
    }

    #[cfg(feature = "dev-identity")]
    pub fn synthetic_fixture_root(&self) -> PathBuf {
        self.app_data_dir.join("m1-synthetic-fixtures")
    }

    pub fn migration_journal_path(&self) -> PathBuf {
        self.app_data_dir.join("migration-journal.json")
    }

    pub fn migration_receipts_path(&self) -> PathBuf {
        self.app_data_dir.join("migration-receipts.json")
    }
}

fn credential_target(key: &str) -> String {
    #[cfg(feature = "dev-identity")]
    let namespace = "StoryForge/dev";
    #[cfg(not(feature = "dev-identity"))]
    let namespace = "StoryForge";
    format!("{namespace}/{key}")
}

pub fn validate_secret_key(key: &str) -> RuntimeResult<()> {
    let valid = key == "storyforge.github.gist"
        || key == "storyforge.ai.primary"
        || key == "storyforge.ai.embedding"
        || (key.starts_with("storyforge.ai.preset.")
            && key.len() > "storyforge.ai.preset.".len()
            && key.len() <= 256
            && key
                .trim_start_matches("storyforge.ai.preset.")
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_')));
    if valid {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "凭据键无效",
            "secrets.key",
        ))
    }
}

fn validate_secret_descriptor(descriptor: &SecretDescriptor) -> RuntimeResult<()> {
    let key_is_valid = descriptor.key == "storyforge.github.gist"
        || descriptor.key == "storyforge.ai.primary"
        || descriptor.key == "storyforge.ai.embedding"
        || descriptor.key.starts_with("storyforge.ai.preset.");
    let scope_matches = match (&descriptor.key[..], &descriptor.scope) {
        ("storyforge.github.gist", CredentialScope::GithubGist) => true,
        (
            "storyforge.ai.primary",
            CredentialScope::Ai {
                profile_id,
                operation,
                ..
            },
        ) => profile_id == "primary" && operation == "chat-completions",
        (
            "storyforge.ai.embedding",
            CredentialScope::Ai {
                profile_id,
                operation,
                ..
            },
        ) => profile_id == "embedding" && operation == "embeddings",
        (
            key,
            CredentialScope::Ai {
                profile_id,
                operation,
                ..
            },
        ) if key.starts_with("storyforge.ai.preset.") => {
            profile_id == key.trim_start_matches("storyforge.ai.preset.")
                && operation == "chat-completions"
        }
        _ => false,
    };
    if !key_is_valid || validate_secret_key(&descriptor.key).is_err() || !scope_matches {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "凭据描述符无效",
            "secrets.put",
        ));
    }
    Ok(())
}

pub fn validate_binding_id(binding_id: &str) -> RuntimeResult<()> {
    let valid = !binding_id.is_empty()
        && binding_id.len() <= 128
        && binding_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'));
    if valid {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "备份绑定标识无效",
            "files.bindBackupDirectory",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{credential_target, validate_binding_id};

    #[test]
    fn binding_ids_are_opaque_and_path_free() {
        assert!(validate_binding_id("project-42").is_ok());
        assert!(validate_binding_id("..\\secret").is_err());
        assert!(validate_binding_id("C:/Users/example").is_err());
    }

    #[test]
    fn credential_targets_are_namespaced_by_distribution_identity() {
        #[cfg(feature = "dev-identity")]
        assert_eq!(
            credential_target("storyforge.ai.primary"),
            "StoryForge/dev/storyforge.ai.primary"
        );
        #[cfg(not(feature = "dev-identity"))]
        assert_eq!(
            credential_target("storyforge.ai.primary"),
            "StoryForge/storyforge.ai.primary"
        );
    }
}

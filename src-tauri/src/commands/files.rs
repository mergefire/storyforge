use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use serde_json::json;
use tauri::State;
use uuid::Uuid;

use crate::{
    dto::{
        BackupBinding, BackupEntry, BackupFile, NativeOutcome, OpenedFile, SavedFile,
        WriteSessionStarted,
    },
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    platform,
    state::{validate_binding_id, AppState, StoredBinding, WriteSession},
};

const MAX_WRITE_CHUNK_BYTES: usize = 1024 * 1024;
const MAX_PROJECT_BYTES: usize = 512 * 1024 * 1024;
const MAX_DOCUMENT_BYTES: usize = 64 * 1024 * 1024;

fn purpose_extension(purpose: &str) -> RuntimeResult<&'static str> {
    match purpose {
        "project-json"
        | "context-snapshot"
        | "pre-destructive-backup"
        | "prompt-template-json"
        | "prompt-library-json"
        | "prompt-workflow-json"
        | "project-backup" => Ok("json"),
        "full-migration-archive" => Ok("zip"),
        "project-markdown" | "inspiration-markdown" => Ok("md"),
        "project-text" | "state-cards-text" => Ok("txt"),
        "fact-ledger" => Ok("csv"),
        "world-map-png" => Ok("png"),
        "diagnostic-bundle" => Ok("json"),
        "source-document" | "reference-document" => Ok("document"),
        _ => Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "文件用途无效",
            "files.purpose",
        )),
    }
}

fn max_bytes(purpose: &str) -> usize {
    if matches!(
        purpose,
        "project-json" | "full-migration-archive" | "project-backup"
    ) {
        MAX_PROJECT_BYTES
    } else {
        MAX_DOCUMENT_BYTES
    }
}

fn sanitize_name(value: &str, purpose: &str) -> RuntimeResult<String> {
    if value.is_empty()
        || value.len() > 240
        || value.contains('/')
        || value.contains('\\')
        || value.contains("..")
        || value.chars().any(char::is_control)
    {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "文件名无效",
            "files.name",
        ));
    }
    let expected = purpose_extension(purpose)?;
    if expected == "document" {
        return Ok(value.to_string());
    }
    let suffix = format!(".{expected}");
    if value.to_ascii_lowercase().ends_with(&suffix) {
        Ok(value.to_string())
    } else {
        Ok(format!("{value}{suffix}"))
    }
}

fn validate_selected_extension(path: &Path, purpose: &str) -> RuntimeResult<()> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let valid = match purpose {
        "source-document" | "reference-document" => {
            matches!(extension.as_str(), "txt" | "md" | "docx" | "pdf")
        }
        _ => extension == purpose_extension(purpose)?,
    };
    if valid {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "所选文件类型与操作用途不匹配",
            "files.extension",
        ))
    }
}

fn media_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("json") => "application/json",
        Some("zip") => "application/zip",
        Some("md") => "text/markdown",
        Some("txt") => "text/plain",
        Some("csv") => "text/csv",
        Some("png") => "image/png",
        Some("pdf") => "application/pdf",
        Some("docx") => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ => "application/octet-stream",
    }
}

fn create_session(
    path: PathBuf,
    max_bytes: usize,
) -> RuntimeResult<(String, WriteSessionStarted, WriteSession)> {
    let display_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "目标文件名无效",
                "files.beginWrite",
            )
        })?
        .to_string();
    let parent = path.parent().ok_or_else(|| {
        RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "目标目录无效",
            "files.beginWrite",
        )
    })?;
    let session_id = format!("write_{}", Uuid::new_v4().simple());
    let temporary_path = parent.join(format!(".{display_name}.{session_id}.tmp"));
    let file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary_path)
        .map_err(|error| RuntimeError::io("files.beginWrite", &error))?;
    Ok((
        session_id.clone(),
        WriteSessionStarted {
            session_id,
            display_name: display_name.clone(),
        },
        WriteSession {
            file,
            temporary_path,
            final_path: path,
            display_name,
            bytes_written: 0,
            max_bytes,
        },
    ))
}

#[tauri::command]
pub async fn runtime_file_begin_save(
    purpose: String,
    suggested_name: String,
    state: State<'_, AppState>,
) -> RuntimeResult<NativeOutcome<WriteSessionStarted>> {
    let suggested_name = sanitize_name(&suggested_name, &purpose)?;
    let selected = tauri::async_runtime::spawn_blocking(move || {
        platform::pick_save_file("保存 StoryForge 文件", &suggested_name)
    })
    .await
    .map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::Unknown,
            "文件对话框工作线程失败",
            "files.save",
        )
    })??;
    let Some(path) = selected else {
        return Ok(NativeOutcome::Cancelled);
    };
    validate_selected_extension(&path, &purpose)?;
    let (session_id, started, session) = create_session(path, max_bytes(&purpose))?;
    state
        .writes
        .lock()
        .expect("write mutex poisoned")
        .insert(session_id, session);
    state.record(json!({ "kind": "file-operation", "operation": "save", "purpose": purpose, "outcome": "started" }));
    Ok(NativeOutcome::Completed { value: started })
}

#[tauri::command]
pub fn runtime_file_write_chunk(
    session_id: String,
    bytes: Vec<u8>,
    state: State<'_, AppState>,
) -> RuntimeResult<()> {
    if bytes.len() > MAX_WRITE_CHUNK_BYTES {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "文件写入分块过大",
            "files.writeChunk",
        ));
    }
    let mut sessions = state.writes.lock().expect("write mutex poisoned");
    let session = sessions.get_mut(&session_id).ok_or_else(|| {
        RuntimeError::new(
            RuntimeErrorCode::NotFound,
            "文件写入会话不存在",
            "files.writeChunk",
        )
    })?;
    if session.bytes_written.saturating_add(bytes.len()) > session.max_bytes {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "文件内容超过当前用途的安全上限",
            "files.writeChunk",
        ));
    }
    session
        .file
        .write_all(&bytes)
        .map_err(|error| RuntimeError::io("files.writeChunk", &error))?;
    session.bytes_written += bytes.len();
    Ok(())
}

#[tauri::command]
pub fn runtime_file_finish_write(
    session_id: String,
    state: State<'_, AppState>,
) -> RuntimeResult<SavedFile> {
    let mut session = state
        .writes
        .lock()
        .expect("write mutex poisoned")
        .remove(&session_id)
        .ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::NotFound,
                "文件写入会话不存在",
                "files.finishWrite",
            )
        })?;
    session
        .file
        .flush()
        .and_then(|_| session.file.sync_all())
        .map_err(|error| RuntimeError::io("files.finishWrite", &error))?;
    drop(session.file);
    platform::atomic_replace(&session.temporary_path, &session.final_path)?;
    state.record(json!({
        "kind": "file-operation",
        "operation": "write",
        "outcome": "completed",
        "bytes": session.bytes_written,
    }));
    Ok(SavedFile {
        display_name: session.display_name,
    })
}

#[tauri::command]
pub fn runtime_file_abort_write(session_id: String, state: State<'_, AppState>) {
    if let Some(session) = state
        .writes
        .lock()
        .expect("write mutex poisoned")
        .remove(&session_id)
    {
        drop(session.file);
        let _ = fs::remove_file(session.temporary_path);
    }
}

#[tauri::command]
pub async fn runtime_file_open(
    purpose: String,
    state: State<'_, AppState>,
) -> RuntimeResult<NativeOutcome<OpenedFile>> {
    purpose_extension(&purpose)?;
    let selected =
        tauri::async_runtime::spawn_blocking(|| platform::pick_open_file("打开 StoryForge 文件"))
            .await
            .map_err(|_| {
                RuntimeError::new(
                    RuntimeErrorCode::Unknown,
                    "文件对话框工作线程失败",
                    "files.open",
                )
            })??;
    let Some(path) = selected else {
        return Ok(NativeOutcome::Cancelled);
    };
    validate_selected_extension(&path, &purpose)?;
    let metadata = fs::metadata(&path).map_err(|error| RuntimeError::io("files.open", &error))?;
    if metadata.len() > max_bytes(&purpose) as u64 {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "所选文件过大",
            "files.open",
        ));
    }
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "所选文件名无效",
                "files.open",
            )
        })?
        .to_string();
    let media_type = media_type(&path).to_string();
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|error| RuntimeError::io("files.open", &error))?;
    state.record(json!({ "kind": "file-operation", "operation": "open", "purpose": purpose, "outcome": "completed", "bytes": bytes.len() }));
    Ok(NativeOutcome::Completed {
        value: OpenedFile {
            name,
            media_type,
            bytes,
        },
    })
}

fn binding_view(binding_id: String, binding: Option<StoredBinding>) -> BackupBinding {
    match binding {
        Some(binding) => BackupBinding {
            binding_id,
            label: binding.label,
            permission: if binding.directory.is_dir() {
                "granted"
            } else {
                "missing"
            }
            .to_string(),
        },
        None => BackupBinding {
            binding_id,
            label: String::new(),
            permission: "missing".to_string(),
        },
    }
}

#[tauri::command]
pub async fn runtime_backup_bind(
    binding_id: String,
    state: State<'_, AppState>,
) -> RuntimeResult<NativeOutcome<BackupBinding>> {
    validate_binding_id(&binding_id)?;
    let selected = tauri::async_runtime::spawn_blocking(|| {
        platform::pick_directory("选择 StoryForge 备份目录")
    })
    .await
    .map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::Unknown,
            "目录对话框工作线程失败",
            "files.bindBackupDirectory",
        )
    })??;
    let Some(path) = selected else {
        return Ok(NativeOutcome::Cancelled);
    };
    let directory = path
        .canonicalize()
        .map_err(|error| RuntimeError::io("files.bindBackupDirectory", &error))?;
    let label = directory
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("StoryForge 备份")
        .to_string();
    let stored = StoredBinding { directory, label };
    state.store_binding(binding_id.clone(), stored.clone())?;
    Ok(NativeOutcome::Completed {
        value: binding_view(binding_id, Some(stored)),
    })
}

#[tauri::command]
pub fn runtime_backup_inspect(binding_id: String, state: State<'_, AppState>) -> BackupBinding {
    binding_view(binding_id.clone(), state.binding(&binding_id))
}

#[tauri::command]
pub fn runtime_backup_clear(binding_id: String, state: State<'_, AppState>) -> RuntimeResult<()> {
    state.clear_binding(&binding_id)
}

#[tauri::command]
pub fn runtime_backup_begin_write(
    binding_id: String,
    purpose: String,
    suggested_name: String,
    state: State<'_, AppState>,
) -> RuntimeResult<WriteSessionStarted> {
    if !matches!(
        purpose.as_str(),
        "project-backup" | "full-migration-archive"
    ) {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "备份用途无效",
            "files.writeBackup",
        ));
    }
    let name = sanitize_name(&suggested_name, &purpose)?;
    let binding = state.binding(&binding_id).ok_or_else(|| {
        RuntimeError::new(
            RuntimeErrorCode::NotFound,
            "备份目录尚未绑定",
            "files.writeBackup",
        )
    })?;
    if !binding.directory.is_dir() {
        return Err(RuntimeError::new(
            RuntimeErrorCode::NotFound,
            "备份目录不可用",
            "files.writeBackup",
        ));
    }
    let path = binding.directory.join(name);
    let (session_id, started, session) = create_session(path, max_bytes(&purpose))?;
    state
        .writes
        .lock()
        .expect("write mutex poisoned")
        .insert(session_id, session);
    Ok(started)
}

#[tauri::command]
pub fn runtime_backup_list(
    binding_id: String,
    purpose: String,
    state: State<'_, AppState>,
) -> RuntimeResult<Vec<BackupEntry>> {
    if !matches!(
        purpose.as_str(),
        "project-backup" | "full-migration-archive"
    ) {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "备份用途无效",
            "files.readBackups",
        ));
    }
    let binding = state.binding(&binding_id).ok_or_else(|| {
        RuntimeError::new(
            RuntimeErrorCode::NotFound,
            "备份目录尚未绑定",
            "files.readBackups",
        )
    })?;
    let extension = purpose_extension(&purpose)?;
    let mut entries = fs::read_dir(&binding.directory)
        .map_err(|error| RuntimeError::io("files.readBackups", &error))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            (path.is_file()
                && path
                    .extension()
                    .and_then(|value| value.to_str())
                    .is_some_and(|value| value.eq_ignore_ascii_case(extension)))
            .then(|| {
                entry.file_name().to_str().map(|name| BackupEntry {
                    name: name.to_string(),
                })
            })
            .flatten()
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.name.cmp(&left.name));
    Ok(entries)
}

#[tauri::command]
pub async fn runtime_backup_read(
    binding_id: String,
    purpose: String,
    name: String,
    state: State<'_, AppState>,
) -> RuntimeResult<BackupFile> {
    let safe_name = sanitize_name(&name, &purpose)?;
    if safe_name != name {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "备份文件名无效",
            "files.readBackups",
        ));
    }
    let binding = state.binding(&binding_id).ok_or_else(|| {
        RuntimeError::new(
            RuntimeErrorCode::NotFound,
            "备份目录尚未绑定",
            "files.readBackups",
        )
    })?;
    let path = binding.directory.join(&name);
    let canonical_path = path
        .canonicalize()
        .map_err(|error| RuntimeError::io("files.readBackups", &error))?;
    if !canonical_path.starts_with(&binding.directory) {
        return Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "备份文件超出绑定目录",
            "files.readBackups",
        ));
    }
    let metadata = fs::metadata(&canonical_path)
        .map_err(|error| RuntimeError::io("files.readBackups", &error))?;
    if metadata.len() > max_bytes(&purpose) as u64 {
        return Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "备份文件过大",
            "files.readBackups",
        ));
    }
    let bytes = tokio::fs::read(canonical_path)
        .await
        .map_err(|error| RuntimeError::io("files.readBackups", &error))?;
    Ok(BackupFile { name, bytes })
}

use std::{collections::HashMap, fs, io::Write, path::Path};

use serde::{de::DeserializeOwned, Serialize};
use tauri::State;

use crate::{
    dto::{
        MigrationJournal, MigrationJournalPhase, MigrationReceipt, MigrationWriteJournalRequest,
    },
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    platform,
    state::AppState,
};

fn invalid(message: &'static str, operation: &'static str) -> RuntimeError {
    RuntimeError::new(RuntimeErrorCode::InvalidInput, message, operation)
}

fn read_json<T: DeserializeOwned>(
    path: &Path,
    operation: &'static str,
) -> RuntimeResult<Option<T>> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::IntegrityError,
                "迁移状态文件格式无效",
                operation,
            )
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(RuntimeError::io(operation, &error)),
    }
}

fn write_json<T: Serialize>(path: &Path, value: &T, operation: &'static str) -> RuntimeResult<()> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::IntegrityError,
            "无法编码迁移状态文件",
            operation,
        )
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(invalid("迁移状态文件过大", operation));
    }
    let temporary = path.with_extension("json.tmp");
    let mut file = fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| RuntimeError::io(operation, &error))?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| RuntimeError::io(operation, &error))?;
    drop(file);
    platform::atomic_replace(&temporary, path)
}

fn phase_name(phase: MigrationJournalPhase) -> &'static str {
    match phase {
        MigrationJournalPhase::AwaitingChoice => "awaiting-choice",
        MigrationJournalPhase::ArchiveReceived => "archive-received",
        MigrationJournalPhase::ArchiveVerified => "archive-verified",
        MigrationJournalPhase::Importing => "importing",
        MigrationJournalPhase::DataVerified => "data-verified",
        MigrationJournalPhase::Activated => "activated",
        MigrationJournalPhase::Failed => "failed",
        MigrationJournalPhase::RolledBack => "rolled-back",
    }
}

fn valid_transition(current: Option<MigrationJournalPhase>, next: MigrationJournalPhase) -> bool {
    if current == Some(next) {
        return true;
    }
    matches!(
        (current, next),
        (None, MigrationJournalPhase::AwaitingChoice)
            | (None, MigrationJournalPhase::Activated)
            | (
                Some(MigrationJournalPhase::AwaitingChoice),
                MigrationJournalPhase::ArchiveReceived
            )
            | (
                Some(MigrationJournalPhase::AwaitingChoice),
                MigrationJournalPhase::Activated
            )
            | (
                Some(MigrationJournalPhase::ArchiveReceived),
                MigrationJournalPhase::ArchiveVerified
            )
            | (
                Some(MigrationJournalPhase::ArchiveReceived),
                MigrationJournalPhase::Failed
            )
            | (
                Some(MigrationJournalPhase::ArchiveVerified),
                MigrationJournalPhase::Importing
            )
            | (
                Some(MigrationJournalPhase::ArchiveVerified),
                MigrationJournalPhase::Failed
            )
            | (
                Some(MigrationJournalPhase::Importing),
                MigrationJournalPhase::DataVerified
            )
            | (
                Some(MigrationJournalPhase::Importing),
                MigrationJournalPhase::Failed
            )
            | (
                Some(MigrationJournalPhase::DataVerified),
                MigrationJournalPhase::Activated
            )
            | (
                Some(MigrationJournalPhase::DataVerified),
                MigrationJournalPhase::Failed
            )
            | (
                Some(MigrationJournalPhase::Failed),
                MigrationJournalPhase::RolledBack
            )
            | (
                Some(MigrationJournalPhase::Failed),
                MigrationJournalPhase::AwaitingChoice
            )
            | (
                Some(MigrationJournalPhase::Activated),
                MigrationJournalPhase::RolledBack
            )
            | (
                Some(MigrationJournalPhase::RolledBack),
                MigrationJournalPhase::AwaitingChoice
            )
    )
}

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn validate_journal(journal: &MigrationJournal) -> RuntimeResult<()> {
    let operation = "migration.writeJournal";
    if journal.updated_at.is_empty() || journal.updated_at.len() > 64 {
        return Err(invalid("迁移状态时间无效", operation));
    }
    match journal.phase {
        MigrationJournalPhase::AwaitingChoice => {
            if journal.export_id.is_some() || journal.archive_sha256.is_some() {
                return Err(invalid("迁移等待状态不得绑定归档", operation));
            }
        }
        MigrationJournalPhase::Activated if journal.export_id.is_none() => {
            if journal.archive_sha256.is_some() {
                return Err(invalid("空白资料库状态不得绑定归档哈希", operation));
            }
        }
        _ => {
            if !journal.export_id.as_deref().is_some_and(valid_identifier)
                || !journal.archive_sha256.as_deref().is_some_and(valid_sha256)
            {
                return Err(invalid("迁移状态缺少有效的归档标识", operation));
            }
        }
    }
    if journal
        .error_code
        .as_deref()
        .is_some_and(|value| value.is_empty() || value.len() > 64)
        || (journal.error_code.is_some() && journal.phase != MigrationJournalPhase::Failed)
    {
        return Err(invalid("迁移错误状态无效", operation));
    }
    Ok(())
}

fn validate_receipt(receipt: &MigrationReceipt) -> RuntimeResult<()> {
    let operation = "migration.writeReceipt";
    if !valid_identifier(&receipt.export_id)
        || !valid_sha256(&receipt.archive_sha256)
        || receipt.source_app_version.is_empty()
        || receipt.source_app_version.len() > 64
        || receipt.target_app_version.is_empty()
        || receipt.target_app_version.len() > 64
        || receipt.imported_at.is_empty()
        || receipt.imported_at.len() > 64
        || receipt.table_results.len() > 128
        || receipt.blob_results.len() > 100_000
        || receipt.rebuild_queue.len() > 128
        || receipt.reauthorization.len() > 128
        || receipt.integrity_errors.len() > 1_000
    {
        return Err(invalid("迁移回执格式无效", operation));
    }
    for result in &receipt.table_results {
        if !valid_identifier(&result.name)
            || !valid_sha256(&result.expected_sha256)
            || !valid_sha256(&result.actual_sha256)
            || !matches!(result.status.as_str(), "verified" | "failed")
        {
            return Err(invalid("迁移表回执无效", operation));
        }
    }
    for result in &receipt.blob_results {
        if !valid_identifier(&result.table)
            || !valid_identifier(&result.field)
            || !valid_sha256(&result.expected_sha256)
            || (!result.actual_sha256.is_empty() && !valid_sha256(&result.actual_sha256))
            || !matches!(result.status.as_str(), "verified" | "failed")
            || (!result.primary_key.is_string() && !result.primary_key.is_number())
        {
            return Err(invalid("迁移 Blob 回执无效", operation));
        }
    }
    let short_values = receipt
        .rebuild_queue
        .iter()
        .chain(receipt.reauthorization.iter())
        .chain(receipt.integrity_errors.iter())
        .all(|value| !value.is_empty() && value.len() <= 512);
    if !short_values
        || !matches!(receipt.status.as_str(), "verified" | "failed")
        || (receipt.status == "verified"
            && (!receipt.integrity_errors.is_empty()
                || receipt
                    .table_results
                    .iter()
                    .any(|result| result.status != "verified")
                || receipt
                    .blob_results
                    .iter()
                    .any(|result| result.status != "verified")))
    {
        return Err(invalid("迁移回执结论无效", operation));
    }
    Ok(())
}

#[tauri::command]
pub fn runtime_migration_read_journal(
    state: State<'_, AppState>,
) -> RuntimeResult<Option<MigrationJournal>> {
    let _guard = state.migration_io.lock().expect("migration mutex poisoned");
    read_json(&state.migration_journal_path(), "migration.readJournal")
}

#[tauri::command]
pub fn runtime_migration_write_journal(
    request: MigrationWriteJournalRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<()> {
    validate_journal(&request.journal)?;
    let _guard = state.migration_io.lock().expect("migration mutex poisoned");
    let path = state.migration_journal_path();
    let current: Option<MigrationJournal> = read_json(&path, "migration.writeJournal")?;
    if let Some(expected) = request.expected_phase.as_deref() {
        let actual = current
            .as_ref()
            .map(|journal| phase_name(journal.phase))
            .unwrap_or("none");
        if expected != actual {
            return Err(RuntimeError::new(
                RuntimeErrorCode::Busy,
                "迁移状态已经变化",
                "migration.writeJournal",
            ));
        }
    }
    if !valid_transition(
        current.as_ref().map(|journal| journal.phase),
        request.journal.phase,
    ) {
        return Err(invalid("迁移状态转换无效", "migration.writeJournal"));
    }
    if let Some(current) = current.as_ref() {
        let resetting = matches!(request.journal.phase, MigrationJournalPhase::AwaitingChoice);
        if !resetting
            && current.export_id.is_some()
            && current.export_id != request.journal.export_id
        {
            return Err(invalid("迁移过程中不得切换归档", "migration.writeJournal"));
        }
    }
    write_json(&path, &request.journal, "migration.writeJournal")
}

#[tauri::command]
pub fn runtime_migration_clear_journal(state: State<'_, AppState>) -> RuntimeResult<()> {
    let _guard = state.migration_io.lock().expect("migration mutex poisoned");
    match fs::remove_file(state.migration_journal_path()) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(RuntimeError::io("migration.clearJournal", &error)),
    }
}

#[tauri::command]
pub fn runtime_migration_read_receipt(
    export_id: String,
    state: State<'_, AppState>,
) -> RuntimeResult<Option<MigrationReceipt>> {
    if !valid_identifier(&export_id) {
        return Err(invalid("迁移导出标识无效", "migration.readReceipt"));
    }
    let _guard = state.migration_io.lock().expect("migration mutex poisoned");
    let receipts: HashMap<String, MigrationReceipt> =
        read_json(&state.migration_receipts_path(), "migration.readReceipt")?.unwrap_or_default();
    Ok(receipts.get(&export_id).cloned())
}

#[tauri::command]
pub fn runtime_migration_write_receipt(
    receipt: MigrationReceipt,
    state: State<'_, AppState>,
) -> RuntimeResult<()> {
    validate_receipt(&receipt)?;
    let _guard = state.migration_io.lock().expect("migration mutex poisoned");
    let path = state.migration_receipts_path();
    let mut receipts: HashMap<String, MigrationReceipt> =
        read_json(&path, "migration.writeReceipt")?.unwrap_or_default();
    if receipts.contains_key(&receipt.export_id) {
        return Err(RuntimeError::new(
            RuntimeErrorCode::Busy,
            "该迁移包已经生成过回执",
            "migration.writeReceipt",
        ));
    }
    receipts.insert(receipt.export_id.clone(), receipt);
    write_json(&path, &receipts, "migration.writeReceipt")
}

#[tauri::command]
pub fn runtime_migration_delete_receipt(
    export_id: String,
    state: State<'_, AppState>,
) -> RuntimeResult<()> {
    if !valid_identifier(&export_id) {
        return Err(invalid("迁移导出标识无效", "migration.deleteReceipt"));
    }
    let _guard = state.migration_io.lock().expect("migration mutex poisoned");
    let path = state.migration_receipts_path();
    let mut receipts: HashMap<String, MigrationReceipt> =
        read_json(&path, "migration.deleteReceipt")?.unwrap_or_default();
    receipts.remove(&export_id);
    write_json(&path, &receipts, "migration.deleteReceipt")
}

#[cfg(test)]
mod tests {
    use super::valid_transition;
    use crate::dto::MigrationJournalPhase;

    #[test]
    fn journal_never_skips_verification_before_activation() {
        assert!(!valid_transition(
            Some(MigrationJournalPhase::ArchiveVerified),
            MigrationJournalPhase::Activated
        ));
        assert!(!valid_transition(
            Some(MigrationJournalPhase::Importing),
            MigrationJournalPhase::Activated
        ));
        assert!(valid_transition(
            Some(MigrationJournalPhase::DataVerified),
            MigrationJournalPhase::Activated
        ));
    }
}

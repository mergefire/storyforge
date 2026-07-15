use std::{fmt::Write as _, fs};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::State;

use crate::{
    dto::BackupBinding,
    error::{RuntimeError, RuntimeErrorCode, RuntimeResult},
    state::{AppState, StoredBinding},
};

const SYNTHETIC_BINDING_ID: &str = "m1-synthetic-fixture";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyntheticFixtureDigest {
    name: String,
    size_bytes: u64,
    sha256: String,
}

fn safe_fixture_name(name: &str) -> RuntimeResult<()> {
    if !name.is_empty()
        && name.len() <= 200
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
        && name.ends_with(".json")
    {
        Ok(())
    } else {
        Err(RuntimeError::new(
            RuntimeErrorCode::InvalidInput,
            "合成 fixture 文件名无效",
            "dev.fixture",
        ))
    }
}

#[tauri::command]
pub fn runtime_dev_prepare_synthetic_binding(
    state: State<'_, AppState>,
) -> RuntimeResult<BackupBinding> {
    let root = state.synthetic_fixture_root();
    fs::create_dir_all(&root).map_err(|error| RuntimeError::io("dev.fixture.prepare", &error))?;
    let directory = root
        .canonicalize()
        .map_err(|error| RuntimeError::io("dev.fixture.prepare", &error))?;
    state.store_binding(
        SYNTHETIC_BINDING_ID.to_string(),
        StoredBinding {
            directory,
            label: "M1 synthetic fixture".to_string(),
        },
    )?;
    Ok(BackupBinding {
        binding_id: SYNTHETIC_BINDING_ID.to_string(),
        label: "M1 synthetic fixture".to_string(),
        permission: "granted".to_string(),
    })
}

#[tauri::command]
pub fn runtime_dev_synthetic_fixture_digest(
    name: String,
    state: State<'_, AppState>,
) -> RuntimeResult<SyntheticFixtureDigest> {
    safe_fixture_name(&name)?;
    let root = state
        .synthetic_fixture_root()
        .canonicalize()
        .map_err(|error| RuntimeError::io("dev.fixture.digest", &error))?;
    let path = root.join(&name);
    let canonical = path
        .canonicalize()
        .map_err(|error| RuntimeError::io("dev.fixture.digest", &error))?;
    if !canonical.starts_with(&root) {
        return Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "合成 fixture 超出专用目录",
            "dev.fixture.digest",
        ));
    }
    let bytes =
        fs::read(&canonical).map_err(|error| RuntimeError::io("dev.fixture.digest", &error))?;
    let digest = Sha256::digest(&bytes);
    let mut sha256 = String::with_capacity(64);
    for byte in digest {
        write!(&mut sha256, "{byte:02x}").expect("writing to String cannot fail");
    }
    Ok(SyntheticFixtureDigest {
        name,
        size_bytes: bytes.len() as u64,
        sha256,
    })
}

#[tauri::command]
pub fn runtime_dev_reset_synthetic_fixtures(state: State<'_, AppState>) -> RuntimeResult<()> {
    let root = state.synthetic_fixture_root();
    let expected_name = root.file_name().and_then(|value| value.to_str());
    if expected_name != Some("m1-synthetic-fixtures") {
        return Err(RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "合成 fixture 清理目标无效",
            "dev.fixture.reset",
        ));
    }
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| RuntimeError::io("dev.fixture.reset", &error))?;
    }
    state.clear_binding(SYNTHETIC_BINDING_ID)
}

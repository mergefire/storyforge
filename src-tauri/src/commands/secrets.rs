use tauri::State;

use crate::{
    dto::SecretPutRequest,
    error::RuntimeResult,
    state::{validate_ai_secret_key, validate_secret_key, AppState},
};

#[tauri::command]
pub fn runtime_secret_put(
    request: SecretPutRequest,
    state: State<'_, AppState>,
) -> RuntimeResult<String> {
    state.put_secret(request.descriptor, request.value)
}

#[tauri::command]
pub fn runtime_secret_has(key: String, state: State<'_, AppState>) -> RuntimeResult<bool> {
    validate_secret_key(&key)?;
    Ok(state.has_secret(&key))
}

#[tauri::command]
pub fn runtime_secret_reference(
    key: String,
    state: State<'_, AppState>,
) -> RuntimeResult<Option<String>> {
    validate_secret_key(&key)?;
    Ok(state.secret_reference(&key))
}

#[tauri::command]
pub fn runtime_ai_secret_reveal(
    key: String,
    state: State<'_, AppState>,
) -> RuntimeResult<Option<String>> {
    validate_ai_secret_key(&key)?;
    state.reveal_secret(&key)
}

#[tauri::command]
pub fn runtime_secret_delete(key: String, state: State<'_, AppState>) -> RuntimeResult<()> {
    validate_secret_key(&key)?;
    state.delete_secret(&key)
}

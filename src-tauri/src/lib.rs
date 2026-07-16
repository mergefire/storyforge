#[cfg(any(feature = "dev-identity", test))]
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

mod commands;
mod dto;
mod error;
mod platform;
mod security;
mod state;

use tauri::Manager;

const WEBVIEW2_ENV_PREFIX: &str = "WEBVIEW2_";
#[cfg(feature = "dev-identity")]
const WEBVIEW2_USER_DATA_FOLDER: &str = "WEBVIEW2_USER_DATA_FOLDER";
#[cfg(feature = "dev-identity")]
const WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

#[cfg(feature = "dev-identity")]
const STORYFORGE_DEV_USER_DATA_FOLDER: &str = "STORYFORGE_DEV_WEBVIEW2_USER_DATA_FOLDER";
#[cfg(feature = "dev-identity")]
const STORYFORGE_DEV_BROWSER_ARGUMENTS: &str =
    "STORYFORGE_DEV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

#[cfg(any(feature = "dev-identity", test))]
#[derive(Debug, PartialEq, Eq)]
struct DevWebView2Overrides {
    profile_directory: OsString,
    browser_arguments: OsString,
}

#[cfg(any(feature = "dev-identity", test))]
fn validate_dev_webview2_overrides(
    profile_directory: Option<OsString>,
    browser_arguments: Option<OsString>,
    temp_directory: &Path,
) -> Result<Option<DevWebView2Overrides>, String> {
    let (profile_directory, browser_arguments) = match (profile_directory, browser_arguments) {
        (None, None) => return Ok(None),
        (Some(profile_directory), Some(browser_arguments)) => {
            (profile_directory, browser_arguments)
        }
        _ => {
            return Err(
                "dev WebView2 profile and browser arguments must be supplied together".into(),
            )
        }
    };

    let profile_path = PathBuf::from(&profile_directory);
    if !profile_path.is_absolute() || !profile_path.starts_with(temp_directory) {
        return Err(
            "dev WebView2 profile must be an absolute path under the temp directory".into(),
        );
    }

    let arguments = browser_arguments
        .to_str()
        .ok_or_else(|| "dev WebView2 browser arguments must be valid Unicode".to_string())?;
    let tokens = arguments.split_whitespace().collect::<Vec<_>>();
    if tokens.len() != 2 {
        return Err("dev WebView2 browser arguments must contain exactly two owned flags".into());
    }

    let port_text = tokens[0]
        .strip_prefix("--remote-debugging-port=")
        .ok_or_else(|| "missing owned remote debugging port".to_string())?;
    let port = port_text
        .parse::<u16>()
        .map_err(|_| "dev WebView2 remote debugging port is invalid".to_string())?;
    if port == 0 {
        return Err("dev WebView2 remote debugging port must be non-zero".into());
    }

    let expected_origin = format!("--remote-allow-origins=http://127.0.0.1:{port}");
    if tokens[1] != expected_origin {
        return Err("dev WebView2 remote allow origin must match the owned loopback port".into());
    }

    Ok(Some(DevWebView2Overrides {
        profile_directory,
        browser_arguments,
    }))
}

fn clear_inherited_webview2_environment() {
    let inherited_keys = std::env::vars_os()
        .filter_map(|(key, _)| {
            key.to_string_lossy()
                .to_ascii_uppercase()
                .starts_with(WEBVIEW2_ENV_PREFIX)
                .then_some(key)
        })
        .collect::<Vec<_>>();

    for key in inherited_keys {
        std::env::remove_var(key);
    }
}

fn apply_owned_webview2_environment() {
    #[cfg(feature = "dev-identity")]
    let requested_overrides = validate_dev_webview2_overrides(
        std::env::var_os(STORYFORGE_DEV_USER_DATA_FOLDER),
        std::env::var_os(STORYFORGE_DEV_BROWSER_ARGUMENTS),
        &std::env::temp_dir(),
    )
    .expect("invalid StoryForge dev WebView2 overrides");

    clear_inherited_webview2_environment();

    #[cfg(feature = "dev-identity")]
    if let Some(overrides) = requested_overrides {
        std::env::set_var(WEBVIEW2_USER_DATA_FOLDER, overrides.profile_directory);
        std::env::set_var(
            WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS,
            overrides.browser_arguments,
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    apply_owned_webview2_environment();
    let builder = tauri::Builder::default().setup(|app| {
        let state = state::AppState::new(&app.handle().clone())?;
        app.manage(state);
        Ok(())
    });

    #[cfg(not(feature = "dev-identity"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::ai::runtime_ai_approve_endpoint,
        commands::ai::runtime_ai_execute,
        commands::gist::runtime_gist_validate,
        commands::gist::runtime_gist_write,
        commands::gist::runtime_gist_list,
        commands::gist::runtime_gist_read,
        commands::gist::runtime_gist_revisions,
        commands::secrets::runtime_secret_put,
        commands::secrets::runtime_secret_has,
        commands::secrets::runtime_secret_reference,
        commands::secrets::runtime_ai_secret_reveal,
        commands::secrets::runtime_secret_delete,
        commands::files::runtime_file_begin_save,
        commands::files::runtime_file_write_chunk,
        commands::files::runtime_file_finish_write,
        commands::files::runtime_file_abort_write,
        commands::files::runtime_file_open,
        commands::files::runtime_backup_bind,
        commands::files::runtime_backup_inspect,
        commands::files::runtime_backup_clear,
        commands::files::runtime_backup_begin_write,
        commands::files::runtime_backup_list,
        commands::files::runtime_backup_read,
        commands::migration::runtime_migration_read_journal,
        commands::migration::runtime_migration_write_journal,
        commands::migration::runtime_migration_clear_journal,
        commands::migration::runtime_migration_read_receipt,
        commands::migration::runtime_migration_write_receipt,
        commands::migration::runtime_migration_delete_receipt,
        commands::system::runtime_cancel_request,
        commands::system::runtime_clipboard_write,
        commands::system::runtime_external_open,
        commands::system::runtime_durability_status,
        commands::system::runtime_diagnostics_snapshot,
    ]);

    #[cfg(feature = "dev-identity")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::ai::runtime_ai_approve_endpoint,
        commands::ai::runtime_ai_execute,
        commands::gist::runtime_gist_validate,
        commands::gist::runtime_gist_write,
        commands::gist::runtime_gist_list,
        commands::gist::runtime_gist_read,
        commands::gist::runtime_gist_revisions,
        commands::secrets::runtime_secret_put,
        commands::secrets::runtime_secret_has,
        commands::secrets::runtime_secret_reference,
        commands::secrets::runtime_ai_secret_reveal,
        commands::secrets::runtime_secret_delete,
        commands::files::runtime_file_begin_save,
        commands::files::runtime_file_write_chunk,
        commands::files::runtime_file_finish_write,
        commands::files::runtime_file_abort_write,
        commands::files::runtime_file_open,
        commands::files::runtime_backup_bind,
        commands::files::runtime_backup_inspect,
        commands::files::runtime_backup_clear,
        commands::files::runtime_backup_begin_write,
        commands::files::runtime_backup_list,
        commands::files::runtime_backup_read,
        commands::migration::runtime_migration_read_journal,
        commands::migration::runtime_migration_write_journal,
        commands::migration::runtime_migration_clear_journal,
        commands::migration::runtime_migration_read_receipt,
        commands::migration::runtime_migration_write_receipt,
        commands::migration::runtime_migration_delete_receipt,
        commands::system::runtime_cancel_request,
        commands::system::runtime_clipboard_write,
        commands::system::runtime_external_open,
        commands::system::runtime_durability_status,
        commands::system::runtime_diagnostics_snapshot,
        commands::dev::runtime_dev_prepare_synthetic_binding,
        commands::dev::runtime_dev_synthetic_fixture_digest,
        commands::dev::runtime_dev_reset_synthetic_fixtures,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("failed to run StoryForge desktop client")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_owned_dev_profile_and_matching_loopback_flags() {
        let temp = std::env::temp_dir().join("storyforge-m0-rust-test");
        let profile = temp.join("valid-profile");
        let result = validate_dev_webview2_overrides(
            Some(profile.into_os_string()),
            Some(OsString::from(
                "--remote-debugging-port=54321 --remote-allow-origins=http://127.0.0.1:54321",
            )),
            &temp,
        )
        .expect("valid owned overrides");

        assert!(result.is_some());
    }

    #[test]
    fn rejects_partial_or_non_temp_dev_overrides() {
        let temp = std::env::temp_dir().join("storyforge-m0-rust-test");
        let profile = temp.join("valid-profile");
        let outside = temp
            .parent()
            .expect("temp test root has a parent")
            .join("storyforge-m0-outside-profile");
        assert!(
            validate_dev_webview2_overrides(Some(profile.into_os_string()), None, &temp,).is_err()
        );
        assert!(validate_dev_webview2_overrides(
            Some(outside.into_os_string()),
            Some(OsString::from(
                "--remote-debugging-port=54321 --remote-allow-origins=http://127.0.0.1:54321",
            )),
            &temp,
        )
        .is_err());
    }

    #[test]
    fn rejects_extra_or_mismatched_dev_browser_flags() {
        let temp = std::env::temp_dir().join("storyforge-m0-rust-test");
        let profile = temp.join("valid-profile");
        for arguments in [
            "--remote-debugging-port=54321 --remote-allow-origins=http://127.0.0.1:1",
            "--remote-debugging-port=54321 --remote-allow-origins=http://127.0.0.1:54321 --disable-web-security",
        ] {
            assert!(validate_dev_webview2_overrides(
                Some(profile.clone().into_os_string()),
                Some(OsString::from(arguments)),
                &temp,
            )
            .is_err());
        }
    }
}

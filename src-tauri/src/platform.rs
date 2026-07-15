use std::{ffi::OsStr, os::windows::ffi::OsStrExt, path::PathBuf, ptr};

use windows::{
    core::{PCWSTR, PWSTR},
    Win32::{
        Foundation::{GlobalFree, ERROR_CANCELLED, HANDLE, HWND},
        Security::Credentials::{
            CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
            CRED_TYPE_GENERIC,
        },
        Storage::FileSystem::{ReplaceFileW, REPLACE_FILE_FLAGS},
        System::{
            Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
            },
            DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData},
            Memory::{GlobalAlloc, GlobalLock, GMEM_MOVEABLE},
            Ole::CF_UNICODETEXT,
        },
        UI::{
            Shell::{
                FileOpenDialog, FileSaveDialog, IFileDialog, IFileOpenDialog, IFileSaveDialog,
                ShellExecuteW, FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM, FOS_PATHMUSTEXIST,
                FOS_PICKFOLDERS, FOS_STRICTFILETYPES, SIGDN_FILESYSPATH,
            },
            WindowsAndMessaging::{
                MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONWARNING, MB_YESNO, SW_SHOWNORMAL,
            },
        },
    },
};

use crate::error::{RuntimeError, RuntimeErrorCode, RuntimeResult};

fn wide(value: impl AsRef<OsStr>) -> Vec<u16> {
    value.as_ref().encode_wide().chain(Some(0)).collect()
}

fn windows_error(operation: &'static str) -> RuntimeError {
    RuntimeError::new(RuntimeErrorCode::Unknown, "Windows 原生操作失败", operation)
}

pub fn credential_write(target: &str, secret: &str) -> RuntimeResult<()> {
    let mut target = wide(target);
    let mut username = wide("StoryForge");
    let mut blob = secret.as_bytes().to_vec();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target.as_mut_ptr()),
        CredentialBlobSize: blob.len().try_into().map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::InvalidInput,
                "凭据内容过大",
                "secrets.put",
            )
        })?,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(username.as_mut_ptr()),
        ..Default::default()
    };

    // SAFETY: all pointers remain valid for the duration of CredWriteW and sizes
    // are derived from their backing Rust buffers.
    unsafe { CredWriteW(&credential, 0) }.map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::PermissionDenied,
            "无法写入 Windows 凭据管理器",
            "secrets.put",
        )
    })
}

pub fn credential_read(target: &str) -> RuntimeResult<Option<String>> {
    let target = wide(target);
    let mut pointer: *mut CREDENTIALW = ptr::null_mut();
    // SAFETY: CredReadW writes either a null pointer or a credential allocated
    // by Windows. The allocation is released with CredFree below.
    if unsafe {
        CredReadW(
            PCWSTR(target.as_ptr()),
            CRED_TYPE_GENERIC,
            None,
            &mut pointer,
        )
    }
    .is_err()
    {
        return Ok(None);
    }
    if pointer.is_null() {
        return Ok(None);
    }

    // SAFETY: pointer is owned by the credential manager until CredFree.
    let bytes = unsafe {
        let credential = &*pointer;
        std::slice::from_raw_parts(
            credential.CredentialBlob,
            credential.CredentialBlobSize as usize,
        )
        .to_vec()
    };
    // SAFETY: required matching release for CredReadW.
    unsafe { CredFree(pointer.cast()) };
    String::from_utf8(bytes).map(Some).map_err(|_| {
        RuntimeError::new(
            RuntimeErrorCode::IntegrityError,
            "Windows 凭据内容无效",
            "secrets.reference",
        )
    })
}

pub fn credential_delete(target: &str) -> RuntimeResult<()> {
    let target = wide(target);
    // Deletion is intentionally idempotent. A missing credential is the desired
    // post-condition and Windows reports it through the same error channel.
    let _ = unsafe { CredDeleteW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, None) };
    Ok(())
}

struct ComGuard;

impl ComGuard {
    fn initialize() -> RuntimeResult<Self> {
        // SAFETY: this runs on a dedicated blocking worker and is paired with
        // CoUninitialize through Drop.
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) }
            .ok()
            .map_err(|_| windows_error("files.dialog"))?;
        Ok(Self)
    }
}

impl Drop for ComGuard {
    fn drop(&mut self) {
        // SAFETY: paired with the successful CoInitializeEx in this thread.
        unsafe { CoUninitialize() };
    }
}

fn dialog_path(dialog: &IFileDialog) -> RuntimeResult<PathBuf> {
    // SAFETY: COM interfaces are valid for the duration of this call. The
    // display-name buffer is released with CoTaskMemFree.
    unsafe {
        let item = dialog
            .GetResult()
            .map_err(|_| windows_error("files.dialog.result"))?;
        let value = item
            .GetDisplayName(SIGDN_FILESYSPATH)
            .map_err(|_| windows_error("files.dialog.result"))?;
        let text = value
            .to_string()
            .map_err(|_| windows_error("files.dialog.result"))?;
        CoTaskMemFree(Some(value.0.cast()));
        Ok(PathBuf::from(text))
    }
}

fn was_cancelled(error: &windows::core::Error) -> bool {
    error.code().0 as u32 == 0x8007_0000 | ERROR_CANCELLED.0
}

pub fn pick_open_file(title: &str) -> RuntimeResult<Option<PathBuf>> {
    let _guard = ComGuard::initialize()?;
    // SAFETY: COM apartment is initialized above and returned interfaces are
    // released by the windows crate wrappers.
    unsafe {
        let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|_| windows_error("files.open"))?;
        dialog
            .SetOptions(FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST)
            .map_err(|_| windows_error("files.open"))?;
        dialog
            .SetTitle(PCWSTR(wide(title).as_ptr()))
            .map_err(|_| windows_error("files.open"))?;
        match dialog.Show(None) {
            Ok(()) => dialog_path(&dialog).map(Some),
            Err(error) if was_cancelled(&error) => Ok(None),
            Err(_) => Err(windows_error("files.open")),
        }
    }
}

pub fn pick_save_file(title: &str, suggested_name: &str) -> RuntimeResult<Option<PathBuf>> {
    let _guard = ComGuard::initialize()?;
    // SAFETY: COM apartment is initialized above.
    unsafe {
        let dialog: IFileSaveDialog = CoCreateInstance(&FileSaveDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|_| windows_error("files.save"))?;
        dialog
            .SetOptions(FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_STRICTFILETYPES)
            .map_err(|_| windows_error("files.save"))?;
        dialog
            .SetTitle(PCWSTR(wide(title).as_ptr()))
            .map_err(|_| windows_error("files.save"))?;
        dialog
            .SetFileName(PCWSTR(wide(suggested_name).as_ptr()))
            .map_err(|_| windows_error("files.save"))?;
        match dialog.Show(None) {
            Ok(()) => dialog_path(&dialog).map(Some),
            Err(error) if was_cancelled(&error) => Ok(None),
            Err(_) => Err(windows_error("files.save")),
        }
    }
}

pub fn pick_directory(title: &str) -> RuntimeResult<Option<PathBuf>> {
    let _guard = ComGuard::initialize()?;
    // SAFETY: COM apartment is initialized above.
    unsafe {
        let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|_| windows_error("files.bindBackupDirectory"))?;
        dialog
            .SetOptions(FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_PICKFOLDERS)
            .map_err(|_| windows_error("files.bindBackupDirectory"))?;
        dialog
            .SetTitle(PCWSTR(wide(title).as_ptr()))
            .map_err(|_| windows_error("files.bindBackupDirectory"))?;
        match dialog.Show(None) {
            Ok(()) => dialog_path(&dialog).map(Some),
            Err(error) if was_cancelled(&error) => Ok(None),
            Err(_) => Err(windows_error("files.bindBackupDirectory")),
        }
    }
}

struct ClipboardGuard;

impl Drop for ClipboardGuard {
    fn drop(&mut self) {
        // SAFETY: closing an owned open clipboard is always valid.
        let _ = unsafe { CloseClipboard() };
    }
}

pub fn write_clipboard_text(text: &str) -> RuntimeResult<()> {
    let encoded = wide(text);
    // SAFETY: Windows clipboard ownership and movable allocation rules are
    // followed; ownership of the allocation transfers after SetClipboardData.
    unsafe {
        OpenClipboard(None).map_err(|_| {
            RuntimeError::new(
                RuntimeErrorCode::Busy,
                "系统剪贴板正忙",
                "clipboard.writeText",
            )
        })?;
        let _guard = ClipboardGuard;
        EmptyClipboard().map_err(|_| windows_error("clipboard.writeText"))?;
        let byte_len = encoded.len() * std::mem::size_of::<u16>();
        let allocation = GlobalAlloc(GMEM_MOVEABLE, byte_len)
            .map_err(|_| windows_error("clipboard.writeText"))?;
        let destination = GlobalLock(allocation);
        if destination.is_null() {
            let _ = GlobalFree(Some(allocation));
            return Err(windows_error("clipboard.writeText"));
        }
        ptr::copy_nonoverlapping(encoded.as_ptr().cast::<u8>(), destination.cast(), byte_len);
        let _ = windows::Win32::System::Memory::GlobalUnlock(allocation);
        if SetClipboardData(CF_UNICODETEXT.0 as u32, Some(HANDLE(allocation.0))).is_err() {
            let _ = GlobalFree(Some(allocation));
            return Err(windows_error("clipboard.writeText"));
        }
    }
    Ok(())
}

pub fn open_external(url: &str) -> RuntimeResult<()> {
    let operation = wide("open");
    let target = wide(url);
    // SAFETY: only hard-coded destinations reach this function and the other
    // ShellExecuteW parameters are null.
    let result = unsafe {
        ShellExecuteW(
            Some(HWND::default()),
            PCWSTR(operation.as_ptr()),
            PCWSTR(target.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize <= 32 {
        return Err(windows_error("external.open"));
    }
    Ok(())
}

pub fn confirm_custom_endpoint(origin: &str) -> bool {
    let title = wide("StoryForge 自定义 AI 服务授权");
    let message = wide(format!(
        "是否允许 StoryForge 向以下自定义 HTTPS 服务发送提示词和模型参数？\n\n{origin}\n\n授权将保存在当前桌面身份中。"
    ));
    // SAFETY: the backing UTF-16 buffers live through the synchronous call.
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(message.as_ptr()),
            PCWSTR(title.as_ptr()),
            MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2,
        ) == IDYES
    }
}

pub fn atomic_replace(
    temporary: &std::path::Path,
    destination: &std::path::Path,
) -> RuntimeResult<()> {
    if !destination.exists() {
        return std::fs::rename(temporary, destination)
            .map_err(|error| RuntimeError::io("files.finishWrite", &error));
    }
    let destination = wide(destination.as_os_str());
    let temporary = wide(temporary.as_os_str());
    // SAFETY: both paths are nul-terminated and valid through the synchronous call.
    unsafe {
        ReplaceFileW(
            PCWSTR(destination.as_ptr()),
            PCWSTR(temporary.as_ptr()),
            PCWSTR::null(),
            REPLACE_FILE_FLAGS(0),
            None,
            None,
        )
    }
    .map_err(|_| windows_error("files.finishWrite"))
}

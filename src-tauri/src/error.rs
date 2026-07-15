use serde::Serialize;
use std::{fmt, io};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RuntimeErrorCode {
    Aborted,
    Cancelled,
    Timeout,
    PermissionDenied,
    DiskFull,
    Unavailable,
    #[allow(dead_code)]
    Unsupported,
    InvalidInput,
    NotFound,
    Busy,
    Network,
    RemoteError,
    IntegrityError,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeError {
    pub code: RuntimeErrorCode,
    pub message: String,
    pub operation: String,
    pub retryable: bool,
}

impl RuntimeError {
    pub fn new(
        code: RuntimeErrorCode,
        message: impl Into<String>,
        operation: impl Into<String>,
    ) -> Self {
        Self {
            code,
            message: message.into(),
            operation: operation.into(),
            retryable: false,
        }
    }

    pub fn retryable(mut self) -> Self {
        self.retryable = true;
        self
    }

    pub fn io(operation: &'static str, error: &io::Error) -> Self {
        let code = match error.kind() {
            io::ErrorKind::NotFound => RuntimeErrorCode::NotFound,
            io::ErrorKind::PermissionDenied => RuntimeErrorCode::PermissionDenied,
            io::ErrorKind::StorageFull => RuntimeErrorCode::DiskFull,
            io::ErrorKind::TimedOut => RuntimeErrorCode::Timeout,
            _ => RuntimeErrorCode::Unknown,
        };
        Self::new(code, "本地运行时操作失败", operation)
    }
}

impl fmt::Display for RuntimeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for RuntimeError {}

pub type RuntimeResult<T> = Result<T, RuntimeError>;

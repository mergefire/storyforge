export function prepareRecordForMigration(table: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const row = { ...(value as Record<string, unknown>) }
  if (table === 'importSessions') {
    if (row.status === 'running' || row.status === 'pending') row.status = 'paused'
    if (Array.isArray(row.chunks)) {
      row.chunks = row.chunks.map(chunk => chunk && typeof chunk === 'object'
        ? {
            ...(chunk as Record<string, unknown>),
            status: (chunk as { status?: unknown }).status === 'running'
              ? 'pending'
              : (chunk as { status?: unknown }).status,
          }
        : chunk)
    }
  } else if (table === 'importJobs' && row.status === 'parsing') {
    row.status = 'failed'
    row.errorMessage = '迁移后已暂停，请人工复核后重新执行'
  }
  return row
}

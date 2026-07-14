/** Shared source-document constraints used before either runtime I/O or parsing. */
export const FILE_SIZE_LIMITS = {
  txt: 5 * 1024 * 1024,
  md: 5 * 1024 * 1024,
  csv: 2 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  docx: 10 * 1024 * 1024,
} as const

export type SupportedExt = keyof typeof FILE_SIZE_LIMITS

export const UNSUPPORTED_EXTS = ['doc'] as const

export const ACCEPT_ATTR = '.txt,.md,.csv,.pdf,.docx'

export const FILE_LIMIT_HINTS: Array<{ ext: string; label: string; mb: number }> = [
  { ext: 'txt', label: '纯文本', mb: FILE_SIZE_LIMITS.txt / 1024 / 1024 },
  { ext: 'md', label: 'Markdown', mb: FILE_SIZE_LIMITS.md / 1024 / 1024 },
  { ext: 'csv', label: 'CSV', mb: FILE_SIZE_LIMITS.csv / 1024 / 1024 },
  { ext: 'pdf', label: 'PDF', mb: FILE_SIZE_LIMITS.pdf / 1024 / 1024 },
  { ext: 'docx', label: 'Word', mb: FILE_SIZE_LIMITS.docx / 1024 / 1024 },
]

export function sourceDocumentPolicy(filename: string): {
  ext: SupportedExt
  limit: number
} | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!(ext in FILE_SIZE_LIMITS)) return null
  const supportedExt = ext as SupportedExt
  return { ext: supportedExt, limit: FILE_SIZE_LIMITS[supportedExt] }
}

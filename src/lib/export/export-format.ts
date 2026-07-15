export const PROJECT_EXPORT_VERSION = 4
export const NESTED_REF_ENCODING = 'export-index-v1' as const

export type NestedRefEncoding = typeof NESTED_REF_ENCODING

export interface ExportFormatHeader {
  version: number
  nestedRefEncoding?: string
}

/**
 * v1-v3 stored nested database IDs without enough metadata to remap them.
 * Only the currently supported v4 format with the explicit marker may interpret
 * nested numbers as export indexes. Future versions fail closed to avoid silently
 * importing fields whose semantics this client does not understand.
 */
export function usesPortableNestedReferences(header: ExportFormatHeader): boolean {
  if (!Number.isSafeInteger(header.version) || header.version < 1) {
    throw new Error('[export-format] invalid export version')
  }
  if (header.version < PROJECT_EXPORT_VERSION) {
    if (header.nestedRefEncoding !== undefined) {
      throw new Error('[export-format] legacy exports must not declare nestedRefEncoding')
    }
    return false
  }
  if (header.version > PROJECT_EXPORT_VERSION) {
    throw new Error(`[export-format] unsupported export version ${header.version}`)
  }
  if (header.nestedRefEncoding !== NESTED_REF_ENCODING) {
    throw new Error(
      `[export-format] version ${header.version} requires nestedRefEncoding=${NESTED_REF_ENCODING}`,
    )
  }
  return true
}

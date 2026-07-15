import {
  getRuntime,
  type OpenedFile,
  type OpenFilePurpose,
  type RuntimeOutcome,
  type SaveFilePurpose,
} from '../runtime'

/** Decode an adapter-owned byte payload with the same UTF-8 semantics as File.text(). */
export function decodeRuntimeFileText(file: OpenedFile): string {
  return new TextDecoder().decode(file.bytes)
}

/** Recreate a browser File only for existing shared parsers and Blob persistence. */
export function runtimeFileAsBrowserFile(file: OpenedFile): File {
  return new File([file.bytes.slice().buffer], file.name, { type: file.mediaType })
}

export function openRuntimeFile(
  purpose: OpenFilePurpose,
): Promise<RuntimeOutcome<OpenedFile>> {
  return getRuntime().files.open({ purpose })
}

/** Preserve browser-download compatibility for user-authored names before adapter validation. */
export function runtimeSafeSuggestedName(suggestedName: string): string {
  return suggestedName.replace(/[\\/\0]/g, '-')
}

export function saveRuntimeText(
  purpose: SaveFilePurpose,
  suggestedName: string,
  text: string,
): Promise<RuntimeOutcome<{ displayName: string }>> {
  return getRuntime().files.save({
    purpose,
    suggestedName: runtimeSafeSuggestedName(suggestedName),
    content: { kind: 'text', text },
  })
}

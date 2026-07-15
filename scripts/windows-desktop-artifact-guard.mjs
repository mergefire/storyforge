import fs from 'node:fs'
import path from 'node:path'

export const DESKTOP_DEV_IDENTITY = 'io.github.yuanbw2025.storyforge.dev'
export const DESKTOP_STABLE_IDENTITY = 'io.github.yuanbw2025.storyforge'

const DEV_OVERRIDE_MARKER = 'STORYFORGE_DEV_WEBVIEW2_USER_DATA_FOLDER'

export function inspectDesktopArtifact(filePath) {
  const resolvedPath = path.resolve(filePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`[desktop-artifact-guard] executable not found: ${resolvedPath}`)
  }

  const executableBytes = fs.readFileSync(resolvedPath)
  return {
    path: resolvedPath,
    hasDevIdentity: executableBytes.includes(Buffer.from(DESKTOP_DEV_IDENTITY, 'utf8')),
    hasStableIdentity: executableBytes.includes(Buffer.from(DESKTOP_STABLE_IDENTITY, 'utf8')),
    hasDevOverrideMarker: executableBytes.includes(Buffer.from(DEV_OVERRIDE_MARKER, 'utf8')),
  }
}

export function assertDevIdentityExecutable(filePath) {
  const artifact = inspectDesktopArtifact(filePath)
  if (!artifact.hasDevIdentity || !artifact.hasDevOverrideMarker) {
    throw new Error(
      `[desktop-artifact-guard] refusing to launch CDP smoke against a non-dev executable: ${artifact.path}`,
    )
  }
  return artifact
}

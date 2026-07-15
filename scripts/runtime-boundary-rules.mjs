/** Browser/native selection primitives that must stay behind RuntimeAdapter. */
export const BROWSER_RUNTIME_RULES = [
  ['network fetch alias', /\b[$A-Z_a-z][$\w]*\s*=\s*(?:\(\s*)?fetch\b/g],
  ['network fetch', /(?:(?:globalThis|window)\s*(?:(?:\?\.|\.)\s*fetch|(?:\?\.)?\s*\[\s*['"]fetch['"]\s*\])|\bfetch)\s*(?:\?\.)?\s*\(/g],
  ['network fetch reference', /\b(?:globalThis|window)\s*(?:(?:\?\.|\.)\s*fetch|(?:\?\.)?\s*\[\s*['"]fetch['"]\s*\])/g],
  ['network constructor', /\b(?:new\s+)?(?:XMLHttpRequest|WebSocket|EventSource)\s*\(/g],
  ['network beacon', /\bnavigator\s*(?:(?:\?\.|\.)\s*sendBeacon|(?:\?\.)?\s*\[\s*['"]sendBeacon['"]\s*\])\s*(?:\?\.)?\s*\(/g],
  ['file picker', /\b(?:showOpenFilePicker|showSaveFilePicker|showDirectoryPicker)\s*(?:\?\.)?\s*\(/g],
  ['Blob download URL', /\bURL\s*(?:\?\.|\.)\s*createObjectURL\s*(?:\?\.)?\s*\(/g],
  ['browser clipboard/storage/service worker', /\bnavigator\s*(?:(?:\?\.|\.)\s*(?:clipboard|storage|serviceWorker)|(?:\?\.)?\s*\[\s*['"](?:clipboard|storage|serviceWorker)['"]\s*\])/g],
  ['external window', /\bwindow\s*(?:(?:\?\.|\.)\s*open|(?:\?\.)?\s*\[\s*['"]open['"]\s*\])\s*(?:\?\.)?\s*\(/g],
  ['external location navigation', /\b(?:(?:window|document)\s*(?:\?\.|\.)\s*)?location\s*(?:(?:\?\.|\.)\s*(?:assign|replace)\s*(?:\?\.)?\s*\(|(?:\?\.|\.)\s*href\s*=|(?:\?\.)?\s*\[\s*['"](?:assign|replace)['"]\s*\]\s*(?:\?\.)?\s*\(|(?:\?\.)?\s*\[\s*['"]href['"]\s*\]\s*=)/g],
  ['external anchor', /\btarget\s*=\s*['"]_blank['"]/g],
  ['dynamic download anchor', /\bdocument\s*(?:\?\.|\.)\s*createElement\s*\(\s*['"]a['"]\s*\)/g],
  ['browser file input', /(?:\btype\s*=\s*['"]file['"]|\bsetAttribute\s*\(\s*['"]type['"]\s*,\s*['"]file['"]\s*\))/g],
]

export const RUNTIME_TARGET_BRANCH_RULES = [
  ['runtime target selector', /\b(?:VITE_RUNTIME_TARGET|readRuntimeTarget|selectRuntimeAdapter)\b/g],
  ['runtime kind branch', /\bgetRuntime\s*\(\s*\)\s*(?:(?:\?\.|\.)\s*kind|(?:\?\.)?\s*\[\s*['"]kind['"]\s*\])/g],
]

function lineIsComment(source, index) {
  const start = source.lastIndexOf('\n', index) + 1
  const end = source.indexOf('\n', index)
  const line = source.slice(start, end < 0 ? source.length : end).trim()
  return line.startsWith('//') || line.startsWith('*')
}

function scan(source, rules) {
  const matches = []
  for (const [label, pattern] of rules) {
    for (const match of source.matchAll(new RegExp(pattern.source, pattern.flags))) {
      if (lineIsComment(source, match.index)) continue
      matches.push({ label, index: match.index, text: match[0] })
    }
  }
  return matches
}

export function findBrowserRuntimeViolations(source) {
  return scan(source, BROWSER_RUNTIME_RULES)
}

export function findRuntimeTargetBranchViolations(source) {
  return scan(source, RUNTIME_TARGET_BRANCH_RULES)
}

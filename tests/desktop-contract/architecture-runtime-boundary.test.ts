import { describe, expect, it } from 'vitest'
// @ts-expect-error The production architecture checker is an intentionally plain Node ESM module.
import {
  findBrowserRuntimeViolations,
  findRuntimeTargetBranchViolations,
} from '../../scripts/runtime-boundary-rules.mjs'

describe('D0.3 runtime architecture boundary guard', () => {
  it.each([
    ['optional fetch', 'window.fetch?.("/api")'],
    ['bracket fetch', 'window["fetch"]("/api")'],
    ['aliased fetch reference', 'const request = globalThis.fetch; request("/api")'],
    ['bare aliased fetch reference', 'const request = fetch; request("/api")'],
    ['save picker', 'showSaveFilePicker()'],
    ['XHR', 'new XMLHttpRequest()'],
    ['WebSocket', 'new WebSocket("wss://example.test")'],
    ['EventSource', 'new EventSource("/events")'],
    ['beacon', 'navigator.sendBeacon("/log", body)'],
    ['bracket external window', 'window["open"]("https://example.test")'],
    ['location assign', 'window.location.assign("https://example.test")'],
    ['location href', 'location.href = "https://example.test"'],
  ])('catches browser capability bypass: %s', (_name, source) => {
    expect(findBrowserRuntimeViolations(source)).not.toHaveLength(0)
  })

  it.each([
    ['env selector', 'if (import.meta.env.VITE_RUNTIME_TARGET === "tauri") {}'],
    ['selector helper', 'selectRuntimeAdapter(readRuntimeTarget())'],
    ['kind property', 'if (getRuntime().kind === "web") {}'],
    ['kind bracket', 'if (getRuntime()["kind"] === "tauri") {}'],
  ])('catches scattered runtime target branching: %s', (_name, source) => {
    expect(findRuntimeTargetBranchViolations(source)).not.toHaveLength(0)
  })

  it('ignores an ordinary line comment', () => {
    expect(findBrowserRuntimeViolations('// fetch("documentation example")')).toHaveLength(0)
  })
})

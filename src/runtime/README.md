# RuntimeAdapter boundary

This directory is the only TypeScript boundary for capabilities that differ
between the Web/PWA and Windows client. It is infrastructure only: it does not
own StoryForge prompts, adoption rules, project schemas, or table lifecycles.

## Four-question result

1. AI reads remain in `CONTEXT_SOURCES/assembleContext`; `ai.execute` receives
   only the body already assembled by shared TypeScript.
2. AI writes remain in `FIELD_REGISTRY/AdoptionSchema/adopt`; no runtime
   capability writes a project field.
3. Project backup/export DTOs remain derived from `PROJECT_TABLES`; file and
   Gist capabilities only move bytes.
4. No new table, field, context source, or AI action is introduced, so the
   three registries are intentionally unchanged.

## Contract rules

- There is no generic network request, HTTP method, header bag, filesystem
  path, shell command, or IPC invocation in `RuntimeAdapter`. AI is the sole
  capability carrying its user-configured base URL, paired with a closed
  chat/embedding operation. To preserve existing browser configurations, Web
  accepts the 12 exact Vite proxy base aliases and configured HTTP/HTTPS origins,
  including LAN endpoints; it still rejects userinfo, non-HTTP(S),
  protocol-relative URLs, and unknown aliases. Native custom origins require an
  `approvalId` plus the stricter private-network policy implemented with D1/D3.
- AI requests identify a provider profile, its exact configured base URL, and
  a fixed operation.
  Prompt/body construction, SSE parsing, retry/backoff, token usage, logging,
  and adoption all stay in shared TypeScript.
- AI, Gist API, and Gist raw requests use `redirect: 'error'`; request bodies and
  credentials are never implicitly forwarded to a redirected origin. A
  truncated raw file is accepted only from the exact default-port
  `https://gist.githubusercontent.com` origin without userinfo.
- File open and save use separate closed purpose unions; each purpose fixes its
  accepted extensions/media type inside the adapter. Directory operations use
  an opaque `bindingId`, never an operating-system path. Web file open falls
  back to a fixed-accept `<input type="file">` when File System Access pickers
  are unavailable and validates the selected file's real extension.
- `SecretStore.put` is the only plaintext input and returns an opaque
  `CredentialId`; `has/reference/delete` never reveal a value. AI/Gist receive
  only that ID, and a native adapter must never return plaintext to the renderer.
  Each ID is bound to its exact capability, provider profile, operation, and
  configured origin; cross-service/profile/origin reuse is rejected.
- Clipboard and external links use closed purpose/destination unions.
  Diagnostics are a stable discriminated union with per-event fields, not a
  generic code/metadata bag.
- A Tauri-target build without an explicitly registered Tauri adapter fails
  closed. It never falls back to the Web implementation.

## D0.3 takeover state

Status: **PASS — INDEPENDENT REVIEW COMPLETE**. The source-level D0.3
completion criterion is met: every inventoried browser-only capability has one
owner, and production business code has no direct fetch, File System Access,
clipboard, storage-persistence, Service Worker, external-window, browser file
input/download-anchor, or Tauri call. `scripts/check-architecture.mjs` now makes
that boundary a failing build rule. Independent review approved the stable tree
with no P0/P1 or D0.3-introduced P2 blocker. This status is not a claim that the
native Tauri/Rust implementation or Windows client exists yet.

Routed through this boundary:

- AI streaming/non-streaming chat, connection test, and embeddings while
  preserving shared SSE parsing, retries, timeouts, usage accounting, and abort;
- GitHub Gist validate/create/update/list/read/history transport;
- all current file opens and outputs, including project/context exports,
  pre-destructive backup, fact/state/prompt/inspiration exports, map PNG bytes,
  source/reference/prompt imports, and ImportDoc;
- opaque folder binding, automatic backup, backup discovery, and restore;
- the two production clipboard writes;
- GitHub token/repository external destinations, storage durability, Web update
  lifecycle, and distribution metadata;
- Web wrappers and Fake implementations for every contract capability;
- architecture guards confining Web-only capabilities to `runtime/web` and
  future Tauri imports to `runtime/tauri`, including alternate network APIs and
  scattered runtime-target branches;
- source-document size rejection before allocation, delayed fallback-picker
  cancellation, atomic backup rollback, and lazy per-file backup restore that
  skips an unreadable candidate without retaining every raw backup in memory.

Non-secret UI preferences and business drafts in `localStorage` are not native
capabilities by themselves. They remain part of WebView profile migration and
must not be swept into `SecretStore`.

Formal Tauri commands/channels, Windows Credential Manager, native filesystem
implementation, updater/signing, packaged-client smoke, and WebView profile
migration belong to D1–D4. The Tauri target continues to fail closed until an
adapter is explicitly registered.

## Testing

`tests/desktop-contract/` covers contract shape, Fake success/cancellation,
AbortSignal, timeout, permission and disk failures, plus Web delegation. Tauri
command/channel tests are added only after D1 establishes the formal shell.

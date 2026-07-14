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
- Clipboard and external links use closed purpose/destination unions.
  Diagnostics are a stable discriminated union with per-event fields, not a
  generic code/metadata bag.
- A Tauri-target build without an explicitly registered Tauri adapter fails
  closed. It never falls back to the Web implementation.

## D0.3 takeover state

Status: **IN PROGRESS**. The contract, Web/Fake implementations, denial tests,
and first safe caller migrations are complete. D0.3 is not recorded as PASS
while the explicitly listed historical calls below remain outside the boundary.

Already routed through this boundary:

- GitHub Gist validate/create/update/list/read/history transport;
- project JSON, Markdown, TXT, and context-snapshot file output;
- the two production clipboard writes;
- Web wrappers and Fake implementations for all contract capabilities;
- architecture guard preventing Tauri imports outside `runtime/tauri`.

Historical browser calls that remain reachable are deliberately enumerated
below. Their contract exists now, but replacing each UI caller is assigned to
the implementation task that can run both Web and real Windows smoke tests:

| Remaining call group | Current files | Takeover/checker activation |
| --- | --- | --- |
| AI fetch/stream/test/embedding | `lib/ai/client.ts`, `lib/ai/adapters/embedding-adapter.ts`, `stores/ai-config.ts` | D1.4 proves the byte-stream IPC; D3.1 switches callers and then bans direct AI `fetch` |
| Folder binding/automatic backup/restore | `lib/storage/folder-backup.ts`, `lib/storage/folder-handle-store.ts`, `components/data/DataManagementPanel.tsx`, `hooks/useFolderAutoBackup.ts`, `pages/HomePage.tsx` | D3.3 switches from browser handles to opaque `bindingId`; then bans FSA outside `runtime/web` |
| Other Blob/anchor exports | fact memory, state cards, map image, inspiration, prompt template/workflow manager, pre-operation safety backup | Each caller moves to its frozen `SaveFilePurpose` during D1.4/D3.3; then bans `createObjectURL` outside `runtime/web` |
| External anchors | repository link and GitHub Gist-token link | D3.4 routes both through the closed destination union; then bans renderer `_blank` navigation |
| Plaintext AI/Gist secrets in Web storage | `stores/ai-config.ts`, `stores/gist.ts` | D2 migrates settings; D3.2 moves Windows secrets to Credential Manager and verifies no plaintext-return command |

Non-secret UI preferences and business drafts in `localStorage` are not native
capabilities by themselves. They remain part of WebView profile migration and
must not be swept into `SecretStore`.

## Testing

`tests/desktop-contract/` covers contract shape, Fake success/cancellation,
AbortSignal, timeout, permission and disk failures, plus Web delegation. Tauri
command/channel tests are added only after D1 establishes the formal shell.

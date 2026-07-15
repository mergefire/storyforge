# Tauri runtime adapter

M1 registers a deliberately restricted native adapter. AI/Embedding and Gist
use closed operations with byte streaming and cancellation; secrets return only
opaque Credential Manager references; file and backup commands accept purposes,
safe names, opaque bindings, and bounded chunks instead of renderer paths;
clipboard and external links use fixed purpose/destination unions. Diagnostics
are bounded and redacted, and stable capabilities remain `core:default` only.

Synthetic fixture commands exist only behind the `dev-identity` Cargo feature.
The stable handler list is an exact allowlist checked by
`scripts/check-desktop-shell.mjs`.

Do not copy the experimental `tmp/tauri-poc` proxy. In particular, no Tauri
command may accept an arbitrary URL, HTTP method, local path, shell command, or
plaintext-secret read request.

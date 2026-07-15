# Tauri shell adapter

D1.1 registers a deliberately restricted adapter so the desktop build can
bootstrap without pretending to be Web. Distribution metadata, diagnostics and
no-op update initialization are available; network, secret, file, clipboard,
external-link and durability capabilities fail closed with `UNAVAILABLE` until
their scoped native implementations land in D1.4/D3.

Do not copy the experimental `tmp/tauri-poc` proxy. In particular, no Tauri
command may accept an arbitrary URL, HTTP method, local path, shell command, or
plaintext-secret read request.

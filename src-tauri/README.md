# Commit Warrior — desktop app (Rust + Tauri)

The Windows app is a Tauri v2 shell around the same frontend used by the website (`public/`).
The difference is the backend: instead of the Node/Express server, `src-tauri/src/` is a Rust
implementation of the GitHub stats API, exposed to the webview as Tauri commands.

## Why this shape

- **One frontend** — `public/index.html`, `app.js`, `styles.css` are shared. `public/bridge.js`
  detects Tauri and calls Rust commands instead of `fetch('/api/...')`.
- **Real Rust backend** — `github.rs` (HTTP + cache + calendar parsing), `signals.rs`
  (rank/streak/insights), and `cards.rs` (SVG cards) are ports of the Node modules.
- **Scales to widgets** — the command layer is the seam a tray app or desktop widget can
  talk to later; the cache and data model live in Rust, not in the webview.

## Build

Requires Rust (1.88+) and the WebView2 runtime (present on Windows 10/11).

```powershell
cargo install tauri-cli --version "^2"   # once
cargo tauri dev                           # debug window
cargo tauri build                         # NSIS installer + unpacked exe
```

Artifacts land in `target/release/bundle/`.

## Environment

- `GITHUB_TOKEN` / `GH_TOKEN` — optional; raises GitHub rate limits.
- `PUBLIC_BASE_URL` — the public host used in generated README markdown
  (default `https://commit-warrior.vercel.app`).

## Tests

```powershell
cargo test
```

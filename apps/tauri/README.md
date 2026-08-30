# Natalia Tauri Desktop (preparation)

This directory will host the Tauri desktop shell. The plan is:

- Reuse the existing Web UI (packages/plugins/ui/web)
- Replace HTTP/SSE transport with Tauri IPC
- Move session/browser/terminal backend into Rust Tauri commands
- Keep the same RuntimeClient interface on the frontend

Placeholder only for now.

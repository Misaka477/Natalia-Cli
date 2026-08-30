#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Workaround for WebKitGTK + Fcitx5/Kimpanel on Wayland: the Wayland
    // text-input path can make the IME candidate UI flicker or fall back to
    // a different skin. Running the GTK app through XWayland keeps the
    // desktop-specific IME integration stable on Linux.
    #[cfg(target_os = "linux")]
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }

    natalia_desktop_lib::run();
}

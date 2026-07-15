use crate::command_runner;
use crate::terminal::enrich_terminal_windows;
use crate::windowing::registry::BackendProbe;
use crate::windowing::types::{WindowBounds, WindowInfo};
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::fs;
use std::os::unix::fs::{FileTypeExt, MetadataExt};
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use std::time::SystemTime;
use tokio::process::Command;

pub const NIRI_BACKEND: &str = "niri";

pub fn probe() -> BackendProbe {
    match niri_output(&["msg", "--json", "windows"]) {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let ok = matches!(
                serde_json::from_str::<serde_json::Value>(&stdout),
                Ok(serde_json::Value::Array(_))
            );
            BackendProbe {
                id: NIRI_BACKEND,
                ok,
                can_list_windows: ok,
                can_focus_apps: ok,
                can_focus_windows: ok,
                detail: if ok {
                    "niri msg --json windows returned a JSON array".to_string()
                } else {
                    "niri msg --json windows did not return a JSON array".to_string()
                },
            }
        }
        Ok(output) => BackendProbe {
            id: NIRI_BACKEND,
            ok: false,
            can_list_windows: false,
            can_focus_apps: false,
            can_focus_windows: false,
            detail: command_failure_detail(&output),
        },
        Err(error) => BackendProbe {
            id: NIRI_BACKEND,
            ok: false,
            can_list_windows: false,
            can_focus_apps: false,
            can_focus_windows: false,
            detail: error.to_string(),
        },
    }
}

pub async fn list_windows() -> Result<Vec<WindowInfo>> {
    let output = niri_output_async(&["msg", "--json", "windows"])
        .await
        .context("failed to run niri msg --json windows")?;
    if !output.status.success() {
        bail!(
            "niri msg --json windows failed: {}",
            command_failure_detail(&output)
        );
    }

    parse_niri_windows(&String::from_utf8_lossy(&output.stdout))
}

pub(crate) fn parse_niri_windows(json: &str) -> Result<Vec<WindowInfo>> {
    let records: Vec<NiriWindow> =
        serde_json::from_str(json).context("failed to parse niri msg --json windows output")?;
    let mut windows = records
        .into_iter()
        .map(WindowInfo::from)
        .collect::<Vec<_>>();
    windows.sort_by_key(|window| window.window_id);
    enrich_terminal_windows(&mut windows);
    Ok(windows)
}

pub async fn activate_window(window_id: u64) -> Result<()> {
    let args = niri_focus_args(window_id);
    let output = niri_output_async(&args.iter().map(String::as_str).collect::<Vec<_>>())
        .await
        .with_context(|| format!("failed to focus Niri window {window_id}"))?;
    if output.status.success() {
        Ok(())
    } else {
        bail!(
            "niri msg action focus-window --id {window_id} failed: {}",
            command_failure_detail(&output)
        );
    }
}
pub fn focused_window() -> Result<Option<WindowInfo>> {
    let output = niri_output(&["msg", "--json", "focused-window"])
        .context("failed to run niri msg --json focused-window")?;
    if !output.status.success() {
        bail!(
            "niri msg --json focused-window failed: {}",
            command_failure_detail(&output)
        );
    }

    let mut window: Option<WindowInfo> =
        serde_json::from_slice::<Option<NiriWindow>>(&output.stdout)
            .context("failed to parse niri focused-window JSON")?
            .map(WindowInfo::from);
    if let Some(window) = window.as_mut() {
        window.backend = NIRI_BACKEND.to_string();
    }
    Ok(window)
}

pub(crate) fn niri_focus_args(window_id: u64) -> [String; 5] {
    [
        "msg".to_string(),
        "action".to_string(),
        "focus-window".to_string(),
        "--id".to_string(),
        window_id.to_string(),
    ]
}

fn niri_output(args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut command = StdCommand::new("niri");
    if let Some(socket) = inferred_niri_socket() {
        command.env("NIRI_SOCKET", socket);
    }
    command.args(args).output()
}

async fn niri_output_async(args: &[&str]) -> Result<std::process::Output> {
    let mut command = Command::new("niri");
    if let Some(socket) = inferred_niri_socket() {
        command.env("NIRI_SOCKET", socket);
    }
    command.args(args);
    command_runner::output(command, "run niri IPC command").await
}

fn inferred_niri_socket() -> Option<PathBuf> {
    if std::env::var("NIRI_SOCKET")
        .ok()
        .is_some_and(|value| !value.trim().is_empty())
    {
        return None;
    }
    infer_niri_socket()
}

fn infer_niri_socket() -> Option<PathBuf> {
    let runtime = xdg_runtime_dir()?;
    let wayland_display = std::env::var("WAYLAND_DISPLAY").ok();
    let candidates = fs::read_dir(runtime)
        .ok()?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            niri_socket_candidate(&path, wayland_display.as_deref())
        })
        .collect::<Vec<_>>();

    select_niri_socket(candidates).map(|candidate| candidate.path)
}

fn niri_socket_candidate(
    path: &Path,
    wayland_display: Option<&str>,
) -> Option<NiriSocketCandidate> {
    let file_name = path.file_name()?.to_string_lossy();
    if !file_name.starts_with("niri.") || !file_name.ends_with(".sock") {
        return None;
    }
    let metadata = path.metadata().ok()?;
    if !metadata.file_type().is_socket() {
        return None;
    }

    let wayland_display_matches = wayland_display.is_some_and(|display| {
        let expected = format!("niri.{display}.");
        file_name.starts_with(&expected)
    });
    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);

    Some(NiriSocketCandidate {
        path: path.to_path_buf(),
        wayland_display_matches,
        modified,
    })
}

fn select_niri_socket(candidates: Vec<NiriSocketCandidate>) -> Option<NiriSocketCandidate> {
    candidates
        .into_iter()
        .max_by_key(|candidate| (candidate.wayland_display_matches, candidate.modified))
}

fn xdg_runtime_dir() -> Option<PathBuf> {
    if let Some(value) = std::env::var_os("XDG_RUNTIME_DIR") {
        return Some(PathBuf::from(value));
    }
    let uid = fs::metadata("/proc/self").ok()?.uid();
    Some(PathBuf::from(format!("/run/user/{uid}")))
}

#[derive(Debug)]
struct NiriSocketCandidate {
    path: PathBuf,
    wayland_display_matches: bool,
    modified: SystemTime,
}

fn command_failure_detail(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        stderr
    }
}

#[derive(Debug, Deserialize)]
struct NiriWindow {
    id: u64,
    title: Option<String>,
    app_id: Option<String>,
    pid: Option<i64>,
    workspace_id: Option<u64>,
    #[serde(default)]
    is_focused: bool,
    layout: Option<NiriWindowLayout>,
}

#[derive(Debug, Deserialize)]
struct NiriWindowLayout {
    tile_size: Option<[f64; 2]>,
    window_size: Option<[u32; 2]>,
    tile_pos_in_workspace_view: Option<[f64; 2]>,
}

impl From<NiriWindow> for WindowInfo {
    fn from(window: NiriWindow) -> Self {
        let bounds = window.layout.as_ref().and_then(niri_window_bounds);
        let app_id = clean_string(window.app_id);

        Self {
            window_id: window.id,
            title: clean_string(window.title),
            app_id: app_id.clone(),
            wm_class: app_id,
            pid: window.pid.and_then(|pid| u32::try_from(pid).ok()),
            bounds,
            workspace: window
                .workspace_id
                .and_then(|workspace| i32::try_from(workspace).ok()),
            focused: window.is_focused,
            hidden: false,
            client_type: None,
            backend: NIRI_BACKEND.to_string(),
            terminal: None,
        }
    }
}

fn niri_window_bounds(layout: &NiriWindowLayout) -> Option<WindowBounds> {
    let [width, height] = layout.window_size.or_else(|| {
        layout
            .tile_size
            .map(|[width, height]| [width as u32, height as u32])
    })?;
    let width = width.try_into().ok().filter(|v: &u32| *v > 0)?;
    let height = height.try_into().ok().filter(|v: &u32| *v > 0)?;
    let [x, y] = layout
        .tile_pos_in_workspace_view
        .map(|[x, y]| [Some(x.round() as i32), Some(y.round() as i32)])
        .unwrap_or([None, None]);

    Some(WindowBounds {
        x,
        y,
        width,
        height,
    })
}

fn clean_string(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn selects_wayland_matching_niri_socket_before_newer_nonmatch() {
        let older_match = NiriSocketCandidate {
            path: PathBuf::from("/run/user/1000/niri.wayland-1.100.sock"),
            wayland_display_matches: true,
            modified: SystemTime::UNIX_EPOCH,
        };
        let newer_nonmatch = NiriSocketCandidate {
            path: PathBuf::from("/run/user/1000/niri.wayland-2.200.sock"),
            wayland_display_matches: false,
            modified: SystemTime::UNIX_EPOCH + Duration::from_secs(10),
        };

        let selected = select_niri_socket(vec![older_match, newer_nonmatch]).unwrap();

        assert_eq!(
            selected.path,
            PathBuf::from("/run/user/1000/niri.wayland-1.100.sock")
        );
    }

    #[test]
    fn selects_newest_niri_socket_without_wayland_match() {
        let older = NiriSocketCandidate {
            path: PathBuf::from("/run/user/1000/niri.wayland-1.100.sock"),
            wayland_display_matches: false,
            modified: SystemTime::UNIX_EPOCH,
        };
        let newer = NiriSocketCandidate {
            path: PathBuf::from("/run/user/1000/niri.wayland-2.200.sock"),
            wayland_display_matches: false,
            modified: SystemTime::UNIX_EPOCH + Duration::from_secs(10),
        };

        let selected = select_niri_socket(vec![older, newer]).unwrap();

        assert_eq!(
            selected.path,
            PathBuf::from("/run/user/1000/niri.wayland-2.200.sock")
        );
    }

    #[test]
    fn parses_niri_window_json() {
        let windows = parse_niri_windows(
            r#"[
                {
                    "id": 14,
                    "title": "Codex",
                    "app_id": "codex-desktop",
                    "pid": 16589,
                    "workspace_id": 3,
                    "is_focused": false,
                    "is_floating": false,
                    "layout": {
                        "pos_in_scrolling_layout": [3, 1],
                        "tile_size": [1888.0, 994.0],
                        "window_size": [1888, 994],
                        "tile_pos_in_workspace_view": null
                    }
                },
                {
                    "id": 2,
                    "title": "tns /m/m/M/g/codex-desktop-linux",
                    "app_id": "Alacritty",
                    "pid": 1877,
                    "workspace_id": 3,
                    "is_focused": true,
                    "is_floating": false,
                    "layout": {
                        "pos_in_scrolling_layout": [2, 1],
                        "tile_size": [1888.0, 994.0],
                        "window_size": [1888, 994],
                        "tile_pos_in_workspace_view": null
                    }
                }
            ]"#,
        )
        .unwrap();

        assert_eq!(windows.len(), 2);
        assert_eq!(windows[0].window_id, 2);
        assert_eq!(windows[0].app_id.as_deref(), Some("Alacritty"));
        assert_eq!(windows[0].pid, Some(1877));
        assert_eq!(windows[0].workspace, Some(3));
        assert!(windows[0].focused);
        assert_eq!(windows[0].bounds.as_ref().unwrap().width, 1888);
        assert_eq!(windows[0].bounds.as_ref().unwrap().x, None);
        assert_eq!(windows[0].client_type, None);
        assert_eq!(windows[0].backend, NIRI_BACKEND);
    }

    #[test]
    fn parses_niri_workspace_view_position() {
        let windows = parse_niri_windows(
            r#"[
                {
                    "id": 3,
                    "title": "Dialog",
                    "app_id": "example",
                    "layout": {
                        "tile_size": [500.0, 400.0],
                        "tile_pos_in_workspace_view": [12.5, 20.2]
                    }
                }
            ]"#,
        )
        .unwrap();

        assert_eq!(windows[0].bounds.as_ref().unwrap().x, Some(13));
        assert_eq!(windows[0].bounds.as_ref().unwrap().y, Some(20));
        assert_eq!(windows[0].client_type, None);
    }
}

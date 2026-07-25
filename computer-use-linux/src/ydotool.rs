use std::{
    env, fs,
    os::unix::net::UnixDatagram,
    path::{Path, PathBuf},
    process::{self, Command, Stdio},
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CliGeneration {
    RawEvents,
    LegacyNamed,
}

const UNSUPPORTED_MESSAGE: &str = "unsupported ydotool CLI; Computer Use requires ydotool 1.0.2 or newer with raw key events, wheel movement, stdin typing, and absolute mouse movement";

struct ProbeSocket {
    _socket: UnixDatagram,
    path: PathBuf,
}

impl ProbeSocket {
    fn bind() -> Result<Self, String> {
        let runtime_dir = env::var_os("XDG_RUNTIME_DIR")
            .ok_or_else(|| "XDG_RUNTIME_DIR is unavailable for safe ydotool probing".to_string())?;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("failed to create ydotool probe nonce: {error}"))?
            .as_nanos();
        let path = PathBuf::from(runtime_dir).join(format!(
            ".codex-ydotool-probe-{}-{nonce}.socket",
            process::id()
        ));
        let socket = UnixDatagram::bind(&path)
            .map_err(|error| format!("failed to bind isolated ydotool probe socket: {error}"))?;
        Ok(Self {
            _socket: socket,
            path,
        })
    }
}

impl Drop for ProbeSocket {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

pub(crate) fn ensure_supported() -> Result<String, String> {
    static RESULT: OnceLock<Result<String, String>> = OnceLock::new();
    RESULT.get_or_init(probe).clone()
}

fn probe() -> Result<String, String> {
    let mut output_text = String::new();
    for argument in ["help", "--help"] {
        let output = Command::new("ydotool")
            .arg(argument)
            .output()
            .map_err(|error| format!("failed to run ydotool: {error}"))?;
        output_text.push_str(&String::from_utf8_lossy(&output.stdout));
        output_text.push_str(&String::from_utf8_lossy(&output.stderr));
        if let Some(generation) = classify_help(&output_text) {
            return match generation {
                CliGeneration::RawEvents => {
                    probe_raw_semantics().map(|()| "compatible raw-event CLI detected".to_string())
                }
                CliGeneration::LegacyNamed => Err(UNSUPPORTED_MESSAGE.to_string()),
            };
        }
    }
    Err("unrecognized ydotool CLI; Computer Use requires ydotool 1.0.2 or newer".to_string())
}

fn probe_raw_semantics() -> Result<(), String> {
    let socket = ProbeSocket::bind()?;
    let wheel = run_probe_command(
        &socket.path,
        &["mousemove", "--wheel", "--", "0", "0"],
        None,
    )?;
    let type_from_stdin = run_probe_command(
        &socket.path,
        &["type", "--file", "-"],
        Some(Path::new("/proc/self/fd")),
    )?;

    if raw_semantic_probes_succeeded(
        wheel.status.success(),
        &wheel.stderr,
        type_from_stdin.status.success(),
        &type_from_stdin.stderr,
    ) {
        Ok(())
    } else {
        Err(UNSUPPORTED_MESSAGE.to_string())
    }
}

fn run_probe_command(
    socket_path: &Path,
    args: &[&str],
    current_dir: Option<&Path>,
) -> Result<std::process::Output, String> {
    let mut command = Command::new("ydotool");
    command
        .args(args)
        .env("YDOTOOL_SOCKET", socket_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(current_dir) = current_dir {
        command.current_dir(current_dir);
    }
    command
        .output()
        .map_err(|error| format!("failed to run ydotool capability probe: {error}"))
}

fn raw_semantic_probes_succeeded(
    wheel_success: bool,
    wheel_stderr: &[u8],
    type_success: bool,
    type_stderr: &[u8],
) -> bool {
    wheel_success
        && cli_error(wheel_stderr).is_none()
        && type_success
        && cli_error(type_stderr).is_none()
}

pub(crate) fn classify_help(help: &str) -> Option<CliGeneration> {
    let commands = help
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let required_raw_commands = ["click", "mousemove", "type", "key", "debug"];
    if required_raw_commands
        .iter()
        .all(|command| commands.contains(command))
    {
        Some(CliGeneration::RawEvents)
    } else if commands.contains(&"recorder") {
        Some(CliGeneration::LegacyNamed)
    } else {
        None
    }
}

pub(crate) fn cli_error(stderr: &[u8]) -> Option<String> {
    let detail = String::from_utf8_lossy(stderr).trim().to_string();
    let normalized = detail.to_ascii_lowercase();
    [
        "unrecognised option",
        "unrecognized option",
        "unknown option",
        "invalid option",
        "unknown command",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
    .then_some(detail)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_legacy_named_cli_from_ubuntu_ydotool() {
        let help = "Usage: ydotool <cmd> <args>\nAvailable commands:\n  type\n  recorder\n  mousemove\n  key\n  click\n";

        assert_eq!(classify_help(help), Some(CliGeneration::LegacyNamed));
    }

    #[test]
    fn classifies_raw_event_cli_from_current_ydotool() {
        let help = "Usage: ydotool <cmd> <args>\nAvailable commands:\n  click\n  mousemove\n  type\n  key\n  debug\n  stdin\n";

        assert_eq!(classify_help(help), Some(CliGeneration::RawEvents));
    }

    #[test]
    fn classifies_arch_1_0_4_cli_as_raw_events() {
        let help = "Usage: ydotool <cmd> <args>\nAvailable commands:\n  click\n  mousemove\n  type\n  key\n  debug\n  bakers\n";

        assert_eq!(classify_help(help), Some(CliGeneration::RawEvents));
    }

    #[test]
    fn rejects_raw_cli_without_wheel_semantics() {
        assert!(!raw_semantic_probes_succeeded(
            true,
            b"mousemove: unrecognized option '--wheel'\n",
            true,
            b"",
        ));
    }

    #[test]
    fn rejects_raw_cli_without_stdin_file_semantics() {
        assert!(!raw_semantic_probes_succeeded(
            true,
            b"",
            false,
            b"ydotool: type: error: failed to open -: No such file or directory\n",
        ));
    }

    #[test]
    fn accepts_raw_cli_with_required_semantics() {
        assert!(raw_semantic_probes_succeeded(true, b"", true, b""));
    }

    #[test]
    fn rejects_unknown_cli_shape() {
        assert_eq!(classify_help("Usage: ydotool <cmd>"), None);
    }

    #[test]
    fn recognizes_cli_errors_even_when_exit_status_is_success() {
        assert_eq!(
            cli_error(b"error: unrecognised option '--absolute'\n"),
            Some("error: unrecognised option '--absolute'".to_string())
        );
    }

    #[test]
    fn ignores_non_error_stderr() {
        assert_eq!(cli_error(b"ydotoold socket ready\n"), None);
    }
}

import sys, json, os, time, pty, select
from subprocess import check_output

result = {}

def pty_echo_latency(iterations=3):
    """Measure raw OS PTY echo latency via python pty fork."""
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("cat", ["cat"])
        sys.exit(1)
    samples = []
    for i in range(iterations):
        os.write(fd, f"echo-{i}\r".encode())
        start = time.perf_counter()
        data = b""
        deadline = time.perf_counter() + 2.0
        while time.perf_counter() < deadline:
            r, _, _ = select.select([fd], [], [], 0.05)
            if r:
                chunk = os.read(fd, 256)
                data += chunk
                if f"echo-{i}".encode() in data:
                    elapsed = (time.perf_counter() - start) * 1000
                    samples.append(elapsed)
                    break
    os.close(fd)
    os.waitpid(pid, 0)
    return samples

# Alacritty / raw PTY echo latency
echo_samples = pty_echo_latency(5)
result["raw_pty_echo"] = {
    "method": "python pty fork -> cat -> echo detection",
    "samples_ms": [round(s, 2) for s in echo_samples],
    "p50_ms": round(sorted(echo_samples)[len(echo_samples)//2], 2) if echo_samples else None,
}

# Natalia reference (from perf baseline)
result["natalia_terminal_reference"] = {
    "physical_key_pty_cat_p50_ms": 28.74,
    "viewer_write_cat_p50_ms": 31.56,
    "note": "From npm run perf:baseline — terminal_physical_key_to_real_pty_render",
}

# OpenCode devref resource check
try:
    import subprocess
    start = time.perf_counter()
    proc = subprocess.Popen(
        ["npx", "bun", "run", "--cwd", "packages/console/app", "dev"],
        cwd=os.path.join(os.path.dirname(__file__), "..", "..", "devref", "opencode"),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    # Wait for it to start and measure initial RSS
    deadline = time.perf_counter() + 15
    output = b""
    while time.perf_counter() < deadline:
        r, _, _ = select.select([proc.stderr], [], [], 0.1)
        if r:
            chunk = proc.stderr.read(4096)
            if not chunk:
                break
            output += chunk
            if b"ready" in output.lower() or b"listening" in output.lower():
                break
    elapsed = (time.perf_counter() - start) * 1000
    proc.terminate()
    proc.wait()
    result["opencode_tui"] = {
        "startup_ms": round(elapsed, 0),
        "startup_output_preview": output[:200].decode("utf-8", errors="replace"),
    }
except Exception as e:
    result["opencode_tui"] = {"error": str(e)}

print(json.dumps(result))

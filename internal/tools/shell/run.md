Execute a short shell command and return stdout, stderr, timeout, and exit status information.

Use this for bounded commands such as builds, tests, formatters, inspections, and one-shot scripts.
Do not use it for long-running servers, watch commands, or interactive programs.

Parameters:
- `command`: shell command to execute.
- `timeout`: optional timeout in seconds, default 60, maximum 600.

Output is capped to keep model context bounded. Long-running tasks should use background task tools once available.

# Television Soak-Test Runbook

Use this runbook on the computer that will drive the office television. A short local run proves the harness works; it does not replace the target-host release gate.

## Before the run

1. Start the Go API and Angular application using the production-like commands documented in `README.md`.
2. Open `/operations` and confirm the service responds. A disconnected Jira state is acceptable only when Jira is intentionally unconfigured; a configured integration should be live before release testing.
3. Close unrelated high-load applications and record the host model, operating-system version, browser/version, display resolution, and whether the machine is on external power.
4. Open Activity Monitor on macOS or Task Manager on Windows. Keep CPU, memory, and GPU columns visible.

## Recommended release run

1. Open `/diagnostics/soak.html` in Chromium, Edge, or Chrome.
2. Select **Game ↔ Office**, four hours, a 15-second sample interval, and a five-minute route cycle.
3. Start the soak and leave the browser tab visible on the television for the complete run.
4. At the start, midpoint, and end, record browser CPU, memory, GPU usage, fan behavior, visual stutter, and any display sleep or fullscreen issue.
5. Download the JSON report when the run completes and add the manual observations to its `notes` field.

An unattended run can start from:

```text
http://localhost:4200/diagnostics/soak.html?auto=1&mode=cycle&duration=240&sample=15&cycle=5
```

## Pass criteria

- The runner reports **PASS** with no canvas-lifecycle or API failures.
- Game View consistently mounts exactly one canvas and Office View releases it.
- Browser memory reaches a steady operating range instead of increasing continuously.
- CPU/GPU utilization and fan behavior remain acceptable for the target host.
- The game remains responsive, readable, and free of accumulating animation artifacts.
- Jira connection state remains truthful; stale or disconnected data is never presented as live.

The runner intentionally does not claim to measure system-wide CPU, GPU, or thermals. Those observations must be recorded from the host operating system.

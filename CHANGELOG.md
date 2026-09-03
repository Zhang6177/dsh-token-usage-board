# Changelog

All notable changes are documented here. This project follows Semantic
Versioning while DeepSeek Harness remains in developer preview.

## [0.3.0] - 2026-09-03

First public release.

### Added

- Activity dashboard for the DeepSeek Harness Web UI, opened from a
  **Usage Statistics** sidebar entry above Settings:
  - Core stats strip: total tokens, peak single-day tokens, longest chat
    duration, current / longest active-day streak.
  - Token activity over the last 53 weeks with a daily heatmap / weekly /
    monthly / cumulative toggle.
  - Activity insights: fast-mode share, top reasoning effort, skills
    explored, skill invocations, total chats.
  - Most-used skills Top 5 (ranked by run count of `skill` invocations).
  - Per-model token share ring chart with legend.
  - CSV / JSON export for archival or further analysis.
- The dashboard rides the center conversation column instead of taking over
  the full screen, and participates in the single-occupant center-column
  exclusion protocol used by the task board / cron board / ssh view: opening
  one closes the others, and one click (or Escape, or clicking a
  session/workspace row) collapses it.
- Hover feedback on every chart: a floating tooltip plus a highlight on the
  daily heat grid, the weekly / monthly bar charts, the model pie (with
  legend cross-highlighting), and the cumulative chart (crosshair with a
  running total).
- One-click install scripts shipped with the npm package:
  `scripts/install.sh` (macOS / Linux / Windows Git Bash) and
  `scripts/install.ps1` (PowerShell 5.1+). They wrap the official
  `dsh plugin --profile <name> add dsh-activity-dashboard[@version]`
  command, resolve `latest` to the current npm version when online,
  pre-write the idempotent `minimumReleaseAgeExclude` entry into the
  profile's `pnpm-workspace.yaml` (pnpm 11 release-age grace period), verify
  the bundle registration in `dsh.profile.bundles`, and offer an opt-in
  `--restart` / `-Restart` (pm2). `--dry-run` / `-DryRun` print the plan
  without touching anything.
- Read-only, same-origin data API under `/activity-dashboard/v1`
  (configurable via `apiPath`): `/snapshot`, `/calls` (paginated, with model
  / provider / token-threshold filters), `/export.csv`, `/export.json`.
  Parameters, response shapes, the error contract, and the v1 stability
  commitment are documented in `docs/API.md`.
- Chinese / English UI following the Harness language setting, plus light /
  dark theme support.

### Notes

- Every DeepSeek Harness package the plugin uses is declared as a peer
  dependency and reuses the profile's own instance, preventing plugin
  private copies and split module identity; the package check rejects
  official modules placed in regular dependencies.
- Forked subtasks count only the calls they produce themselves; context
  inherited from the parent session is not attributed to them.
- Statistics are computed on the local machine only. The index lives in
  `DSH_HOME/activity-dashboard` and never stores prompts, responses, tool
  arguments, or credentials (see `PRIVACY.md`).
- Verified on DeepSeek Harness `0.1.1-rc.2` with Node.js `22.19+` / `24+`;
  see `docs/COMPATIBILITY.md`.
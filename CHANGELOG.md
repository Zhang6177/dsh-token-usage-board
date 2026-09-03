# Changelog

All notable changes are documented here. This project follows Semantic
Versioning while DeepSeek Harness remains in developer preview.

## [0.3.0] - 2026-09-03

Open-source release: the activity-dashboard line (0.2.0–0.2.3) is published
for the first time, packaged for one-click installs, and its public data API
is documented.

### Added

- One-click install scripts shipped with the npm package:
  `scripts/install.sh` (macOS / Linux / Windows Git Bash) and
  `scripts/install.ps1` (PowerShell 5.1+). They wrap the official
  `dsh plugin --profile <name> add dsh-usage-stats[@version]` command,
  resolve `latest` to the current npm version when online, pre-write the
  idempotent `minimumReleaseAgeExclude` entry into the profile's
  `pnpm-workspace.yaml` (pnpm 11 release-age grace period), verify the
  bundle registration in `dsh.profile.bundles`, and offer an opt-in
  `--restart` / `-Restart` (pm2). `--dry-run` / `-DryRun` print the plan
  without touching anything.
- `docs/API.md`: reference for the read-only, same-origin data API
  (`/snapshot`, `/calls`, `/export.csv`, `/export.json` under the
  configurable `apiPath`, default `/usage-stats/v1`) — query parameters and
  limits, response shapes, error contract, examples, and the v1 stability
  commitment (additive changes only; breaking changes move to a new version
  path).
- README (zh + en) gain the one-line install script and the Plugin Market
  (`dshmarket`) install path, plus a short "Data API" section linking to the
  new reference.

### Changed

- Verified compatibility is extended to DeepSeek Harness `0.1.1-rc.2` (on
  top of `0.1.0-rc.6`) and Node.js `22.23.2` (on top of `24.19.0`), matching
  the environments this release was developed and exercised on.
- The English README is brought in sync with 0.2.1–0.2.3: the Top-5 ranking
  is described as skills-only ("Most used skills"), the removed
  `pluginToolExclude` option is dropped from the configuration section, and
  the panel is described as the center-column dashboard.
- `check-package` now requires the two install scripts in the published
  package and whitelists exactly those under `scripts/` (everything else
  still fails the pack check).

## [0.2.3] - 2026-09-03

### Changed

- The panel header badge copy is now `token用量` (was `应用用量`; English:
  `Token Usage`, was `App Usage`).

## [0.2.2] - 2026-09-03

### Changed

- The "Most Used Plugins" panel is now "Most Used Skills"
  (`最常用的技能`): the ranking only counts `skill` tool invocations. Regular
  tool calls (including non-built-in tools) no longer appear in the Top 5;
  they are still recorded in the local index but no longer affect the
  ranking. The snapshot field `topPlugins` is renamed `topSkills` and the
  `PluginUsage` type is renamed `SkillUsage`.

### Removed

- The `pluginToolExclude` config option (and the
  `DEFAULT_PLUGIN_TOOL_EXCLUDE` export). It only filtered tool names out of
  the plugin ranking, which no longer exists.

## [0.2.1] - 2026-09-03

### Changed

- The dashboard no longer takes over the full screen. It now rides the center
  conversation column exactly like dsh-client-ui-task-board / cron-explorer
  (an extra trailing child of the conversation column, visibility driven by an
  attribute on `<html>`, the conversation subtree staying mounted underneath).
  The sidebar entry toggles it: one click opens the panel over the
  conversation, another click (or Escape, or clicking a session/workspace row)
  collapses it. The panel participates in the single-occupant center-column
  exclusion protocol, so opening it closes the task board / cron board / ssh
  view, and activating any of those closes it in turn.

### Added

- Hover feedback on every chart, matching the "daily" token-activity grid:
  an immediate floating tooltip (shared `useFloatingTip`) plus a highlight.
  The weekly/monthly bar charts anchor the tooltip above the hovered bar (the
  whole column is the hover target, so near-zero bars still respond), the
  model pie hit-tests the conic ring under the cursor (dimming the other
  slices and highlighting the matching legend row, with legend hover driving
  the pie in reverse), and the cumulative chart adds a crosshair guide with a
  point marker and a running-total tooltip.

## [0.2.0] - 2026-09-01

### Added

- New activity dashboard: a five-stat strip (total tokens, peak single-day
  tokens, longest chat duration, current streak, longest streak), a Token
  Activity panel with daily / weekly / monthly / cumulative views over the
  last 53 weeks, an Activity Insights panel (fast-mode share, top reasoning
  effort, skills explored, skill invocations, total chats), a Most Used
  Plugins ranking, and a per-model token share pie chart.
- Per-session tool/skill invocation counters (from `tool/call` events) and
  activity spans (first/last event timestamps) in the local index, stored as
  schema 5.
- `fastModelPattern` config: a case-insensitive regex identifying fast models
  (default `flash|turbo|lite|nano|haiku|fast|mini`) used for the fast-mode
  insight.
- `pluginToolExclude` config: tool names excluded from the Most Used Plugins
  ranking; defaults to the built-in DSH tool set.

### Changed

- Replaced the previous overview / trend / call-detail dashboard with the new
  activity view. The call-detail table is no longer rendered in the UI; the
  `GET /usage-stats/v1/calls` endpoint and CSV/JSON exports remain available.
- The current active-day streak now anchors at today, falling back to
  yesterday when today has no activity yet (GitHub-style semantics).
- Rebuild schema-4 caches as schema 5; one full historical reindex runs the
  first time the plugin starts after upgrade.

## [0.1.16] - 2026-08-17

### Added

- Added a remembered call-detail retention limit, defaulting to the newest
  1,000 records with selectable limits from 100 to 10,000.
- Added a "Call Details" panel to the dashboard: a paginated per-call list
  showing end-to-end response time, input/output tokens, cache hit rate, model,
  and reasoning effort for every assistant call.
- Added the `GET /usage-stats/v1/calls` endpoint with date, scope, workspace,
  model, provider, input/output token-threshold, and pagination filters.
- Collected `durationMs` (step/start → assistant/message) and `effort`
  (request/header reasoning effort) per call, keyed per session so concurrent
  sessions never bleed timing into each other.

### Changed

- Rebuild schema-2 caches as schema 3 so historical call timing and reasoning
  effort are populated instead of remaining blank after upgrade.
- Reused filtered, time-sorted call results across pages and debounced numeric
  filters to avoid repeated full-history work during ordinary navigation.
- Preserved the existing public `appendActivity(summary, event, indexedAt)`
  signature while accepting collector state as an optional fourth argument.
- Added responsive wrapping for the call-detail toolbar.
- Persisted the latest request-header reasoning effort across subsequent calls,
  rebuilt existing call indexes, matched call filters to the workspace selector,
  remembered the selected page size (20 by default), and inherited the Harness
  font stack throughout the dashboard.
- Refined call details with aligned numeric columns, localized effort labels,
  sticky headers, exact-value hints, token-suffixed filters, contextual reset,
  and compact range pagination.
- Balanced call-detail columns with a fixed layout and rounded inset row hover.
- Kept row corner geometry stable while hover color fades out.
- Unified all call-detail columns on a shared left-aligned reading edge.
- Distributed all seven call-detail columns evenly across the available width.

### Fixed

- Moved `@deepseek-ai/dsh-home-paths` and `@deepseek-ai/schemastery` from
  regular dependencies to peer dependencies, preventing plugin-private copies
  and split module identity inside a Harness profile.
- Added a package regression check that rejects official `@deepseek-ai/*`
  modules in regular dependencies.

Thanks to [@ogj130](https://github.com/ogj130) for the initial call-detail
implementation in [#3](https://github.com/lanlandeli/dsh-usage-stats/pull/3),
and [@zhu637882-stack](https://github.com/zhu637882-stack) for reporting the
official-module duplication risk in
[#4](https://github.com/lanlandeli/dsh-usage-stats/issues/4).

## [0.1.15] - 2026-08-15

### Added

- Added Chinese and English dashboard copy that follows the Harness language
  setting without introducing a separate plugin preference.
- Registered and disposed locale dictionaries through the Harness locale
  lifecycle so plugin reloads do not leave duplicate registrations behind.

Thanks to [@yzke](https://github.com/yzke) for proposing the localization work
in [#2](https://github.com/lanlandeli/dsh-usage-stats/pull/2).

## [0.1.14] - 2026-08-15

### Changed

- Moved the inherited-subtask-context correction out of the feature table and
  into a dedicated fixed-issues section in both README files.

## [0.1.13] - 2026-08-15

### Fixed

- Excluded the parent-session prefix inherited by forked subtasks while keeping
  all usage produced by the child across later resume lifecycles.
- Invalidated schema-1 caches so previously inflated child summaries are rebuilt.
- Added regression coverage for repeated seed markers, repeated subagent
  descriptors, zero-seed children, legacy child headers, root sessions, and
  schema-1 cache invalidation/rebuild.

Thanks to [@Grivn](https://github.com/Grivn) for reporting the inherited-seed
double counting in [#1](https://github.com/lanlandeli/dsh-usage-stats/pull/1).

## [0.1.12] - 2026-08-14

### Changed

- Reworked the Chinese and English README files with a concise feature overview,
  installation instructions, troubleshooting guidance, and anonymous examples.
- Replaced preview assets with a smoother light-theme demo and complete anonymous
  light/dark screenshots.
- Aligned privacy, security, compatibility, and development documents with the
  current plugin behavior and Chinese-first documentation.

## [0.1.11] - 2026-08-14

### Fixed

- Added safe horizontal chart insets so the first and last date labels are not
  clipped at panel boundaries in light or dark mode.

## [0.1.10] - 2026-08-14

### Changed

- Reworked the public project description around concrete dashboard features.
- Improved npm search keywords for analytics and data visualization.

## [0.1.9] - 2026-08-14

### Added

- Local incremental usage index and lifetime overview metrics.
- 7/30-day stacked token trends and one-year activity heatmap.
- Per-model hover details, workspace/task filters, and CSV/JSON export.
- Responsive light/dark UI through official Harness UI slots.
- Clean-profile lifecycle smoke test and Node compatibility CI.

### Security and privacy

- The HTTP endpoint is same-origin, aggregate-only, and GET/HEAD-only.
- Prompt text, response text, tool arguments, and API keys are not indexed.
- Cache writes are atomic and use owner-only permissions where supported.

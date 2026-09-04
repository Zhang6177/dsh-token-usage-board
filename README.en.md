# 📊 dsh-token-usage-board

[简体中文](./README.md)

> DeepSeek Harness token usage at a glance.

[![npm version](https://img.shields.io/npm/v/dsh-token-usage-board?style=flat-square&logo=npm)](https://www.npmjs.com/package/dsh-token-usage-board)
[![npm downloads](https://img.shields.io/npm/dm/dsh-token-usage-board?style=flat-square)](https://www.npmjs.com/package/dsh-token-usage-board)
[![CI](https://img.shields.io/github/actions/workflow/status/Zhang6177/dsh-token-usage-board/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/Zhang6177/dsh-token-usage-board/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D22.19%20%7C%7C%20%3E%3D24-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/npm/l/dsh-token-usage-board?style=flat-square)](./LICENSE)

dsh-token-usage-board is a lightweight usage analytics plugin for the DeepSeek Harness Web UI. It presents an activity dashboard: total / peak tokens, longest chat duration, active-day streaks, daily / weekly / monthly / cumulative token activity views, activity insights (fast mode, reasoning effort, skill usage), the most-used skills (Top 5), and per-model token share.

The plugin integrates through Harness extension APIs without modifying the Web UI or official npm packages. Statistics remain on the local machine.

```sh
dsh plugin --profile web add dsh-token-usage-board
```

Restart the Web profile and open **Usage Statistics** above Settings in the sidebar.

Update or remove the plugin:

```sh
dsh plugin --profile web update dsh-token-usage-board
dsh plugin --profile web remove dsh-token-usage-board
```

Other install options:

```sh
# One-line install script (macOS / Linux / Windows Git Bash)
curl -fsSL https://raw.githubusercontent.com/Zhang6177/dsh-token-usage-board/main/scripts/install.sh | bash
```

Or in the Web UI: **Settings → Plugin Market** (the `dshmarket` plugin) → search `dsh-token-usage-board` and install with one click.

## Demo

![Usage statistics demo](./assets/usage-demo.gif)

## Screenshots

<details>
<summary>View light theme</summary>

![Light theme](./assets/dashboard-light-full.png)

</details>

<details>
<summary>View dark theme</summary>

![Dark theme](./assets/dashboard-dark-full.png)

</details>

## Features

| Module | Description |
| --- | --- |
| **Core stats** | Total tokens, peak single-day tokens, longest chat duration, current / longest streak |
| **Token activity** | 53-week activity view with daily heatmap / weekly / monthly / cumulative toggle |
| **Activity insights** | Fast-mode share, top reasoning effort, skills explored, skill invocations, total chats |
| **Most used skills** | Top-5 skills ranked by run count |
| **Model share** | Per-model token share ring chart with legend |
| **Data export** | Export CSV or JSON for archival or further analysis |
| **Chinese and English UI** | Follow the Harness language setting automatically |
| **Theme support** | Follow the Harness light or dark theme automatically |
| **Lightweight runtime** | No third-party charting library and no background polling |

## Definitions

### Shared official modules

Every DeepSeek Harness package used by the plugin is declared as a peer dependency and reuses the profile's own instance, preventing plugin-private copies and split module identity. The package check rejects official modules placed in regular dependencies.

### Subtask usage

Forked subtasks count only the calls they produce themselves; context inherited from the parent session is not attributed to them. Cached statistics are rebuilt under the corrected definition when the cache format changes.

## Configuration

```yaml
config:
  indexConcurrency: 2
  cacheWriteDelayMs: 1000
  apiPath: /token-usage-board/v1
  fastModelPattern: flash|turbo|lite|nano|haiku|fast|mini
```

| Option | Description | Default |
| --- | --- | --- |
| `indexConcurrency` | Number of historical sessions read concurrently (`1`–`8`) | `2` |
| `cacheWriteDelayMs` | Delay before updating the local index, in milliseconds | `1000` |
| `cachePath` | Custom index location | Harness data directory |
| `apiPath` | Statistics API path | `/token-usage-board/v1` |
| `fastModelPattern` | Case-insensitive regex of model ids that count as "fast" models, used for the fast-mode insight | `flash\|turbo\|lite\|nano\|haiku\|fast\|mini` |

## Data API

The plugin exposes a same-origin, read-only HTTP API (default base path `/token-usage-board/v1`, configurable via `apiPath`):

| Endpoint | Description |
| --- | --- |
| `GET /snapshot` | Aggregated dashboard data (`from` / `to` / `timeZone` / `scope` / `workspace` query parameters) |
| `GET /calls` | Paginated call-level records with model / provider / token-threshold filters |
| `GET /export.csv` | Download the snapshot for the query range as CSV |
| `GET /export.json` | Download the snapshot for the query range as JSON |

Parameters, response shapes, and the error contract are documented in the [API reference](./docs/API.md). The `v1` path is stable for additions; breaking changes move to a new version path.

## Privacy and security

- The local index is stored in `DSH_HOME/token-usage-board` and contains session identifiers, timestamps, working directories, model names, and token counts.
- The plugin does **not** retain prompts, responses, tool arguments, or API keys.
- See the [privacy policy](./PRIVACY.md) for the exact data scope.

## Compatibility

Verified on DeepSeek Harness `0.1.1-rc.2` with Node.js `22.19+` or `24+`. The plugin supports the official Web UI and desktop wrappers that load it.

Harness is evolving rapidly. Only environments tested by this project are declared as verified. See [Compatibility](./docs/COMPATIBILITY.md) for details.

## Issues

For a missing plugin entry, incomplete statistics, display errors, or version compatibility problems, [submit an Issue](https://github.com/Zhang6177/dsh-token-usage-board/issues/new) with the Harness and Node.js versions, installation command, reproduction steps, and relevant logs or screenshots.

Do not include API keys, access tokens, or private local data in a public Issue. See the [security policy](./SECURITY.md) for vulnerability reporting.

## Acknowledgements

- Thanks to [@Grivn](https://github.com/Grivn) for identifying and analyzing inherited parent context being counted as subtask usage in [#1](https://github.com/lanlandeli/dsh-usage-stats/pull/1).
- Thanks to [@yzke](https://github.com/yzke) for proposing and implementing the Chinese and English UI adaptation in [#2](https://github.com/lanlandeli/dsh-usage-stats/pull/2).
- Thanks to [@ogj130](https://github.com/ogj130) for the initial call-detail implementation in [#3](https://github.com/lanlandeli/dsh-usage-stats/pull/3).
- Thanks to [@zhu637882-stack](https://github.com/zhu637882-stack) for reporting the duplicate official module risk in [#4](https://github.com/lanlandeli/dsh-usage-stats/issues/4).

## License

[MIT](./LICENSE)

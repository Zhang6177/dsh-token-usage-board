# 数据接口（API）参考

dsh-token-usage-board 在 Harness Web 同源地址上暴露一组**只读** HTTP 接口，供插件界面、其他插件或外部工具（curl、脚本、仪表盘）消费。

## 约定

- 基路径：配置项 `apiPath`，默认 `/token-usage-board/v1`（尾部 `/` 会被去掉）。
- 仅支持 `GET` 与 `HEAD`；其他方法返回 `405`（带 `allow: GET, HEAD`）。
- 响应头：`cache-control: no-store`、`x-content-type-options: nosniff`；JSON 响应为 `application/json; charset=utf-8`。
- 时间戳均为 Unix 毫秒；日期均为 `YYYY-MM-DD`（按 `timeZone` 归日）。
- 数据全部来自本机统计索引（`DSH_HOME/token-usage-board`），接口不发起任何外部网络请求。

### 稳定性承诺

- `v1` 路径向后兼容：可以**新增**字段，不删除、不改义既有字段。
- 破坏性变更会启用新版本路径（`/token-usage-board/v2`），并同步更新默认 `apiPath`。
- 字段以本文件与 `src/types.ts` 的 TypeScript 定义为准，二者保持一致。

## 通用查询参数

以下参数适用于所有端点：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `from` | `YYYY-MM-DD` | `to` 前 29 天 | 统计起始日（含） |
| `to` | `YYYY-MM-DD` | 今天 | 统计截止日（含）；必须 `from ≤ to`，跨度 ≤ 10 年 |
| `timeZone` | IANA 时区名 | `UTC` | 归日所用时区，如 `Asia/Shanghai` |
| `scope` | `all` \| `main` \| `subtasks` | `all` | 任务口径：全部 / 仅主会话 / 仅子任务 |
| `workspace` | 字符串（≤ 4096 字符） | 不过滤 | 按会话工作目录（`cwd`）精确过滤 |

参数非法时返回 `400` 与 `{ "error": "<原因>" }`。

## `GET /snapshot`

聚合看板数据，即界面渲染所用的完整快照。

响应为 `StatsSnapshot`（节选关键字段，完整定义见 `src/types.ts`）：

```jsonc
{
  "generatedAt": 1756876800000,          // 生成时间（ms）
  "range": { "from": "…", "to": "…", "timeZone": "UTC" },
  "totals": {                            // 查询区间内
    "tokens": 0, "sessions": 0, "messages": 0, "activeDays": 0, "currentStreak": 0,
    "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0
  },
  "mostUsedModel": {                     // 区间内 Token 占比最高的模型；无数据时为 null
    "key": "provider/model", "provider": "…", "model": "…",
    "tokens": 0, "calls": 0, "percent": 0,
    "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0
  },
  "allTime": {                           // 全量历史口径（不受 from/to 影响，受 scope/workspace 影响）
    "totals": {
      "tokens": 0, "sessions": 0, "messages": 0, "activeDays": 0,
      "currentStreak": 0,                // 连续活跃天数（今天或昨天锚定）
      "peakDayTokens": 0,                // 单日 Token 峰值
      "longestSessionMs": 0,             // 最长聊天时长（ms）
      "longestStreak": 0,                // 历史最长连续活跃天数
      "chats": 0,                        // 有活动的会话数
      "totalCalls": 0,                   // 助手调用总数（快速模式/推理强度占比的分母）
      "fastCalls": 0,                    // 命中 fastModelPattern 的调用数
      "skillInvocations": 0,             // 技能调用总次数
      "uniqueSkills": 0,                 // 出现过的技能数
      "efforts": [{ "id": "…", "calls": 0, "percent": 0 }],
      "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0
    },
    "models": [ /* ModelStats[]，按 Token 降序 */ ],
    "mostUsedModel": null
  },
  "days": [                              // 逐日明细（区间内，升序）
    { "date": "2026-09-01", "tokens": 0, "calls": 0, "messages": 0, "sessions": 0,
      "models": { "provider/model": 0 },
      "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0 }
  ],
  "models": [ /* ModelStats[]，区间内，按 Token 降序 */ ],
  "workspaces": [{ "path": "…", "sessions": 0 }],
  "topSkills": [{ "name": "…", "runs": 0 }],   // 最常用的技能 Top 5（按运行次数降序）
  "index": { "sessions": 0, "lastUpdatedAt": null }
}
```

## `GET /calls`

调用级明细（分页）。在通用查询参数之外支持：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `page` | 正整数（≤ 10⁶） | `1` | 页码 |
| `pageSize` | `1`–`200` | `50` | 每页条数 |
| `maxRecords` | `1`–`10000` | `1000` | 明细视图最多保留的最新匹配调用数（分页在保留集内进行） |
| `model` | 字符串（≤ 4096） | 不过滤 | 模型名精确过滤 |
| `provider` | 字符串（≤ 4096） | 不过滤 | 提供方路由精确过滤 |
| `minInputTokens` | 非负整数 | 不过滤 | 保留输入 Token ≥ 该值的调用 |
| `minOutputTokens` | 非负整数 | 不过滤 | 保留输出 Token ≥ 该值的调用 |

响应为 `CallsPage`：

```jsonc
{
  "indexReady": true,   // 历史回放是否已完成；false 时数据可能不完整
  "items": [{
    "key": "…", "seq": 0, "time": 0, "sessionId": "…",
    "provider": "…", "model": "…",
    "effort": null,     // 推理强度；无记录时为 null
    "durationMs": null, // 端到端响应耗时（ms）；无记录时为 null
    "tokens": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0 }
  }],
  "page": 1, "pageSize": 50, "total": 0, "hasMore": false
}
```

## 导出

| 端点 | 内容 | 响应 |
| --- | --- | --- |
| `GET /export.csv` | 当前查询区间快照的 CSV（带 BOM，可直接用 Excel 打开） | `text/csv; charset=utf-8`，`content-disposition: attachment; filename="dsh-token-usage-board.csv"` |
| `GET /export.json` | 当前查询区间快照的完整 JSON（同 `/snapshot` 响应） | `application/json; charset=utf-8`，`content-disposition: attachment; filename="dsh-token-usage-board.json"` |

## 错误约定

| 状态码 | 场景 | 响应体 |
| --- | --- | --- |
| `200` | 正常 | 上述 JSON / CSV |
| `400` | 查询参数非法（日期格式、区间跨度、分页/过滤取值等） | `{ "error": "<原因>" }` |
| `404` | 未知路径 | `{ "error": "Not found" }` |
| `405` | 非 GET/HEAD 方法 | 无响应体，带 `allow` 头 |

## 示例

```sh
# 近 30 天快照（按北京时间归日）
curl -s 'http://127.0.0.1:3080/token-usage-board/v1/snapshot?timeZone=Asia/Shanghai'

# 全量历史、只看主会话
curl -s 'http://127.0.0.1:3080/token-usage-board/v1/snapshot?from=2020-01-01&to=2026-12-31&scope=main'

# 调用明细：第 1 页，只看输入 ≥ 100000 Token 的调用
curl -s 'http://127.0.0.1:3080/token-usage-board/v1/calls?page=1&pageSize=20&minInputTokens=100000'

# 导出近 90 天 CSV
curl -sOJ 'http://127.0.0.1:3080/token-usage-board/v1/export.csv?from=2026-06-05&to=2026-09-03'
```

## 隐私

接口只返回聚合统计与调用元数据（时间、模型、Token 数量等），不返回提示词、回复正文、工具参数或任何凭证；记录范围见 [PRIVACY.md](../PRIVACY.md)。
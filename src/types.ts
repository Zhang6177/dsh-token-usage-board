export type TaskScope = 'all' | 'main' | 'subtasks'

export interface TokenBreakdown {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
}

export interface ActivityRecord {
  seq: number
  time: number
  kind: 'human' | 'assistant'
  provider?: string
  model?: string
  tokens?: TokenBreakdown
  /** End-to-end response time from step/start to assistant/message, in ms. */
  durationMs?: number
  /** Effective reasoning effort from the nearest request/header; absent when none was recorded. */
  effort?: string
}

export interface SessionSummary {
  id: string
  createdAt: number
  cwd?: string
  parentSession?: string
  lastSeq: number
  indexedAt: number
  /** Timestamp of the earliest indexed event; the chat-duration lower bound. */
  firstAt?: number
  /** Timestamp of the latest indexed event; the chat-duration upper bound. */
  lastAt?: number
  activities: ActivityRecord[]
  /** Non-skill tool-call counts by tool name (recorded for reference; the ranking is skills-only). */
  tools: Record<string, number>
  /** Skill-invocation counts by skill name (from `skill` tool calls). */
  skills: Record<string, number>
}

export interface IndexCache {
  /** Schema 5 adds per-session tool/skill counters and activity spans. */
  schema: 5
  sessions: SessionSummary[]
}

export interface StatsQuery {
  from: string
  to: string
  timeZone: string
  workspace?: string
  scope: TaskScope
}

/** Query filters for the per-call detail endpoint (`/calls`). */
export interface CallsQuery extends StatsQuery {
  /** Exact model filter; absent means no filter. */
  model: string | undefined
  /** Exact provider route filter; absent means no filter. */
  provider: string | undefined
  /** Keep only calls whose billed input tokens are at least this value. */
  minInputTokens: number | undefined
  /** Keep only calls whose billed output tokens are at least this value. */
  minOutputTokens: number | undefined
  /** Maximum number of newest matching calls retained by the detail view. */
  maxRecords: number
  page: number
  pageSize: number
}

export type CallsFilter = Omit<CallsQuery, 'page' | 'pageSize'>

/** One assistant call row served by `/calls`. */
export interface CallRecord {
  key: string
  seq: number
  time: number
  sessionId: string
  provider: string
  model: string
  effort: string | null
  durationMs: number | null
  tokens: TokenBreakdown
}

/** Paginated payload served by `/calls`. */
export interface CallsPage {
  indexReady: boolean
  items: CallRecord[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export interface ModelStats extends TokenBreakdown {
  key: string
  provider: string
  model: string
  tokens: number
  calls: number
  percent: number
}

export interface DayStats extends TokenBreakdown {
  date: string
  tokens: number
  calls: number
  messages: number
  sessions: number
  models: Record<string, number>
}

/** Reasoning-effort distribution over all indexed assistant calls. */
export interface EffortUsage {
  id: string
  calls: number
  percent: number
}

/** One skill row of the "most used skills" ranking. */
export interface SkillUsage {
  name: string
  runs: number
}

/** Optional inputs for {@link aggregateStats}; all fields are optional. */
export interface AggregateOptions {
  /** Case-insensitive pattern matching "fast" model ids (e.g. flash/turbo variants). */
  fastModelPattern?: RegExp
}

export interface StatsSnapshot {
  generatedAt: number
  range: { from: string; to: string; timeZone: string }
  totals: {
    tokens: number
    sessions: number
    messages: number
    activeDays: number
    currentStreak: number
  } & TokenBreakdown
  mostUsedModel: ModelStats | null
  allTime: {
    totals: {
      tokens: number
      sessions: number
      messages: number
      activeDays: number
      /** Current streak in active days, anchored at today (or yesterday when today is still empty). */
      currentStreak: number
      /** Highest single-day token total over all indexed history. */
      peakDayTokens: number
      /** Longest wall-clock span between a session's first and last event, in ms. */
      longestSessionMs: number
      /** Longest run of consecutive active days over all indexed history. */
      longestStreak: number
      /** Sessions with at least one indexed activity. */
      chats: number
      /** All assistant model calls (denominator for fast-mode and effort percentages). */
      totalCalls: number
      /** Assistant calls whose model id matches the fast-model pattern. */
      fastCalls: number
      /** Total `skill` tool invocations. */
      skillInvocations: number
      /** Distinct skill names ever invoked. */
      uniqueSkills: number
      efforts: EffortUsage[]
    } & TokenBreakdown
    models: ModelStats[]
    mostUsedModel: ModelStats | null
  }
  days: DayStats[]
  models: ModelStats[]
  workspaces: { path: string; sessions: number }[]
  /** Top skills ranking (`skill` tool invocations by run count). */
  topSkills: SkillUsage[]
  index: { sessions: number; lastUpdatedAt: number | null }
}
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import type {
  ActivityRecord,
  AggregateOptions,
  CallRecord,
  CallsFilter,
  CallsQuery,
  DayStats,
  EffortUsage,
  ModelStats,
  SessionSummary,
  SkillUsage,
  StatsQuery,
  StatsSnapshot,
  TokenBreakdown,
} from './types.js'

const ZERO_TOKENS = (): TokenBreakdown => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 })

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Per-session in-memory state for pairing step timing and reasoning effort. */
export interface CollectState {
  openStep: { turn: number; step: number; time: number } | null
  currentEffort: string | undefined
}

export function newCollectState(): CollectState {
  return { openStep: null, currentEffort: undefined }
}

function isFiniteTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Extend the per-session counters from a raw event: activity span and tool/skill
 * usage. Content is projected to counters only; payloads are never retained.
 */
export function recordSessionMeta(summary: SessionSummary, event: SessionEvent): void {
  const time = event.time
  if (isFiniteTime(time)) {
    if (summary.firstAt === undefined || time < summary.firstAt) summary.firstAt = time
    if (summary.lastAt === undefined || time > summary.lastAt) summary.lastAt = time
  }
  if (event.type !== 'tool/call') return
  const name = event.data.name
  if (typeof name !== 'string' || name.length === 0) return
  if (name === 'skill') {
    const skillName = parseSkillName(event.data.arguments)
    if (skillName !== null) summary.skills[skillName] = (summary.skills[skillName] ?? 0) + 1
    return
  }
  summary.tools[name] = (summary.tools[name] ?? 0) + 1
}

/** Read the `name` argument of a `skill` tool call; null when absent or malformed. */
export function parseSkillName(argumentsJson: unknown): string | null {
  if (typeof argumentsJson !== 'string' || argumentsJson.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(argumentsJson)
    if (typeof parsed !== 'object' || parsed === null) return null
    const name = (parsed as { name?: unknown }).name
    return typeof name === 'string' && name.length > 0 ? name : null
  } catch {
    return null
  }
}

export function activityFromEvent(event: SessionEvent, state: CollectState = newCollectState()): ActivityRecord | null {
  if (event.type === 'step/start') {
    state.openStep = { turn: event.data.turn, step: event.data.step, time: event.time }
    return null
  }
  if (event.type === 'request/header') {
    const effort = event.data.header?.config?.reasoningEffort
    if (typeof effort === 'string' && effort.length > 0) state.currentEffort = effort
    return null
  }
  if (event.type === 'step/end' || event.type === 'turn/end') {
    state.openStep = null
    return null
  }
  if (event.type === 'user/message' && event.data.source.kind === 'user') {
    return { seq: event.seq, time: event.time, kind: 'human' }
  }
  if (event.type !== 'assistant/message') return null
  const usage = event.data.usage
  let durationMs: number | undefined
  if (state.openStep !== null && state.openStep.turn === event.data.turn && state.openStep.step === event.data.step) {
    durationMs = Math.max(0, event.time - state.openStep.time)
    state.openStep = null
  }
  const activity: ActivityRecord = {
    seq: event.seq,
    time: event.time,
    kind: 'assistant',
    provider: event.data.message.source.provider,
    model: event.data.message.source.model,
    tokens: {
      input: finiteCount(usage?.inputTokens),
      output: finiteCount(usage?.outputTokens),
      cacheRead: finiteCount(usage?.cacheReadTokens),
      cacheWrite: finiteCount(usage?.cacheWriteTokens),
      reasoning: finiteCount(usage?.reasoningTokens),
    },
  }
  if (durationMs !== undefined) activity.durationMs = durationMs
  if (state.currentEffort !== undefined) activity.effort = state.currentEffort
  return activity
}

export function summarizeSession(header: SessionHeader, events: readonly SessionEvent[], indexedAt = Date.now()): SessionSummary {
  // A forked child stores the parent's copied prefix in its own log. The
  // durable fork boundary is header.seedLength; lifecycle markers such as
  // session/end-seed may be appended again whenever the child is resumed and
  // therefore cannot identify the child's original ownership boundary.
  const firstOwnSeq = header.parentSession !== undefined ? (header.seedLength ?? 0) : 0
  const activities: ActivityRecord[] = []
  const summary: SessionSummary = {
    id: String(header.id),
    createdAt: header.createdAt,
    lastSeq: events.at(-1)?.seq ?? -1,
    indexedAt,
    activities,
    tools: {},
    skills: {},
  }
  const state = newCollectState()
  for (const event of events) {
    if (event.seq < firstOwnSeq) continue
    recordSessionMeta(summary, event)
    const activity = activityFromEvent(event, state)
    if (activity !== null) activities.push(activity)
  }
  if (header.cwd !== undefined) summary.cwd = header.cwd
  if (header.parentSession !== undefined) summary.parentSession = String(header.parentSession)
  return summary
}

export function appendActivity(summary: SessionSummary, event: SessionEvent, indexedAt = Date.now(), state?: CollectState): boolean {
  if (event.seq <= summary.lastSeq) return false
  summary.lastSeq = event.seq
  summary.indexedAt = indexedAt
  recordSessionMeta(summary, event)
  const activity = activityFromEvent(event, state ?? newCollectState())
  if (activity !== null) summary.activities.push(activity)
  return true
}

function addTokens(target: TokenBreakdown, value: TokenBreakdown): number {
  target.input += value.input
  target.output += value.output
  target.cacheRead += value.cacheRead
  target.cacheWrite += value.cacheWrite
  target.reasoning += value.reasoning
  return value.input + value.output + value.cacheRead + value.cacheWrite
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
  }
}

function dateKey(value: number, format: Intl.DateTimeFormat): string {
  const parts = format.formatToParts(value)
  const year = parts.find(part => part.type === 'year')?.value ?? '1970'
  const month = parts.find(part => part.type === 'month')?.value ?? '01'
  const day = parts.find(part => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function datesBetween(from: string, to: string): string[] {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end && days.length < 3660) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function newDay(date: string): DayStats {
  return { date, tokens: 0, calls: 0, messages: 0, sessions: 0, models: {}, ...ZERO_TOKENS() }
}

function inScope(session: SessionSummary, query: StatsQuery): boolean {
  if (query.workspace !== undefined && session.cwd !== query.workspace) return false
  if (query.scope === 'main' && session.parentSession !== undefined) return false
  if (query.scope === 'subtasks' && session.parentSession === undefined) return false
  return true
}

/** Longest run of consecutive calendar days inside a set of ISO dates. */
function longestStreak(dates: ReadonlySet<string>): number {
  if (dates.size === 0) return 0
  const sorted = [...dates].sort()
  let best = 1
  let run = 1
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T00:00:00Z`)
    previous.setUTCDate(previous.getUTCDate() + 1)
    if (previous.toISOString().slice(0, 10) === sorted[index]) {
      run += 1
      if (run > best) best = run
    } else {
      run = 1
    }
  }
  return best
}

/** Current active-day streak; anchored at today, falling back to yesterday. */
function currentStreak(dates: ReadonlySet<string>, format: Intl.DateTimeFormat, now = Date.now()): number {
  let cursor = dateKey(now, format)
  if (!dates.has(cursor)) {
    const yesterday = new Date(`${cursor}T00:00:00Z`)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    cursor = yesterday.toISOString().slice(0, 10)
  }
  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    const step = new Date(`${cursor}T00:00:00Z`)
    step.setUTCDate(step.getUTCDate() - 1)
    cursor = step.toISOString().slice(0, 10)
  }
  return streak
}

function sessionSpanMs(session: SessionSummary): number {
  if (session.firstAt === undefined || session.lastAt === undefined) return 0
  return Math.max(0, session.lastAt - session.firstAt)
}

export function aggregateStats(sessions: Iterable<SessionSummary>, query: StatsQuery, options: AggregateOptions = {}): StatsSnapshot {
  const allSessions = [...sessions]
  const format = formatter(query.timeZone)
  const days = datesBetween(query.from, query.to).map(newDay)
  const byDate = new Map(days.map(day => [day.date, day]))
  const activeSessionsByDay = new Map<string, Set<string>>()
  const models = new Map<string, ModelStats>()
  const sessionIds = new Set<string>()
  const activeDates = new Set<string>()
  const totals = { tokens: 0, sessions: 0, messages: 0, activeDays: 0, currentStreak: 0, ...ZERO_TOKENS() }
  const allTimeTotals: StatsSnapshot['allTime']['totals'] = { tokens: 0, sessions: 0, messages: 0, activeDays: 0, currentStreak: 0, peakDayTokens: 0, longestSessionMs: 0, longestStreak: 0, chats: 0, totalCalls: 0, fastCalls: 0, skillInvocations: 0, uniqueSkills: 0, efforts: [], ...ZERO_TOKENS() }
  const allTimeModels = new Map<string, ModelStats>()
  const allTimeSessionIds = new Set<string>()
  const allTimeActiveDates = new Set<string>()
  const allTimeDailyTokens = new Map<string, number>()
  const allTimeEfforts = new Map<string, number>()
  const skillRuns = new Map<string, number>()
  let allTimeTotalCalls = 0
  let allTimeFastCalls = 0
  let allTimeLongestSessionMs = 0
  let allTimeSkillInvocations = 0
  const allTimeSkillNames = new Set<string>()

  const fastPattern = options.fastModelPattern

  for (const session of allSessions) {
    if (!inScope(session, query)) continue
    let sessionActive = false
    let allTimeSessionActive = false
    for (const [skillName, runs] of Object.entries(session.skills)) {
      allTimeSkillInvocations += runs
      allTimeSkillNames.add(skillName)
      skillRuns.set(skillName, (skillRuns.get(skillName) ?? 0) + runs)
    }
    const spanMs = sessionSpanMs(session)
    if (spanMs > allTimeLongestSessionMs) allTimeLongestSessionMs = spanMs
    for (const activity of session.activities) {
      const dayKey = dateKey(activity.time, format)
      allTimeTotals.messages += 1
      allTimeSessionActive = true
      allTimeActiveDates.add(dayKey)
      if (activity.kind === 'assistant' && activity.tokens !== undefined) {
        const provider = activity.provider ?? 'unknown'
        const model = activity.model ?? 'unknown'
        const key = `${provider}/${model}`
        let modelStats = allTimeModels.get(key)
        if (modelStats === undefined) {
          modelStats = { key, provider, model, tokens: 0, calls: 0, percent: 0, ...ZERO_TOKENS() }
          allTimeModels.set(key, modelStats)
        }
        const amount = addTokens(modelStats, activity.tokens)
        modelStats.tokens += amount
        modelStats.calls += 1
        allTimeTotals.tokens += amount
        addTokens(allTimeTotals, activity.tokens)
        allTimeTotalCalls += 1
        allTimeDailyTokens.set(dayKey, (allTimeDailyTokens.get(dayKey) ?? 0) + amount)
        if (activity.effort !== undefined) allTimeEfforts.set(activity.effort, (allTimeEfforts.get(activity.effort) ?? 0) + 1)
        if (fastPattern !== undefined && model !== '' && fastPattern.test(model)) allTimeFastCalls += 1
      }
      const day = byDate.get(dayKey)
      if (day === undefined) continue
      day.messages += 1
      totals.messages += 1
      sessionActive = true
      activeDates.add(dayKey)
      let daySessions = activeSessionsByDay.get(dayKey)
      if (daySessions === undefined) activeSessionsByDay.set(dayKey, daySessions = new Set())
      daySessions.add(session.id)
      if (activity.kind !== 'assistant' || activity.tokens === undefined) continue
      day.calls += 1
      const provider = activity.provider ?? 'unknown'
      const model = activity.model ?? 'unknown'
      const key = `${provider}/${model}`
      let modelStats = models.get(key)
      if (modelStats === undefined) {
        modelStats = { key, provider, model, tokens: 0, calls: 0, percent: 0, ...ZERO_TOKENS() }
        models.set(key, modelStats)
      }
      const amount = addTokens(modelStats, activity.tokens)
      modelStats.tokens += amount
      modelStats.calls += 1
      day.tokens += amount
      day.models[key] = (day.models[key] ?? 0) + amount
      addTokens(day, activity.tokens)
      totals.tokens += amount
      addTokens(totals, activity.tokens)
    }
    if (sessionActive) sessionIds.add(session.id)
    if (allTimeSessionActive) allTimeSessionIds.add(session.id)
  }

  for (const day of days) day.sessions = activeSessionsByDay.get(day.date)?.size ?? 0
  totals.sessions = sessionIds.size
  totals.activeDays = activeDates.size
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index]
    if (day === undefined || !activeDates.has(day.date)) break
    totals.currentStreak += 1
  }

  const sortedModels = [...models.values()].sort((a, b) => b.tokens - a.tokens || a.key.localeCompare(b.key))
  for (const model of sortedModels) model.percent = totals.tokens === 0 ? 0 : model.tokens / totals.tokens * 100

  allTimeTotals.sessions = allTimeSessionIds.size
  allTimeTotals.activeDays = allTimeActiveDates.size
  allTimeTotals.currentStreak = currentStreak(allTimeActiveDates, format)
  let allTimePeakDayTokens = 0
  for (const tokens of allTimeDailyTokens.values()) if (tokens > allTimePeakDayTokens) allTimePeakDayTokens = tokens
  allTimeTotals.longestStreak = longestStreak(allTimeActiveDates)
  allTimeTotals.peakDayTokens = allTimePeakDayTokens
  allTimeTotals.longestSessionMs = allTimeLongestSessionMs
  allTimeTotals.chats = allTimeSessionIds.size
  allTimeTotals.totalCalls = allTimeTotalCalls
  allTimeTotals.fastCalls = allTimeFastCalls
  allTimeTotals.skillInvocations = allTimeSkillInvocations
  allTimeTotals.uniqueSkills = allTimeSkillNames.size
  const sortedEfforts: EffortUsage[] = [...allTimeEfforts.entries()]
    .map(([id, calls]) => ({ id, calls, percent: allTimeTotalCalls === 0 ? 0 : calls / allTimeTotalCalls * 100 }))
    .sort((a, b) => b.calls - a.calls || a.id.localeCompare(b.id))
  allTimeTotals.efforts = sortedEfforts

  const sortedAllTimeModels = [...allTimeModels.values()].sort((a, b) => b.tokens - a.tokens || a.key.localeCompare(b.key))
  for (const model of sortedAllTimeModels) model.percent = allTimeTotals.tokens === 0 ? 0 : model.tokens / allTimeTotals.tokens * 100

  const topSkills: SkillUsage[] = [...skillRuns.entries()]
    .map(([name, runs]) => ({ name, runs }))
    .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))
    .slice(0, 5)

  const workspaceCounts = new Map<string, Set<string>>()
  for (const session of allSessions) {
    if (session.cwd === undefined) continue
    let ids = workspaceCounts.get(session.cwd)
    if (ids === undefined) workspaceCounts.set(session.cwd, ids = new Set())
    ids.add(session.id)
  }
  const workspaces = [...workspaceCounts].map(([path, ids]) => ({ path, sessions: ids.size }))
    .sort((a, b) => b.sessions - a.sessions || a.path.localeCompare(b.path))

  return {
    generatedAt: Date.now(),
    range: { from: query.from, to: query.to, timeZone: query.timeZone },
    totals,
    mostUsedModel: sortedModels[0] ?? null,
    allTime: { totals: allTimeTotals, models: sortedAllTimeModels, mostUsedModel: sortedAllTimeModels[0] ?? null },
    days,
    models: sortedModels,
    workspaces,
    topSkills,
    index: {
      sessions: allSessions.length,
      lastUpdatedAt: allSessions.length === 0 ? null : Math.max(...allSessions.map(session => session.indexedAt)),
    },
  }
}

export function collectCalls(sessions: Iterable<SessionSummary>, query: CallsFilter): CallRecord[] {
  const format = formatter(query.timeZone)
  const rows: CallRecord[] = []
  for (const session of sessions) {
    if (!inScope(session, query)) continue
    for (const activity of session.activities) {
      if (activity.kind !== 'assistant') continue
      if (query.model !== undefined && activity.model !== query.model) continue
      if (query.provider !== undefined && activity.provider !== query.provider) continue
      const tokens = activity.tokens ?? ZERO_TOKENS()
      if (query.minInputTokens !== undefined && tokens.input < query.minInputTokens) continue
      if (query.minOutputTokens !== undefined && tokens.output < query.minOutputTokens) continue
      const dayKey = dateKey(activity.time, format)
      if (dayKey < query.from || dayKey > query.to) continue
      rows.push({
        key: `${session.id}:${activity.seq}`,
        seq: activity.seq,
        time: activity.time,
        sessionId: session.id,
        provider: activity.provider ?? 'unknown',
        model: activity.model ?? 'unknown',
        effort: activity.effort ?? null,
        durationMs: activity.durationMs ?? null,
        tokens,
      })
    }
  }
  rows.sort((a, b) => b.time - a.time || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  if (rows.length > query.maxRecords) rows.length = query.maxRecords
  return rows
}

export function aggregateCalls(sessions: Iterable<SessionSummary>, query: CallsQuery): { items: CallRecord[]; total: number } {
  const rows = collectCalls(sessions, query)
  const total = rows.length
  const offset = (query.page - 1) * query.pageSize
  return { items: rows.slice(offset, offset + query.pageSize), total }
}

export function exportCsv(snapshot: StatsSnapshot): string {
  const quote = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`
  const header = ['date', 'model', 'provider', 'tokens', 'input', 'output', 'cache_read', 'cache_write', 'messages', 'sessions']
  const rows: string[][] = []
  for (const day of snapshot.days) {
    const entries = Object.entries(day.models)
    if (entries.length === 0) rows.push([day.date, '', '', '0', '0', '0', '0', '0', String(day.messages), String(day.sessions)])
    for (const [key, tokens] of entries) {
      const model = snapshot.models.find(item => item.key === key)
      rows.push([day.date, model?.model ?? key, model?.provider ?? '', String(tokens), '', '', '', '', String(day.messages), String(day.sessions)])
    }
  }
  return [header, ...rows].map(row => row.map(quote).join(',')).join('\r\n')
}
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DayStats, StatsSnapshot } from '../types.js'
import { formatDateLabel, installLocale, useLocale, type I18nKey, type Language } from './i18n.js'
import { styles } from './styles.js'

export const inject = ['slots', 'locale']

type IconName = 'chart' | 'back' | 'download' | 'spark'

function Icon({ name, size = 18 }: { name: IconName; size?: number }): ReactNode {
  const paths: Record<IconName, ReactNode> = {
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></>,
    spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

class VisibilityController {
  private open = false
  private listeners = new Set<() => void>()
  getSnapshot = (): boolean => this.open
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  show = (): void => { this.set(true) }
  hide = (): void => { this.set(false) }
  private set(value: boolean): void { if (value === this.open) return; this.open = value; for (const listener of this.listeners) listener() }
}

interface Injected {
  useVisibility: <T>(selector: (open: boolean) => T) => T
  show: () => void
  hide: () => void
}

type BoundInjected = Omit<Injected, 'useVisibility'> & {
  useVisibility: <T>(selector: (open: boolean) => T) => T
}
type FooterProps = PropsRuntime<'sidebar.footer.action'> & BoundInjected
type OverlayProps = PropsRuntime<'shell.overlay'> & BoundInjected

function FooterAction({ wide, show }: FooterProps): ReactNode {
  const { t } = useLocale()
  return <button data-usage-stats className="us-nav" data-rail={!wide} onClick={show} title={wide ? undefined : t('nav')} aria-label={t('nav')}>
    <Icon name="chart" />{wide && <span>{t('nav')}</span>}
  </button>
}

function localDate(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isoLocal(date: Date): string {
  const year = date.getFullYear()
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function compact(value: number, numberLocale: string): string {
  return new Intl.NumberFormat(numberLocale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function monthShort(date: Date, lang: Language): string {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short' }).format(date)
}

function formatDuration(ms: number, t: (key: I18nKey, vars?: Record<string, string | number>) => string): string {
  if (ms <= 0) return '0'
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return t('subMinute')
  if (totalMinutes < 60) return t('minutesOnly', { m: totalMinutes })
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 48) return t('hourMinute', { h: totalHours, m: totalMinutes % 60 })
  const totalDays = Math.floor(totalHours / 24)
  return t('dayHour', { d: totalDays, h: totalHours % 24 })
}

function effortLabel(id: string, t: (key: I18nKey) => string): string {
  const labels: Record<string, I18nKey> = { off: 'effortOff', low: 'effortLow', medium: 'effortMedium', high: 'effortHigh', xhigh: 'effortXhigh', ultra: 'effortUltra', max: 'effortMax' }
  const key = labels[id.toLowerCase()]
  return key === undefined ? id : t(key)
}

function StatStrip({ snapshot }: { snapshot: StatsSnapshot }): ReactNode {
  const { t, numberLocale } = useLocale()
  const allTime = snapshot.allTime.totals
  const cells = [
    { label: t('statTokens'), value: compact(allTime.tokens, numberLocale), detail: t('statTokensDetail') },
    { label: t('statPeak'), value: compact(allTime.peakDayTokens, numberLocale), detail: t('statPeakDetail') },
    { label: t('statLongestChat'), value: formatDuration(allTime.longestSessionMs, t), detail: t('statLongestChatDetail') },
    { label: t('statCurrentStreak'), value: `${allTime.currentStreak} ${t('daysUnit')}` },
    { label: t('statLongestStreak'), value: `${allTime.longestStreak} ${t('daysUnit')}` },
  ]
  return <div className="us-stats-strip">{cells.map(cell => <div className="us-stat-cell" key={cell.label}><div className="us-stat-value" title={cell.detail ?? undefined}>{cell.value}</div><div className="us-stat-label">{cell.label}</div></div>)}</div>
}

interface ActivityWeek {
  start: Date
  days: (DayStats | null)[]
}

/** Split the day series into 53 ISO weeks (Monday-first) ending at the current week. */
function buildWeeks(days: DayStats[]): ActivityWeek[] {
  const dayMap = new Map(days.map(day => [day.date, day]))
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const weeks: ActivityWeek[] = []
  for (let offset = 52; offset >= 0; offset -= 1) {
    const start = new Date(monday)
    start.setDate(monday.getDate() - offset * 7)
    const weekDays: (DayStats | null)[] = []
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      weekDays.push(dayMap.get(isoLocal(date)) ?? null)
    }
    weeks.push({ start, days: weekDays })
  }
  return weeks
}

type ActivityMode = 'daily' | 'weekly' | 'monthly' | 'cumulative'
const ACTIVITY_MODES: readonly ActivityMode[] = ['daily', 'weekly', 'monthly', 'cumulative']

function heatLevel(tokens: number, max: number): number {
  return tokens === 0 ? 0 : Math.max(1, Math.min(5, Math.ceil(Math.log1p(tokens) / Math.log1p(max) * 5)))
}

function DailyGrid({ days }: { days: DayStats[] }): ReactNode {
  const { t, lang, numberLocale } = useLocale()
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const weeks = useMemo(() => buildWeeks(days), [days])
  const max = Math.max(1, ...days.map(day => day.tokens))
  const monthLabels = useMemo(() => weeks.map((week, index) => {
    const previous = index === 0 ? undefined : weeks[index - 1]
    return previous !== undefined && previous.start.getMonth() !== week.start.getMonth() ? monthShort(week.start, lang) : ''
  }), [weeks, lang])
  const showTip = (target: HTMLElement, text: string): void => {
    const rect = target.getBoundingClientRect()
    setTip({ x: Math.min(window.innerWidth - 150, Math.max(150, rect.left + rect.width / 2)), y: rect.top - 10, text })
  }
  return <><div className="us-heat-scroll"><div className="us-heat-week"><span>{t('mon')}</span><span>{t('wed')}</span><span>{t('fri')}</span></div><div className="us-heat-body"><div className="us-heat">{weeks.map((week, weekIndex) => week.days.map((day, dayIndex) => {
    if (day === null) return <span className="us-cell" key={`${weekIndex}-${dayIndex}`} data-level={0} aria-hidden="true" />
    const text = t('dayDetail', { date: formatDateLabel(day.date, lang), tokens: compact(day.tokens, numberLocale), token: t('tokenUnit'), calls: day.calls, callsUnit: t('callsSuffix') })
    return <span className="us-cell us-cell-tip" key={day.date} data-level={heatLevel(day.tokens, max)} aria-label={text} tabIndex={0} onMouseEnter={event => showTip(event.currentTarget, text)} onMouseLeave={() => setTip(null)} onFocus={event => showTip(event.currentTarget, text)} onBlur={() => setTip(null)} />
  }))}</div><div className="us-heat-months" aria-hidden="true">{monthLabels.map((label, index) => <span key={index}>{label}</span>)}</div></div></div>{tip && createPortal(<div data-usage-stats className="us-floating-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>, document.body)}</>
}

function WeeklyBars({ days }: { days: DayStats[] }): ReactNode {
  const { t, lang, numberLocale } = useLocale()
  const weeks = useMemo(() => buildWeeks(days), [days])
  const totals = weeks.map(week => week.days.reduce((sum, day) => sum + (day?.tokens ?? 0), 0))
  const max = Math.max(1, ...totals)
  return <div className="us-bars">{weeks.map((week, index) => {
    const end = new Date(week.start)
    end.setDate(week.start.getDate() + 6)
    const range = `${formatDateLabel(isoLocal(week.start), lang)} – ${formatDateLabel(isoLocal(end), lang)}`
    const title = t('weekDetail', { range, tokens: compact(totals[index] ?? 0, numberLocale), token: t('tokenUnit') })
    return <div className="us-bar-slot" key={index}><div className="us-bar" style={{ height: `${(totals[index] ?? 0) / max * 100}%` }} title={title} aria-label={title} tabIndex={0} /><span className="us-bar-label">{index % 8 === 0 ? monthShort(week.start, lang) : ''}</span></div>
  })}</div>
}

function MonthlyBars({ days }: { days: DayStats[] }): ReactNode {
  const { t, lang, numberLocale } = useLocale()
  const months = useMemo(() => {
    const now = new Date()
    const result: { key: string; label: Date; total: number }[] = []
    for (let offset = 11; offset >= 0; offset -= 1) {
      const anchor = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const key = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`
      let total = 0
      for (const day of days) if (day.date.startsWith(`${key}-`)) total += day.tokens
      result.push({ key, label: anchor, total })
    }
    return result
  }, [days])
  const max = Math.max(1, ...months.map(month => month.total))
  return <div className="us-bars">{months.map(month => {
    const label = monthShort(month.label, lang)
    const title = t('monthDetail', { month: label, tokens: compact(month.total, numberLocale), token: t('tokenUnit') })
    return <div className="us-bar-slot" key={month.key}><div className="us-bar" style={{ height: `${month.total / max * 100}%` }} title={title} aria-label={title} tabIndex={0} /><span className="us-bar-label">{label}</span></div>
  })}</div>
}

function CumulativeChart({ days }: { days: DayStats[] }): ReactNode {
  const { t, lang, numberLocale } = useLocale()
  const { points, max, monthMarks } = useMemo(() => {
    let running = 0
    const pointValues = days.map(day => (running += day.tokens))
    const peak = Math.max(1, running)
    const height = 190
    const step = days.length > 1 ? 720 / (days.length - 1) : 720
    const pointList = pointValues.map((value, index) => `${(index * step).toFixed(2)},${(height - value / peak * height).toFixed(2)}`)
    const marks = Array.from({ length: 53 }, () => '')
    for (let index = 1; index < days.length; index += 1) {
      const current = days[index]
      const previous = days[index - 1]
      if (current === undefined || previous === undefined) continue
      if (current.date.slice(0, 7) === previous.date.slice(0, 7)) continue
      const monthIndex = Math.min(52, Math.floor(index / 7))
      marks[monthIndex] = monthShort(new Date(Number(current.date.slice(0, 4)), Number(current.date.slice(5, 7)) - 1), lang)
    }
    return { points: pointList.join(' '), max: peak, monthMarks: marks }
  }, [days, lang])
  const areaPath = points.length > 0 ? `M0,190 L${points} L720,190 Z` : ''
  return <div className="us-cum-wrap"><div className="us-cum-frame"><svg viewBox="0 0 720 190" preserveAspectRatio="none" role="img" aria-label={t('modeCumulative')}>
    <path className="us-cum-area" d={areaPath} />
    <polyline className="us-cum-line" points={points} />
  </svg><span className="us-cum-peak">{compact(max, numberLocale)} {t('tokenUnit')}</span></div>
    <div className="us-heat-months" aria-hidden="true">{monthMarks.map((label, index) => <span key={index}>{label}</span>)}</div>
  </div>
}

function TokenActivity({ days }: { days: DayStats[] }): ReactNode {
  const { t } = useLocale()
  const [mode, setMode] = useState<ActivityMode>('daily')
  const modeLabels: Record<ActivityMode, I18nKey> = { daily: 'modeDaily', weekly: 'modeWeekly', monthly: 'modeMonthly', cumulative: 'modeCumulative' }
  return <section className="us-panel"><div className="us-panel-head"><span className="us-panel-title">{t('activityTitle')}</span>
    <span className="us-activity-controls">
      {mode === 'daily' && <span className="us-heat-legend"><span>{t('less')}</span><i className="us-cell" data-level={0} /><i className="us-cell" data-level={1} /><i className="us-cell" data-level={2} /><i className="us-cell" data-level={3} /><i className="us-cell" data-level={4} /><i className="us-cell" data-level={5} /><span>{t('more')}</span></span>}
      <span className="us-segment" aria-label={t('activityTitle')}>{ACTIVITY_MODES.map(item => <button type="button" key={item} aria-pressed={mode === item} onClick={() => setMode(item)}>{t(modeLabels[item])}</button>)}</span>
    </span>
  </div>
    {mode === 'daily' && <DailyGrid days={days} />}
    {mode === 'weekly' && <WeeklyBars days={days} />}
    {mode === 'monthly' && <MonthlyBars days={days} />}
    {mode === 'cumulative' && <CumulativeChart days={days} />}
  </section>
}

function Insights({ snapshot }: { snapshot: StatsSnapshot }): ReactNode {
  const { t, numberLocale } = useLocale()
  const allTime = snapshot.allTime.totals
  const fastPercent = allTime.totalCalls === 0 ? 0 : Math.round(allTime.fastCalls / allTime.totalCalls * 100)
  const topEffort = allTime.efforts[0]
  const rows: { label: string; value: string; sub?: string }[] = [
    { label: t('fastMode'), value: `${fastPercent}%`, sub: t('fastModeDetail') },
    { label: t('topEffort'), value: topEffort === undefined ? t('noData') : `${effortLabel(topEffort.id, t)}: ${Math.round(topEffort.percent)}%` },
    { label: t('skillsExplored'), value: new Intl.NumberFormat(numberLocale).format(allTime.uniqueSkills) },
    { label: t('skillsTotal'), value: new Intl.NumberFormat(numberLocale).format(allTime.skillInvocations) },
    { label: t('totalChats'), value: new Intl.NumberFormat(numberLocale).format(allTime.chats) },
  ]
  return <section className="us-panel"><div className="us-panel-head"><span className="us-panel-title">{t('insightsTitle')}</span></div>{rows.map(row => <div className="us-duo-row" key={row.label}><span className="us-duo-label" title={row.sub}>{row.label}</span><span className="us-duo-value">{row.value}</span></div>)}</section>
}

function PluginList({ snapshot }: { snapshot: StatsSnapshot }): ReactNode {
  const { t, numberLocale } = useLocale()
  return <section className="us-panel"><div className="us-panel-head"><span className="us-panel-title">{t('pluginsTitle')}</span></div>
    {snapshot.topPlugins.length === 0 ? <div className="us-duo-row"><span className="us-duo-label">{t('noData')}</span></div>
      : snapshot.topPlugins.map(plugin => <div className="us-plugin-row" key={plugin.name}><span className="us-plugin-mark"><Icon name="spark" size={13} /></span><span className="us-plugin-name" title={plugin.name}>{plugin.name}</span><span className="us-plugin-count">{new Intl.NumberFormat(numberLocale).format(plugin.runs)} {t('runsSuffix')}</span></div>)}
  </section>
}

const PIE_COLORS = ['#1684ff', '#219653', '#9368ef', '#f59e0b', '#ef5da8', '#22b8b5', '#8b5cf6', '#10b981']
const PIE_OTHER_COLOR = '#c3c9d1'

function ModelPie({ snapshot }: { snapshot: StatsSnapshot }): ReactNode {
  const { t, numberLocale } = useLocale()
  const models = snapshot.allTime.models
  const total = snapshot.allTime.totals.tokens
  const segments = useMemo(() => {
    const top = models.slice(0, 8).map((model, index) => ({ name: model.model, color: PIE_COLORS[index] ?? PIE_OTHER_COLOR, tokens: model.tokens, percent: model.percent }))
    const rest = models.slice(8).reduce((sum, model) => sum + model.tokens, 0)
    if (rest > 0) top.push({ name: t('otherModel'), color: PIE_OTHER_COLOR, tokens: rest, percent: total === 0 ? 0 : rest / total * 100 })
    return top
  }, [models, total, t])
  const conic = useMemo(() => {
    let cursor = 0
    const stops = segments.map(segment => {
      const from = cursor
      cursor += segment.percent
      return `${segment.color} ${(from * 3.6).toFixed(2)}deg ${(Math.min(cursor, 100) * 3.6).toFixed(2)}deg`
    })
    return stops.length === 0 ? `conic-gradient(${PIE_OTHER_COLOR} 0deg 360deg)` : `conic-gradient(${stops.join(', ')})`
  }, [segments])
  return <section className="us-panel"><div className="us-panel-head"><span className="us-panel-title">{t('modelShareTitle')}</span><span className="us-panel-note">{t('modelShareNote')}</span></div>
    <div className="us-pie-layout"><div className="us-pie" style={{ background: conic }}><div className="us-pie-center">{compact(total, numberLocale)}<small>{t('tokenUnit')}</small></div></div>
      <div className="us-pie-legend">{segments.map(segment => <div className="us-pie-row" key={segment.name}><span className="us-pie-dot" style={{ background: segment.color }} /><span className="us-pie-name" title={segment.name}>{segment.name}</span><span className="us-pie-tokens">{compact(segment.tokens, numberLocale)}</span><span className="us-pie-percent">{segment.percent.toFixed(segment.percent < 10 ? 1 : 0)}%</span></div>)}</div>
    </div>
  </section>
}

const ACTIVITY_WINDOW_DAYS = 53 * 7

function Dashboard({ hide }: { hide: () => void }): ReactNode {
  const { t } = useLocale()
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const query = useMemo(() => {
    const params = new URLSearchParams({ from: localDate(-(ACTIVITY_WINDOW_DAYS - 1)), to: localDate(), scope: 'all', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
    return params.toString()
  }, [])
  const refresh = useCallback((signal?: AbortSignal) => {
    setError(null)
    fetch(`/usage-stats/v1/snapshot?${query}`, { signal: signal ?? null, headers: { accept: 'application/json' } })
      .then(async response => { if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? `HTTP ${response.status}`); return response.json() as Promise<StatsSnapshot> })
      .then(setSnapshot).catch((reason: unknown) => { if ((reason as { name?: string }).name !== 'AbortError') setError(reason instanceof Error ? reason.message : String(reason)) })
  }, [query])
  useEffect(() => { const abort = new AbortController(); refresh(abort.signal); return () => { abort.abort() } }, [refresh])
  useEffect(() => { const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') hide() }; window.addEventListener('keydown', onKey); return () => { window.removeEventListener('keydown', onKey) } }, [hide])
  return <div data-usage-stats className="us-shell" role="dialog" aria-modal="true" aria-label={t('title')}>
    <header className="us-top"><div className="us-heading"><div className="us-title">{t('title')}</div><span className="us-tab">{t('appUsage')}</span></div><button className="us-back" onClick={hide}><Icon name="back" size={17} />{t('back')}</button></header>
    <main className="us-scroll"><div className="us-content">
      {error ? <div className="us-state"><div><p>{t('loadError')}</p><small>{error}</small></div></div> : snapshot === null ? <div className="us-state"><div><div className="us-spinner" />{t('loading')}</div></div> : <>
        <StatStrip snapshot={snapshot} />
        <TokenActivity days={snapshot.days} />
        <div className="us-duo"><Insights snapshot={snapshot} /><PluginList snapshot={snapshot} /></div>
        <ModelPie snapshot={snapshot} />
      </>}
    </div></main>
  </div>
}

function Overlay({ useVisibility, hide }: OverlayProps): ReactNode {
  const open = useVisibility(value => value)
  return open ? <Dashboard hide={hide} /> : null
}

export function apply(ctx: ClientContext & { locale: LocaleRuntime }): void {
  const uninstallLocale = installLocale(ctx.locale)
  ctx.effect(() => uninstallLocale, 'usage-stats: locale dictionaries')
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-usage-stats'
  style.textContent = styles
  document.head.appendChild(style)
  ctx.effect(() => () => { style.remove() }, 'usage-stats: styles')
  const visibility = new VisibilityController()
  const injected = () => ({ hooks: { visibility }, show: visibility.show, hide: visibility.hide })
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'usage-stats', order: 20, inject: injected }, FooterAction))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'usage-stats', order: 20, inject: injected }, Overlay))
}
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { useSyncExternalStore } from 'react'

export type Language = 'zh' | 'en'

const zh = {
  nav: '使用统计',
  title: '使用统计',
  appUsage: 'token用量',
  back: '返回对话',
  noData: '暂无数据',
  loadError: '统计数据暂时无法读取',
  loading: '正在建立本地增量索引…',
  tokenUnit: 'Token',
  daysUnit: '天',
  hourMinute: '{h} 小时 {m} 分',
  minutesOnly: '{m} 分钟',
  subMinute: '1 分钟以内',
  dayHour: '{d} 天 {h} 小时',
  statTokens: '累计 Token 数',
  statTokensDetail: '输入、输出与缓存合计',
  statPeak: '峰值 Token 数',
  statPeakDetail: '单日最高 Token 消耗',
  statLongestChat: '最长聊天时长',
  statLongestChatDetail: '单次会话首末事件间隔',
  statCurrentStreak: '当前连续天数',
  statLongestStreak: '最长连续天数',
  activityTitle: 'Token 活动',
  modeDaily: '每日',
  modeWeekly: '每周',
  modeMonthly: '每月',
  modeCumulative: '累计',
  less: '较少',
  more: '较多',
  mon: '一',
  wed: '三',
  fri: '五',
  callsSuffix: '轮',
  dayDetail: '{date} · {tokens} {token} · {calls} {callsUnit}',
  weekDetail: '{range} · {tokens} {token}',
  monthDetail: '{month} · {tokens} {token}',
  cumulativeDetail: '{date} · 累计 {tokens} {token}',
  insightsTitle: '活动洞察',
  fastMode: '快速模式',
  fastModeDetail: '命中快速模型（flash/turbo 等）的调用占比',
  topEffort: '最常用的推理强度',
  skillsExplored: '已探索的技能',
  skillsTotal: '使用的技能总数',
  totalChats: '聊天总数',
  skillsTitle: '最常用的技能',
  runsSuffix: '次运行',
  modelShareTitle: '模型 Token 占比',
  modelShareNote: '全部历史 · 输入、输出与缓存合计',
  otherModel: '其他',
  modelDetail: '{name} · {tokens} {token} · {percent}%',
  peakPercent: '{percent}%',
  effortOff: '关闭',
  effortLow: '低',
  effortMedium: '中',
  effortHigh: '高',
  effortXhigh: '极高',
  effortUltra: '超高',
  effortMax: '极高',
} as const

type Dictionary = Record<keyof typeof zh, string>

const en: Dictionary = {
  nav: 'Usage Stats',
  title: 'Usage Stats',
  appUsage: 'Token Usage',
  back: 'Back to chat',
  noData: 'No data',
  loadError: 'Unable to load usage stats',
  loading: 'Building local index…',
  tokenUnit: 'tokens',
  daysUnit: 'days',
  hourMinute: '{h}h {m}m',
  minutesOnly: '{m}m',
  subMinute: '<1m',
  dayHour: '{d}d {h}h',
  statTokens: 'Total Tokens',
  statTokensDetail: 'Input, output and cache combined',
  statPeak: 'Peak Tokens',
  statPeakDetail: 'Highest single-day token total',
  statLongestChat: 'Longest Chat',
  statLongestChatDetail: 'First-to-last event span of a session',
  statCurrentStreak: 'Current Streak',
  statLongestStreak: 'Longest Streak',
  activityTitle: 'Token Activity',
  modeDaily: 'Daily',
  modeWeekly: 'Weekly',
  modeMonthly: 'Monthly',
  modeCumulative: 'Cumulative',
  less: 'Less',
  more: 'More',
  mon: 'M',
  wed: 'W',
  fri: 'F',
  callsSuffix: 'calls',
  dayDetail: '{date} · {tokens} {token} · {calls} {callsUnit}',
  weekDetail: '{range} · {tokens} {token}',
  monthDetail: '{month} · {tokens} {token}',
  cumulativeDetail: '{date} · {tokens} {token} total',
  insightsTitle: 'Activity Insights',
  fastMode: 'Fast mode',
  fastModeDetail: 'Share of calls hitting fast models (flash/turbo etc.)',
  topEffort: 'Top reasoning effort',
  skillsExplored: 'Skills explored',
  skillsTotal: 'Skill invocations',
  totalChats: 'Total chats',
  skillsTitle: 'Most Used Skills',
  runsSuffix: 'runs',
  modelShareTitle: 'Tokens by Model',
  modelShareNote: 'All time · input, output and cache',
  otherModel: 'Other',
  modelDetail: '{name} · {tokens} {token} · {percent}%',
  peakPercent: '{percent}%',
  effortOff: 'Off',
  effortLow: 'Low',
  effortMedium: 'Medium',
  effortHigh: 'High',
  effortXhigh: 'Extreme',
  effortUltra: 'Ultra',
  effortMax: 'Extreme',
}

export type I18nKey = keyof typeof zh
export const NS = 'token-usage-board'
export const dictionaries: Record<Language, Dictionary> = { zh, en }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'token-usage-board': I18nKey
  }
}

export function languageOf(locale: string): Language {
  return /^zh(?:-|$)/i.test(locale) ? 'zh' : 'en'
}

export function translate(lang: Language, key: I18nKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[lang][key]
  if (vars !== undefined) {
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

export function formatDateLabel(date: string, lang: Language): string {
  const [, month = '', day = ''] = date.split('-')
  return lang === 'zh' ? `${Number(month)}月${Number(day)}日` : `${Number(month)}/${Number(day)}`
}

export function numberLocaleOf(lang: Language): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US'
}

let localeRuntime: LocaleRuntime | null = null

export function installLocale(locale: LocaleRuntime): () => void {
  localeRuntime = locale
  const unregister = locale.register(NS, dictionaries)
  return () => {
    unregister()
    if (localeRuntime === locale) localeRuntime = null
  }
}

const FALLBACK_SNAPSHOT = { active: 'zh', revision: 0 }

export function useLocale(): {
  lang: Language
  numberLocale: string
  t: (key: I18nKey, vars?: Record<string, string | number>) => string
} {
  const snapshot = useSyncExternalStore(
    callback => localeRuntime?.subscribe(callback) ?? (() => {}),
    () => localeRuntime?.getSnapshot() ?? FALLBACK_SNAPSHOT,
  )
  const lang = languageOf(snapshot.active)
  return {
    lang,
    numberLocale: numberLocaleOf(lang),
    t: (key, vars) => translate(lang, key, vars),
  }
}
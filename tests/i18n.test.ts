import { describe, expect, it, vi } from 'vitest'
import { formatDateLabel, installLocale, languageOf, numberLocaleOf, translate } from '../src/client/i18n.js'

describe('i18n', () => {
  it('translates and interpolates Chinese and English copy', () => {
    expect(translate('zh', 'nav')).toBe('使用统计')
    expect(translate('en', 'nav')).toBe('Usage Stats')
    expect(translate('en', 'dayDetail', { date: '8/17', tokens: '1.2K', token: 'tokens', calls: 3, callsUnit: 'calls' })).toBe('8/17 · 1.2K tokens · 3 calls')
expect(translate('zh', 'hourMinute', { h: 9, m: 56 })).toBe('9 小时 56 分')
  })

  it('maps locale tags and number locales', () => {
    expect(languageOf('zh-CN')).toBe('zh')
    expect(languageOf('zh-Hant')).toBe('zh')
    expect(languageOf('en-US')).toBe('en')
    expect(languageOf('de-DE')).toBe('en')
    expect(numberLocaleOf('zh')).toBe('zh-CN')
    expect(numberLocaleOf('en')).toBe('en-US')
  })

  it('formats compact date labels for each language', () => {
    expect(formatDateLabel('2026-08-17', 'zh')).toBe('8月17日')
    expect(formatDateLabel('2026-08-17', 'en')).toBe('8/17')
  })

  it('unregisters dictionaries during plugin disposal', () => {
    const unregister = vi.fn()
    const register = vi.fn(() => unregister)
    const dispose = installLocale({ register } as never)
    expect(register).toHaveBeenCalledWith('activity-dashboard', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    dispose()
    expect(unregister).toHaveBeenCalledOnce()
  })
})

import { describe, expect, it } from 'vitest'
import { styles } from '../src/client/styles.js'

describe('activity dashboard layout', () => {
  it('keeps the daily heat grid and its month axis column-aligned', () => {
    const heatColumns = styles.match(/\.us-heat \{[^}]*grid-template-columns:\s*repeat\((\d+),/)?.[1]
    const monthColumns = styles.match(/\.us-heat-months \{[^}]*grid-template-columns:\s*repeat\((\d+),/)?.[1]

    expect(heatColumns).toBe('53')
    expect(monthColumns).toBe(heatColumns)
  })

  it('renders five stat cells and a two-column insight/plugin duo', () => {
    const statColumns = styles.match(/\.us-stats-strip \{[^}]*grid-template-columns:\s*repeat\((\d+),/)?.[1]
    const duoColumns = styles.match(/\.us-duo \{[^}]*grid-template-columns:\s*1fr\s+1fr;/)?.[0] !== undefined

    expect(statColumns).toBe('5')
    expect(duoColumns).toBe(true)
  })
})
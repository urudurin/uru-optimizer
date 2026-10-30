import {
  backupReminder,
  recordBackup,
  snoozeBackupReminder,
} from 'lib/games/shared/backup'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

describe('backupReminder', () => {
  beforeEach(() => {
    // Tests run without a browser, so a Map stands in for localStorage
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  const day = (date: string) => new Date(`${date}T12:00:00Z`)

  it('reminds when there is data and no backup yet, never without data', () => {
    expect(backupReminder('zzz', true, day('2026-10-30'))).toEqual({ due: true, daysSince: undefined })
    expect(backupReminder('zzz', false, day('2026-10-30')).due).toBe(false)
  })

  it('stays quiet for two weeks after a backup, per game', () => {
    recordBackup('zzz', '2026-10-20')
    expect(backupReminder('zzz', true, day('2026-10-30'))).toEqual({ due: false, daysSince: 10 })
    expect(backupReminder('zzz', true, day('2026-11-03'))).toEqual({ due: true, daysSince: 14 })
    expect(backupReminder('wuwa', true, day('2026-10-30')).due).toBe(true)
  })

  it('puts the reminder off for a week with Later', () => {
    snoozeBackupReminder('genshin', day('2026-10-30'))
    expect(backupReminder('genshin', true, day('2026-11-05')).due).toBe(false)
    expect(backupReminder('genshin', true, day('2026-11-06')).due).toBe(true)
  })
})

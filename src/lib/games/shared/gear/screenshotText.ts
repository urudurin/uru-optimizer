import type {
  GearDraft,
  GearOption,
} from 'lib/games/shared/gear/gearKind'
import type { ScreenPanel } from 'lib/games/shared/gear/screenshotOcr'

// Turns the OCR text of a gear screenshot (shared/gear/screenshotOcr.ts) into an editor draft. Each game describes its
// screen once as a ScreenshotSpec (names of slots, sets and stats, how it shows the level); the user checks the filled-in
// editor before saving, so anything not read stays as it was in the draft.

// A stat as the game writes it: the names it goes by and whether its value carries a % (ATK vs ATK%)
export type ScreenStat = { value: string, names: string[], percent: boolean }

export type ScreenshotSpec = {
  // The details panel on a full-screen 16:9 screenshot, read on its own (shared/gear/screenshotOcr.ts)
  panel?: ScreenPanel,
  // Slot names written on the piece (Genshin "Flower of Life"); slotFromLines for slots shown otherwise
  slotNames?: { value: string, names: string[] }[],
  slotFromLines?: (lines: string[]) => string | undefined,
  // The level as shown, e.g. ZZZ "Lv. 15/15"; default a line that is just "+20"
  levelFromLines?: (lines: string[]) => number | undefined,
  sets: GearOption[],
  // A game-specific pick matched by name, e.g. WuWa's echo (draft.extra[key])
  extra?: { key: string, options: (draft: GearDraft) => GearOption[] },
  stats: ScreenStat[],
  // Stat lines after the main stat that aren't substats (WuWa's fixed flat ATK or HP), given the draft so far
  skipAfterMain?: (draft: GearDraft) => number,
  // A substat value as read -> the draft's value (ZZZ roll count, WuWa's nearest roll tier), undefined to leave it out
  substatValue: (stat: string, value: number, draft: GearDraft) => number | undefined,
  substatCount: number,
}

export type ScreenshotResult = { draft: GearDraft, found: string[], missed: string[] }

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim()
}

// Fixes letters OCR often reads in place of digits next to digits, then reads the first number (commas as thousands)
export function readNumber(text: string): number | undefined {
  const fixed = text.replace(/(?<=\d)[oO]|[oO](?=\d)/g, '0').replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, '1')
  const match = /\d[\d,]*(?:\.\d+)?/.exec(fixed)
  if (!match) return undefined
  const value = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(value) ? value : undefined
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

// How well a line holds a name, 0-1: 1 when the name is in it, else the best match over same-length stretches of words
export function nameScore(line: string, name: string): number {
  const text = normalize(line)
  const target = normalize(name)
  if (!target) return 0
  if (` ${text} `.includes(` ${target} `)) return 1
  const words = text.split(' ')
  const size = target.split(' ').length
  let best = 0
  for (let i = 0; i + size <= words.length; i++) {
    const stretch = words.slice(i, i + size).join(' ')
    best = Math.max(best, 1 - editDistance(stretch, target) / Math.max(stretch.length, target.length))
  }
  return best
}

// The option whose name best appears in any line, if it's close enough; longer names win ties (Gladiator's Finale over a
// shorter name inside it)
export function bestOption(lines: string[], options: { value: string, names: string[] }[], min = 0.8): string | undefined {
  let best: { value: string, score: number, length: number } | undefined
  for (const option of options) {
    for (const name of option.names) {
      for (const line of lines) {
        const score = nameScore(line, name)
        if (score < min) continue
        if (!best || score > best.score || (score === best.score && name.length > best.length)) best = { value: option.value, score, length: name.length }
      }
    }
  }
  return best?.value
}

const SET_BONUS_LINE = /\b\d\s*-?\s*(piece|pc|pcs)\b|set\s*:/i

// A stat at the start of a line followed by its value: the stat (by name and whether a % follows) and the value
export function readStatLine(line: string, stats: ScreenStat[]): { stat: string, value: number } | undefined {
  const text = line.replace(/^[^A-Za-z]+/, '')
  const read = readStatAt(text, stats)
  if (read) return read
  // A stat icon read as a stray letter or two ("XK ATK 18.0%")
  const icon = /^\S{1,2}\s+(?=[A-Za-z])/.exec(text)
  return icon ? readStatAt(text.slice(icon[0].length), stats) : undefined
}

function readStatAt(text: string, stats: ScreenStat[]): { stat: string, value: number } | undefined {
  let best: { names: ScreenStat[], length: number, rest: string } | undefined
  const lower = text.toLowerCase()
  for (const stat of stats) {
    for (const name of stat.names) {
      const n = name.toLowerCase()
      if (!lower.startsWith(n)) continue
      const after = lower[n.length]
      if (after && /[a-z]/.test(after)) continue
      if (!best || n.length > best.length) best = { names: [stat], length: n.length, rest: text.slice(n.length) }
      else if (n.length === best.length && !best.names.includes(stat)) best.names.push(stat)
    }
  }
  if (!best) return undefined
  // The value is the last number: ZZZ writes the upgrade count first ("CRIT Rate +2 7.2%")
  const numbers = best.rest.split(/(?<=[\d%])\s+(?=[+\d])/)
  const last = numbers[numbers.length - 1]
  const value = readNumber(last)
  if (value === undefined) return undefined
  const percent = /\d\s*%/.test(last)
  const stat = best.names.find((s) => s.percent === percent) ?? best.names[0]
  return { stat: stat.value, value }
}

// A stat name alone on a line, its value on the next (Genshin's main stat): joined into one line
function joinSplitStats(lines: string[], stats: ScreenStat[]): string[] {
  const names = new Set(stats.flatMap((s) => s.names.map((n) => n.toLowerCase())))
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const bare = lines[i].replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, '').toLowerCase()
    if (names.has(bare) && i + 1 < lines.length && /^[\d.,\s%oOlI]+$/.test(lines[i + 1])) {
      out.push(`${lines[i]} ${lines[i + 1]}`)
      i++
    } else {
      out.push(lines[i])
    }
  }
  return out
}

function defaultLevel(lines: string[]): number | undefined {
  for (const line of lines) {
    const match = /^\+\s?(\d{1,2})$/.exec(line.trim())
    if (match) return Number(match[1])
  }
  return undefined
}

export function draftFromScreenshot(lines: string[], spec: ScreenshotSpec, base: GearDraft): ScreenshotResult {
  const found: string[] = []
  const missed: string[] = []
  const draft: GearDraft = { ...base, substats: [...base.substats], extra: { ...base.extra } }

  const slot = spec.slotFromLines?.(lines) ?? (spec.slotNames ? bestOption(lines, spec.slotNames) : undefined)
  if (slot) {
    draft.slot = slot
    found.push('slot')
  } else {
    missed.push('slot')
  }

  const level = (spec.levelFromLines ?? defaultLevel)(lines)
  if (level !== undefined) {
    draft.level = level
    found.push('level')
  } else {
    missed.push('level')
  }

  const setId = bestOption(lines, spec.sets.map((o) => ({ value: o.value, names: [o.label] })))
  if (setId) {
    draft.setId = setId
    found.push('set')
  } else {
    missed.push('set')
  }

  // Stats come before the set bonus text, which can name stats too ("DEF is at least 1,800")
  const joined = joinSplitStats(lines, spec.stats)
  const setText = joined.findIndex((line) => SET_BONUS_LINE.test(line))
  const statLines = (setText < 0 ? joined : joined.slice(0, setText))
    .map((line) => readStatLine(line, spec.stats))
    .filter((read): read is { stat: string, value: number } => !!read)
  if (statLines.length > 0) {
    draft.mainStat = statLines[0].stat
    found.push('main stat')
    const rest = statLines.slice(1 + (spec.skipAfterMain?.(draft) ?? 0))
    const substats: GearDraft['substats'] = []
    for (const read of rest) {
      if (substats.length >= spec.substatCount) break
      if (substats.some((s) => s.stat === read.stat)) continue
      const value = spec.substatValue(read.stat, read.value, draft)
      if (value !== undefined) substats.push({ stat: read.stat, value })
    }
    draft.substats = substats
    if (substats.length > 0) found.push(`${substats.length} substat${substats.length === 1 ? '' : 's'}`)
    else missed.push('substats')
  } else {
    missed.push('main stat', 'substats')
  }

  if (spec.extra) {
    const value = bestOption(lines, spec.extra.options(draft).map((o) => ({ value: o.value, names: [o.label] })))
    if (value) {
      draft.extra[spec.extra.key] = value
      found.push(spec.extra.key === 'defId' ? 'echo' : spec.extra.key)
    } else {
      missed.push(spec.extra.key === 'defId' ? 'echo' : spec.extra.key)
    }
  }

  return { draft, found, missed }
}

// Buffs typed in by hand, after HSR's Extra combat buffs drawer (lib/tabs/tabOptimizer/optimizerForm/components/
// CombatBuffsDrawer.tsx): anything the optimizer doesn't model (a teammate or weapon it doesn't cover, an event buff),
// added to every build like the team's buffs. Saved per character in the optimizer settings as extraBuffs
// { [key]: value }; each game lists its keys (ExtraBuffDef) and adds them to its team stats and enemy debuffs.

export type ExtraBuffDef = {
  key: string,
  label: string,
}

export type ExtraBuffs = Record<string, number>

// The buffs that are set, in the game's order
export function activeExtraBuffs(defs: ExtraBuffDef[], buffs: ExtraBuffs | undefined): { def: ExtraBuffDef, value: number }[] {
  return defs.flatMap((def) => {
    const value = buffs?.[def.key]
    return typeof value === 'number' && Number.isFinite(value) && value !== 0 ? [{ def, value }] : []
  })
}

export function extraBuffsSummary(defs: ExtraBuffDef[], buffs: ExtraBuffs | undefined): string {
  const active = activeExtraBuffs(defs, buffs)
  if (active.length === 0) return 'No extra buffs'
  return active.map(({ def, value }) => `${value > 0 ? '+' : ''}${value} ${def.label}`).join(', ')
}

// The buffs with one value changed; 0 or empty removes it
export function setExtraBuff(buffs: ExtraBuffs | undefined, key: string, value: number | undefined): ExtraBuffs {
  const next = { ...buffs }
  if (value === undefined || !Number.isFinite(value) || value === 0) delete next[key]
  else next[key] = value
  return next
}

// Adds the buffs whose keys are stats to a stat bonus (keys the game maps elsewhere are skipped)
export function addExtraStats<K extends string>(
  base: Partial<Record<K, number>>,
  buffs: ExtraBuffs | undefined,
  statKeys: readonly K[],
): Partial<Record<K, number>> {
  const total = { ...base }
  for (const key of statKeys) {
    const value = buffs?.[key]
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) total[key] = (total[key] ?? 0) + value
  }
  return total
}

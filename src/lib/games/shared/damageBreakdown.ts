// Where a build's rotation damage comes from, for the build analysis (shared/ui/BuildAnalysis.tsx). In all three games a
// rotation's damage is the sum of its lines' damage (every line takes the same stats and enemy), so one line's share is
// the damage of a rotation with that line only. Shared by the ZZZ, Genshin and WuWa optimizer pages.

export type DamageLine = {
  key: string,
  label: string,
  // What the line belongs to, e.g. 'Ultimate', 'Attribute Anomaly', 'Echo Skill'
  group: string,
  count: number,
}

export type DamagePart = DamageLine & { damage: number }

// Each counted line's damage, largest first. damageOf works out the damage of a rotation with only this line in it
export function splitDamage(lines: DamageLine[], damageOf: (line: DamageLine) => number): DamagePart[] {
  return lines
    .filter((line) => line.count > 0)
    .map((line) => ({ ...line, damage: damageOf(line) }))
    .filter((part) => part.damage > 0)
    .sort((a, b) => b.damage - a.damage)
}

// Damage per group, largest first, for the one-line summary above the bars
export function damageByGroup(parts: DamagePart[]): { group: string, damage: number }[] {
  const byGroup = new Map<string, number>()
  for (const part of parts) byGroup.set(part.group, (byGroup.get(part.group) ?? 0) + part.damage)
  return [...byGroup].map(([group, damage]) => ({ group, damage })).sort((a, b) => b.damage - a.damage)
}

// Changes to a teammate for the team buffs only, after HSR's teammate cards (eidolon, light cone, superimposition and
// sets per teammate, with "Sync from roster"): each game's team/teamBuffs.ts applies them to its copy of the teammate
// before working out what they give, so the saved character never changes. Kept per receiving character in the
// optimizer settings as teammateOverrides { [teammateId]: TeammateOverride }; a field left out keeps the roster's.

export type TeammateOverride = {
  // Constellation (Genshin), Mindscape (ZZZ) or Sequence (WuWa), 0-6
  rank?: number,
  weaponId?: string,
  // Refinement (Genshin, ZZZ) or rank (WuWa), 1-5
  refinement?: number,
  // The 4-piece set they count as wearing, NO_SET for none (Genshin, ZZZ)
  fourPiece?: string,
}

export type TeammateOverrides = Record<string, TeammateOverride>

export const NO_SET = 'none'

// What the roster has, to compare edits with
export type TeammateRoster = Required<Pick<TeammateOverride, 'rank' | 'refinement'>> & { weaponId?: string, fourPiece?: string }

// The overrides with one field changed. A value that matches the roster drops the field (it's the roster's again), and
// a teammate left with no changes drops out
export function setOverride<K extends keyof TeammateOverride>(
  overrides: TeammateOverrides,
  id: string,
  field: K,
  value: TeammateOverride[K],
  roster: TeammateRoster,
): TeammateOverrides {
  const current: TeammateOverride = { ...overrides[id] }
  const rosterValue = field === 'fourPiece' ? (roster.fourPiece ?? NO_SET) : roster[field]
  if (value === undefined || value === rosterValue) delete current[field]
  else current[field] = value
  // A new weapon starts at the refinement it's given, or R1, unless it's the roster's weapon again
  if (field === 'weaponId' && value !== undefined && value !== roster.weaponId && current.refinement === undefined) current.refinement = 1
  if (field === 'weaponId' && value === roster.weaponId && current.refinement === roster.refinement) delete current.refinement
  const next = { ...overrides }
  if (Object.keys(current).length === 0) delete next[id]
  else next[id] = current
  return next
}

// The teammate as the team buffs see them
export function resolveTeammate(roster: TeammateRoster, override: TeammateOverride | undefined): TeammateRoster {
  if (!override) return roster
  const weaponId = override.weaponId ?? roster.weaponId
  return {
    rank: override.rank ?? roster.rank,
    weaponId,
    refinement: override.refinement ?? (override.weaponId && override.weaponId !== roster.weaponId ? 1 : roster.refinement),
    fourPiece: override.fourPiece ?? roster.fourPiece,
  }
}

// Only overrides for current teammates, so removing a teammate forgets their changes
export function keepOverridesFor(overrides: TeammateOverrides | undefined, teammates: string[]): TeammateOverrides {
  return Object.fromEntries(Object.entries(overrides ?? {}).filter(([id]) => teammates.includes(id)))
}

// Whole 4-piece sets in a list of pieces
export function fourPieceSetsOf(setIds: string[]): string[] {
  const counts = new Map<string, number>()
  for (const setId of setIds) counts.set(setId, (counts.get(setId) ?? 0) + 1)
  return [...counts].filter(([, count]) => count >= 4).map(([setId]) => setId)
}

// The 4-piece sets that count for a teammate: the override's when there is one, else what they wear
export function teammateFourPieces(worn: string[], override: TeammateOverride | undefined): string[] {
  if (override?.fourPiece === undefined) return worn
  return override.fourPiece === NO_SET ? [] : [override.fourPiece]
}

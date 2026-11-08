// One record per character that says how to play them, after HSR's ScoringMetadata (src/types/metadata.ts): substat
// weights, ideal main stats, the optimizer's default rank and rotation, and (later) the DPS score's Default team and the
// sets and main stats its benchmark may use. HSR drives relic scores, optimizer defaults, the character screen's Default
// team and the Benchmarks tab from this record; each game builds its own in <game>/data/metadata.ts.
//
// Our rules (CLAUDE.md): committed entries are our own, hand-written, with a source and a review date. Recommendations
// from guide sites only ever come in through the user's local imported presets file, never into these records.
//
// See ../hsr-workflow-review.md for the plan; step 1 moves today's tables in without changing what anything does.

export type MetadataConfidence = 'confirmed' | 'guide' | 'sourced' | 'unverified'

// A teammate in a curated scoring team (HSR SimulationMetadata.teammates): rank = Constellation / Mindscape / Sequence
export type SimulationTeammate = {
  id: string,
  rank?: number,
  weaponId?: string,
  refinement?: number,
  fourPiece?: string,
}

// The DPS score's Default setup (HSR SimulationMetadata): the team, the rotation, and the sets, main stats and substats
// the benchmark builds may use. Not filled in yet for any character (hsr-workflow-review.md step 2 onwards)
export type SimulationMetadata<Rotation> = {
  teammates: SimulationTeammate[],
  rotation: Rotation,
  // Set options, each a list of set ids worn together
  sets: string[][],
  // Main stat options per slot (or WuWa cost)
  parts: Record<string, string[]>,
  // The substats the benchmark places rolls in
  substats: string[],
}

export type CharacterMetadata<Rotation> = {
  characterId: string,
  // Substat weights, CRIT at 1 (gear scores, potential, the Scoring weights modal's defaults); usually 0 to 1, but a
  // WuWa guide that ranks Energy Regen first gives it more (Shorekeeper, Youhu 1.25)
  stats: Record<string, number>,
  // Ideal main stats per slot; a slot left out (or empty) means any
  parts: Record<string, string[]>,
  // The optimizer's default rank: 'damage' or one of the game's stat targets
  sortOption: string,
  // The default rotation with no team (each game's defaultRotation)
  rotation: Rotation,
  simulation?: SimulationMetadata<Rotation>,
  // Where the entry comes from, in plain words, how sure it is, and when it was last checked (YYYY-MM-DD)
  source: string,
  confidence: MetadataConfidence,
  reviewed: string,
}

// What's wrong with an entry, for the tests: every committed entry needs weights, a source and a real review date
export function metadataProblems(metadata: CharacterMetadata<unknown>): string[] {
  const problems: string[] = []
  if (Object.keys(metadata.stats).length === 0) problems.push('no substat weights')
  for (const [stat, weight] of Object.entries(metadata.stats)) {
    if (!(weight >= 0 && Number.isFinite(weight))) problems.push(`weight ${stat} = ${weight} isn't a number from 0 up`)
  }
  if (!metadata.source.trim()) problems.push('no source')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.reviewed) || Number.isNaN(Date.parse(metadata.reviewed))) {
    problems.push(`review date "${metadata.reviewed}" isn't YYYY-MM-DD`)
  }
  if (!metadata.sortOption) problems.push('no default rank')
  return problems
}

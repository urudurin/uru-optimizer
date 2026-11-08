import type { SimulationMetadata } from 'lib/games/shared/characterMetadata'

// The DPS score's benchmark sets and main stats from the character's metadata simulation (hsr-workflow-review.md step
// 4), after HSR, whose benchmark builds pick their sets and mains from the curated lists. Each variant is the build's
// own pieces with one set option and one choice of main stats per slot; shared/damageScore.ts benchmarks every variant
// and compares the build with the best. Substats are the build's own (the score replaces them anyway). No simulation,
// or one without sets or mains: no variants, and the build's own sets and mains are kept, as before.

export type PieceOps<Piece> = {
  // The main stat slot a piece is in, as the metadata's parts name it (Genshin sands/goblet/circlet, ZZZ 4/5/6, WuWa cost)
  slotOf: (piece: Piece) => string,
  // The piece at max level with this main stat, or undefined when the slot can't have it
  withMain: (piece: Piece, stat: string) => Piece | undefined,
  withSet: (piece: Piece, setId: string) => Piece,
  // How many pieces each set of an option takes (Genshin 4 or 2 + 2, ZZZ 4 + 2, WuWa the whole loadout)
  setPattern: (option: string[], pieces: number) => number[],
}

// At most this many variants, so a score stays a fraction of a second
export const MAX_VARIANTS = 12

export function benchmarkVariants<Piece>(pieces: Piece[], simulation: SimulationMetadata<unknown> | undefined, ops: PieceOps<Piece>): Piece[][] {
  if (!simulation) return []
  const slots = [...new Set(pieces.map(ops.slotOf))].filter((slot) => (simulation.parts[slot]?.length ?? 0) > 0)
  if (simulation.sets.length === 0 && slots.length === 0) return []

  // Every combination of the listed main stats, slot by slot
  let combos: Record<string, string>[] = [{}]
  for (const slot of slots) combos = combos.flatMap((combo) => simulation.parts[slot].map((stat) => ({ ...combo, [slot]: stat })))
  const setOptions: (string[] | undefined)[] = simulation.sets.length > 0 ? simulation.sets : [undefined]
  combos = combos.slice(0, Math.max(1, Math.floor(MAX_VARIANTS / setOptions.length)))

  const variants: Piece[][] = []
  for (const option of setOptions) {
    for (const combo of combos) {
      const next = pieces.map((piece) => {
        const stat = combo[ops.slotOf(piece)]
        return stat ? ops.withMain(piece, stat) ?? piece : piece
      })
      if (option) {
        const counts = ops.setPattern(option, next.length)
        let index = 0
        option.forEach((setId, k) => {
          for (let n = 0; n < (counts[k] ?? 0) && index < next.length; n++, index++) next[index] = ops.withSet(next[index], setId)
        })
      }
      variants.push(next)
    }
  }
  return variants
}

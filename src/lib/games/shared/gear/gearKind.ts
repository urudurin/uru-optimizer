import type { GearScore } from 'lib/games/shared/gearScore'
import type { ReactNode } from 'react'

// One game's gear (ZZZ discs, Genshin artifacts, WuWa echoes) described for the shared inventory grid and editor
// (shared/ui/gear), after Fribbels' HSR relics tab (lib/tabs/tabRelics) and relic editor (lib/overlays/modals/relicModal).
// A new game only writes one of these.

export type GearOption = { value: string, label: string }

// What the editor works on. Values are whatever the game's substat inputs produce: a roll count for ZZZ, a value as
// shown for Genshin and WuWa
export type GearDraft = {
  slot: string,
  setId: string,
  rarity: string,
  level: number,
  mainStat: string,
  substats: { stat: string, value: number }[],
  // Game-specific fields, e.g. WuWa's echo
  extra: Record<string, string>,
}

export type GearKind<T> = {
  // 'Disc', 'Artifact', 'Echo'
  noun: string,

  // Grid and filters
  slots: GearOption[],
  slotOf: (item: T) => string,
  sets: () => GearOption[],
  setOf: (item: T) => string,
  setName: (item: T) => string,
  setIcon?: (item: T) => string | undefined,
  rarities: GearOption[],
  rarityOf: (item: T) => string,
  levelOf: (item: T) => number,
  mainStatOf: (item: T) => string,
  mainValueText: (item: T) => string,
  // Every substat stat, in column order
  substats: GearOption[],
  // Substat values as shown in game, by stat
  substatValues: (item: T) => Partial<Record<string, number>>,
  // A good-but-not-perfect total for one stat on one piece, the top of its column's color scale
  columnTop: (stat: string) => number,
  formatValue: (stat: string, value: number) => string,
  statLabel: (stat: string) => string,
  ownerOf: (item: T) => string | undefined,
  ownerName: (id: string) => string,
  score: (item: T) => GearScore | undefined,
  // The piece as a card, for the preview beside the grid
  preview: (item: T) => ReactNode,

  // Editor
  maxLevel: (draft: GearDraft) => number,
  substatCount: number,
  // Whether a substat can be the same stat as the main stat (WuWa yes, ZZZ and Genshin no)
  substatCanMatchMain: boolean,
  mainStats: (draft: GearDraft) => GearOption[],
  // The main stat's value for the draft, as shown, or why it can't be worked out
  mainValuePreview: (draft: GearDraft) => string,
  // Fixed values a substat can take; without it the editor shows a number input
  substatChoices?: (draft: GearDraft, stat: string) => GearOption[],
  substatStep?: (stat: string) => number,
  // Extra inputs above the main stat, e.g. WuWa's echo picker
  extraFields?: (draft: GearDraft, update: (changes: Partial<GearDraft>) => void) => ReactNode,
  newDraft: () => GearDraft,
  toDraft: (item: T) => GearDraft,
  // The piece, or what's wrong with the draft. existing is the piece being edited, whose id and owner it keeps
  fromDraft: (draft: GearDraft, existing?: T) => { item?: T, errors: string[] },
}

let counter = 0

// An id for a piece added by hand
export function newGearId(prefix: string): string {
  counter++
  return `uru-${prefix}-${Date.now().toString(36)}-${counter}`
}

// Genshin Impact data model. Stats a character shows come straight from the game (via Enka.Network), so there is no
// stat calculator yet: that comes with the artifact optimizer.

export type GenshinStatKey =
  | 'hp'
  | 'hpPct'
  | 'atk'
  | 'atkPct'
  | 'def'
  | 'defPct'
  | 'critRate'
  | 'critDmg'
  | 'energyRecharge'
  | 'elementalMastery'
  | 'healingBonus'
  | 'physicalDmg'
  | 'pyroDmg'
  | 'hydroDmg'
  | 'anemoDmg'
  | 'electroDmg'
  | 'dendroDmg'
  | 'cryoDmg'
  | 'geoDmg'

export const STAT_LABELS: Record<GenshinStatKey, string> = {
  hp: 'HP',
  hpPct: 'HP%',
  atk: 'ATK',
  atkPct: 'ATK%',
  def: 'DEF',
  defPct: 'DEF%',
  critRate: 'CRIT Rate',
  critDmg: 'CRIT DMG',
  energyRecharge: 'Energy Recharge',
  elementalMastery: 'Elemental Mastery',
  healingBonus: 'Healing Bonus',
  physicalDmg: 'Physical DMG Bonus',
  pyroDmg: 'Pyro DMG Bonus',
  hydroDmg: 'Hydro DMG Bonus',
  anemoDmg: 'Anemo DMG Bonus',
  electroDmg: 'Electro DMG Bonus',
  dendroDmg: 'Dendro DMG Bonus',
  cryoDmg: 'Cryo DMG Bonus',
  geoDmg: 'Geo DMG Bonus',
}

// Stats shown with a percent sign
export const PERCENT_STATS = new Set<GenshinStatKey>([
  'hpPct',
  'atkPct',
  'defPct',
  'critRate',
  'critDmg',
  'energyRecharge',
  'healingBonus',
  'physicalDmg',
  'pyroDmg',
  'hydroDmg',
  'anemoDmg',
  'electroDmg',
  'dendroDmg',
  'cryoDmg',
  'geoDmg',
])

export function statLabel(stat: string): string {
  return STAT_LABELS[stat as GenshinStatKey] ?? stat
}

export function formatStatValue(stat: GenshinStatKey, value: number): string {
  if (PERCENT_STATS.has(stat)) return `${(Math.round(value * 10) / 10).toFixed(1)}%`
  return Math.round(value).toLocaleString('en-US')
}

export type Element = 'Pyro' | 'Hydro' | 'Anemo' | 'Electro' | 'Dendro' | 'Cryo' | 'Geo'

export const ELEMENT_DMG_STAT: Record<Element, GenshinStatKey> = {
  Pyro: 'pyroDmg',
  Hydro: 'hydroDmg',
  Anemo: 'anemoDmg',
  Electro: 'electroDmg',
  Dendro: 'dendroDmg',
  Cryo: 'cryoDmg',
  Geo: 'geoDmg',
}

export type ArtifactSlot = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet'

export const ARTIFACT_SLOTS: ArtifactSlot[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']

export const SLOT_LABELS: Record<ArtifactSlot, string> = {
  flower: 'Flower',
  plume: 'Plume',
  sands: 'Sands',
  goblet: 'Goblet',
  circlet: 'Circlet',
}

export type ArtifactSubstat = {
  stat: GenshinStatKey,
  // As the game shows it, e.g. 6.6 for 6.6% CRIT Rate
  value: number,
  // How many times the substat rolled, including the first
  rolls: number,
}

export type Artifact = {
  id: string,
  slot: ArtifactSlot,
  setId: string,
  setName: string,
  rarity: number,
  // 0 to 20
  level: number,
  main: { stat: GenshinStatKey, value: number },
  substats: ArtifactSubstat[],
  // Character id, when the source knows who wears it
  equippedBy?: string,
}

export type GenshinWeapon = {
  id: string,
  name: string,
  rarity: number,
  level: number,
  refinement: number,
  // Enka imports only, GOOD files don't have weapon stats
  baseAtk?: number,
  secondary?: { stat: GenshinStatKey, value: number },
}

export type GenshinCharacter = {
  // GOOD character key, e.g. 'RaidenShogun' or 'TravelerAnemo'
  id: string,
  name: string,
  element?: Element,
  level: number,
  constellation: number,
  weapon?: GenshinWeapon,
  artifactIds: Partial<Record<ArtifactSlot, string>>,
  // Final stats as the character screen shows them, from the game via Enka. Empty for characters only in a GOOD file
  stats: Partial<Record<GenshinStatKey, number>>,
  // YYYY-MM-DD the stats were imported
  statsDate: string,
}

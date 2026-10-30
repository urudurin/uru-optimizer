import { enkaStoreLoader } from 'lib/games/shared/enka'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  AgentBaseStats,
  AgentData,
  Specialty,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import { W_ENGINE_PASSIVES } from 'lib/games/zzz/data/wEnginePassives'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import { elementOf } from 'lib/games/zzz/importer/enkaParser'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'
import {
  useEffect,
  useState,
} from 'react'

// Base stats for every agent and W-Engine, from Enka.Network's ZZZ store files (avatars.json, weapons.json), using the
// formulas in Enka's API docs ("Agent base stats", "W-Engine stats"). They're loaded when a page needs them and added to
// AGENTS and W_ENGINES, never copied into this repo. The hand-written entries in agents.ts and wEngines.ts were checked
// against stat screens and always win.
//
// Checked against those: Miyabi's HP, ATK and DEF match exactly; Yixuan's and Soldier 0 - Anby's come out up to ~1.4
// high (the store's growth values are rounded), like Gachabase's. So Enka-only agents are 'sourced' and may be a point
// off on HP, ATK or DEF. Not in the store: W-Engine passives (data/wEnginePassives.ts has some; the
// stat screen never shows passives anyway), Core Skill effects that aren't base stats, and Rupture agents' Sheer Force
// from HP (0 here, which leaves their Sheer Force low).

type AvatarEntry = {
  Name?: string,
  ProfessionType?: string,
  ElementTypes?: string[],
  BaseProps?: Record<string, number>,
  GrowthProps?: Record<string, number>,
  PromotionProps?: Record<string, number>[],
  CoreEnhancementProps?: Record<string, number>[],
}

type WeaponEntry = {
  ItemName?: string,
  Rarity?: number,
  ProfessionType?: string,
  MainStat?: { PropertyId: number, PropertyValue: number },
  SecondaryStat?: { PropertyId: number, PropertyValue: number },
}

const AGENT_LEVEL = 60
// Level 60 after the last promotion, and Core Skill F: what the hand-written agents assume
const PROMOTION = 5
const CORE_SKILL = 6

// W-Engines at level 60, fully modified (break level 5), from the example in Enka's docs:
// 684 = 46 * (1 + 94090 / 10000 + 44610 / 10000) and 2400 = 960 * (1 + 15000 / 10000). Same for every rarity: it gives
// the 743 / 713 base ATK and 24% / 48% secondary stats of the hand-written S-rank W-Engines
const WEAPON_MAIN_SCALE = 1 + 94090 / 10000 + 44610 / 10000
const WEAPON_SECONDARY_SCALE = 1 + 15000 / 10000

const RARITIES: Record<number, WEngineData['rarity']> = { 4: 'S', 3: 'A', 2: 'B' }

// Enka property ids (store/zzz/property.json) for W-Engine secondary stats; percents are in hundredths of a percent
const SECONDARY_STATS: Record<number, { stat: ZzzStatsValues, scale: number }> = {
  11102: { stat: ZzzStats.HP_P, scale: 100 },
  12102: { stat: ZzzStats.ATK_P, scale: 100 },
  13102: { stat: ZzzStats.DEF_P, scale: 100 },
  12202: { stat: ZzzStats.IMPACT, scale: 100 },
  20103: { stat: ZzzStats.CRIT_RATE, scale: 100 },
  21103: { stat: ZzzStats.CRIT_DMG, scale: 100 },
  23103: { stat: ZzzStats.PEN_RATIO, scale: 100 },
  30502: { stat: ZzzStats.ENERGY_REGEN, scale: 100 },
  31203: { stat: ZzzStats.ANOMALY_PROFICIENCY, scale: 1 },
  31402: { stat: ZzzStats.ANOMALY_MASTERY, scale: 100 },
}

// Base Total = BaseProps + Growth x (level - 1) / 10000 + Promotion + Core Enhancement, rounded down as Enka advises,
// except HP: the game keeps its fraction (10 of the user's stat screens, Oct 30 2026, match only that way)
export function agentBaseStats(entry: AvatarEntry, level = AGENT_LEVEL): AgentBaseStats {
  const promotion = entry.PromotionProps?.[PROMOTION] ?? {}
  const core = entry.CoreEnhancementProps?.[CORE_SKILL] ?? {}
  const total = (id: string) => (entry.BaseProps?.[id] ?? 0) + ((entry.GrowthProps?.[id] ?? 0) * (level - 1)) / 10000 + (promotion[id] ?? 0) + (core[id] ?? 0)
  return {
    hp: total('11101'),
    atk: Math.floor(total('12101')),
    def: Math.floor(total('13101')),
    impact: Math.floor(total('12201')),
    critRate: total('20101') / 100,
    critDmg: total('21101') / 100,
    anomalyMastery: Math.floor(total('31401')),
    anomalyProficiency: Math.floor(total('31201')),
    penRatio: total('23101') / 100,
    energyRegen: total('30501') / 100,
  }
}

const HP_SHEER_FORCE: Record<string, number> = { '1471': 0.1, '1441': 0.1, '1051': 0.1 }

export function agentFromEnka(id: string, entry: AvatarEntry, name: string): AgentData {
  const specialty = (entry.ProfessionType ?? 'Attack') as Specialty
  return {
    id,
    name,
    element: elementOf(id, entry.ElementTypes),
    specialty,
    level: AGENT_LEVEL,
    base: agentBaseStats(entry),
    // Rupture agents' Sheer Force from HP is a Core Passive, not in the store: 0.1 per HP for Banyue, Manato and Yidhari
    // (genshin-optimizer's core_hpSheerForce), none known for the rest
    ...(specialty === 'Rupture' ? { sheerForce: { fromAtk: 0.3, fromHp: HP_SHEER_FORCE[id] ?? 0 } } : {}),
    coreEffects: Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [level, []])),
  }
}

export function wEngineFromEnka(id: string, entry: WeaponEntry, name: string): WEngineData | undefined {
  const main = entry.MainStat
  const secondary = entry.SecondaryStat ? SECONDARY_STATS[entry.SecondaryStat.PropertyId] : undefined
  if (!main || !secondary || !entry.SecondaryStat) return undefined
  return {
    id,
    name,
    rarity: RARITIES[entry.Rarity ?? 4] ?? 'S',
    specialty: (entry.ProfessionType ?? 'Attack') as Specialty,
    baseAtk: Math.floor(main.PropertyValue * WEAPON_MAIN_SCALE),
    subStat: { stat: secondary.stat, value: Math.floor((entry.SecondaryStat.PropertyValue * WEAPON_SECONDARY_SCALE) / secondary.scale * 10) / 10 },
    // Not in the store: passives come from data/wEnginePassives.ts where written, none otherwise
    passive: W_ENGINE_PASSIVES[id] ?? (() => []),
  }
}

export type ZzzGameDataResult = { agents: number, wEngines: number }

const loadStore = enkaStoreLoader(['zzz/avatars.json', 'zzz/weapons.json', 'zzz/locs.json'], (files) => files)

// Adds every agent and W-Engine Enka knows to AGENTS and W_ENGINES, keeping the hand-written ones. Safe to call often:
// the store files load once per page (or worker)
export async function loadZzzGameData(): Promise<ZzzGameDataResult | undefined> {
  const result = await loadStore()
  if (!result.ok) return undefined
  const [avatars, weapons, locs] = result.data as [Record<string, AvatarEntry>, Record<string, WeaponEntry>, Record<string, Record<string, string>>]
  const names = locs.en ?? {}
  let agents = 0
  let wEngines = 0
  for (const [id, entry] of Object.entries(avatars)) {
    const name = entry.Name ? names[entry.Name] : undefined
    if (AGENTS[id] || !name || !entry.BaseProps) continue
    AGENTS[id] = agentFromEnka(id, entry, name)
    agents++
  }
  for (const [id, entry] of Object.entries(weapons)) {
    const name = entry.ItemName ? names[entry.ItemName] : undefined
    if (W_ENGINES[id] || !name) continue
    const engine = wEngineFromEnka(id, entry, name)
    if (engine) {
      W_ENGINES[id] = engine
      wEngines++
    }
  }
  return { agents, wEngines }
}

// Loads the game data once and re-renders when it arrives; pages that read AGENTS or W_ENGINES call this
export function useZzzGameData(): boolean {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let live = true
    void loadZzzGameData().then(() => {
      if (live) setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [])
  return loaded
}

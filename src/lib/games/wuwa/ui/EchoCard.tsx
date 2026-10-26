import {
  Badge,
  Group,
  Text,
} from '@mantine/core'
import { roundHalfUp } from 'lib/games/shared/format'
import type { GearScore } from 'lib/games/shared/gearScore'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { GearScoreLine } from 'lib/games/shared/ui/GearScoreLine'
import {
  ECHO_DEFINITIONS,
  SONATA_SETS,
} from 'lib/games/wuwa/data/gameData'
import {
  mainStatValue,
  SECONDARY_MAIN,
  secondaryMainValue,
  SUBSTAT_TIERS,
  tierOf,
} from 'lib/games/wuwa/echoStats'
import {
  type Echo,
  type ElementDmgKey,
  statLabel,
} from 'lib/games/wuwa/types'

// Mantine colors for WuWa elements, used for character badges
const ELEMENT_COLORS: Record<ElementDmgKey, string> = {
  glacioDmg: 'cyan',
  fusionDmg: 'orange',
  electroDmg: 'violet',
  aeroDmg: 'teal',
  spectroDmg: 'yellow',
  havocDmg: 'grape',
}

export function elementColor(element: ElementDmgKey | undefined): string {
  return element ? ELEMENT_COLORS[element] : 'gray'
}

// "electroDmg" -> "Electro"
export function elementName(element: ElementDmgKey): string {
  return statLabel(element).replace(' DMG', '')
}

export function echoName(echo: Echo): string {
  return ECHO_DEFINITIONS[echo.defId]?.name ?? echo.defId
}

export function setName(setId: string): string {
  return SONATA_SETS[setId]?.name ?? setId
}

// How high a roll is among the substat's tiers, as dots (8 tiers for most stats, 4 for flat ATK and DEF)
function TierDots({ tier, of }: { tier: number, of: number }) {
  return (
    <span className={gear.dots} title={`Tier ${tier} of ${of}`}>
      {Array.from({ length: tier }, (_, i) => <span key={i} className={gear.dot} />)}
    </span>
  )
}

// score: for the Resonator shown (stats/echoScore.ts)
export function EchoCard({ echo, owner, score }: { echo: Echo, owner?: string, score?: GearScore }) {
  const secondary = SECONDARY_MAIN[echo.cost]
  return (
    <div className={gear.card}>
      <Group justify='space-between' gap={6} wrap='nowrap'>
        <Badge size='sm' variant='light' radius='sm'>{`Cost ${echo.cost}`}</Badge>
        <Text size='xs' c='dimmed'>{`+${echo.level}`}</Text>
      </Group>
      <div className={gear.title}>{echoName(echo)}</div>
      <div className={gear.subtitle}>{setName(echo.setId)}</div>
      <div className={gear.main}>
        <span>{statLabel(echo.mainStat)}</span>
        <span>{roundHalfUp(mainStatValue(echo.cost, echo.mainStat, echo.level), 1)}</span>
      </div>
      <div className={gear.secondary}>
        <span>{statLabel(secondary.stat)}</span>
        <span>{Math.floor(secondaryMainValue(echo.cost, echo.level))}</span>
      </div>
      <div className={gear.subs}>
        {echo.substats.map((substat) => {
          const tier = tierOf(substat.stat, substat.value)
          return (
            <div key={substat.stat} className={gear.sub}>
              <span>{statLabel(substat.stat)}</span>
              {tier !== undefined && <TierDots tier={tier} of={SUBSTAT_TIERS[substat.stat].length} />}
              <span className={gear.subValue}>{substat.value}</span>
            </div>
          )
        })}
      </div>
      <GearScoreLine score={score} />
      {owner && <div className={gear.footer}>{`Worn by ${owner}`}</div>}
    </div>
  )
}

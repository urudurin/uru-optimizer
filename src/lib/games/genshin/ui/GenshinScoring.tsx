import {
  ActionIcon,
  Drawer,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import { hasTalentData } from 'lib/games/genshin/damage/damage'
import {
  EffectsCard,
  EnemyCard,
  RotationCard,
} from 'lib/games/genshin/damage/DamageCards'
import type { GenshinImages } from 'lib/games/genshin/data/images'
import { GenshinTeamCards } from 'lib/games/genshin/GenshinTeamCards'
import { genshinDamageScore } from 'lib/games/genshin/optimizer/analysis'
import {
  genshinDamageDefaults,
  type GenshinDamageSettings,
  genshinDamageSetup,
} from 'lib/games/genshin/optimizer/damageSetup'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { formatNumber } from 'lib/games/shared/format'
import {
  mergeSettings,
  optimizerSettingsStore,
} from 'lib/games/shared/optimizerSettings'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { fourPieceSetsOf } from 'lib/games/shared/teammateOverrides'
import {
  BuildRating,
  DPS_SCORE_LABEL,
} from 'lib/games/shared/ui/BuildRating'
import {
  type ReactNode,
  useState,
} from 'react'

// The Characters page's DPS score, after HSR's character screen (lib/characterPreview/scoring/ShowcaseSimScore.tsx):
// worked out on the page from a scoring setup, with the team under the score, Default / Custom and a settings button.
// Custom is the character's own damage settings, the same ones the optimizer's Teammates and Damage rows edit
// (genshin-optimizer-settings); Default is the kit alone: no team, the default enemy and rotation.

const SETTINGS_KEY = 'genshin-optimizer-settings'
// Default or Custom per character, after HSR's showcase team preference
const MODE_KEY = 'genshin-scoring-mode'
type ScoringMode = 'default' | 'custom'

function readModes(): Record<string, ScoringMode> {
  try {
    const parsed: unknown = JSON.parse(readStorage(MODE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, ScoringMode> : {}
  } catch {
    return {}
  }
}

function useScoringMode(characterId: string): [ScoringMode, (mode: ScoringMode) => void] {
  const [modes, setModes] = useState(readModes)
  const mode = modes[characterId] === 'default' ? 'default' : 'custom'
  const set = (next: ScoringMode) => {
    const all = { ...readModes(), [characterId]: next }
    writeStorage(MODE_KEY, JSON.stringify(all))
    setModes(all)
  }
  return [mode, set]
}

// The character's own damage settings (Custom), and a function to change some of them; other optimizer settings stay
function useCustomSettings(characterId: string): [GenshinDamageSettings, (change: Partial<GenshinDamageSettings>) => void] {
  const store = optimizerSettingsStore(SETTINGS_KEY)
  const saved = store((s) => s.saved.byCharacter[characterId])
  const settings = mergeSettings(genshinDamageDefaults(characterId), saved)
  const update = (change: Partial<GenshinDamageSettings>) => {
    const { saved: all, write } = store.getState()
    const current = all.byCharacter[characterId] ?? {}
    write({
      ...all,
      byCharacter: { ...all.byCharacter, [characterId]: { ...current, ...mergeSettings(genshinDamageDefaults(characterId), current), ...change } },
    })
  }
  return [settings, update]
}

export function GenshinScoring({ character, worn, roster, artifacts, images, fallback }: {
  character: GenshinCharacter,
  // Five worn artifacts; fewer shows the fallback
  worn: Artifact[],
  // Every character (state/roster.ts), for teammates
  roster: GenshinCharacter[],
  artifacts: Artifact[],
  images: GenshinImages,
  // Shown when there's no DPS score (no talent data, not a full set): the gear score
  fallback: ReactNode,
}) {
  const [mode, setMode] = useScoringMode(character.id)
  const [custom, updateCustom] = useCustomSettings(character.id)
  const [setupOpen, setSetupOpen] = useState(false)
  if (!hasTalentData(character.id) || worn.length < 5) return <>{fallback}</>

  const settings = mode === 'default' ? genshinDamageDefaults(character.id) : custom
  const fourPieceSet = fourPieceSetsOf(worn.map((a) => a.setId))[0]
  const setup = genshinDamageSetup(character, settings, fourPieceSet, { characters: roster, artifacts })
  const score = genshinDamageScore(character, worn, { kind: 'damage', setup: setup.damageSetup }, setup.teamBuffs, setup.combat)
  if (!score) return <>{fallback}</>

  // Editing the setup scores Custom, like changing a teammate on HSR's showcase
  const edit = (change: Partial<GenshinDamageSettings>) => {
    updateCustom(change)
    if (mode !== 'custom') setMode('custom')
  }
  const openSetup = () => {
    if (mode !== 'custom') setMode('custom')
    setSetupOpen(true)
  }
  const nameOf = (id: string) => roster.find((c) => c.id === id)?.name ?? id

  return (
    <Stack gap={6} align='center'>
      <BuildRating score={score} label={DPS_SCORE_LABEL} />
      <Text size='xs' c='dimmed'>{`Rotation damage ${formatNumber(Math.round(score.damage))}`}</Text>
      <Group gap='xs' justify='center'>
        {[0, 1, 2].map((index) => {
          const id = settings.teammates[index]
          const icon = id ? images.characters[id.replace(/^Traveler.*/, 'Traveler')]?.icon ?? images.characters[id]?.icon : undefined
          return (
            <Tooltip key={index} label={id ? nameOf(id) : 'Add a teammate'}>
              <UnstyledButton
                onClick={openSetup}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '1px solid var(--mantine-color-dark-3)',
                  background: 'var(--mantine-color-dark-6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon
                  ? <img src={icon} alt={nameOf(id)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Text size='xs' c='dimmed'>{id ? nameOf(id).slice(0, 2) : '+'}</Text>}
              </UnstyledButton>
            </Tooltip>
          )
        })}
      </Group>
      <Group gap='xs' justify='center' wrap='nowrap'>
        <SegmentedControl
          size='xs'
          value={mode}
          onChange={(value) => setMode(value as ScoringMode)}
          data={[{ value: 'default', label: 'Default' }, { value: 'custom', label: 'Custom' }]}
        />
        <Tooltip label='Scoring setup: team, enemy, rotation and effects'>
          <ActionIcon variant='default' onClick={openSetup} aria-label='Scoring setup'>
            <IconSettings size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Text size='xs' c='dimmed' ta='center'>
        {mode === 'default' ? 'Default: the kit alone, no team.' : 'Custom: the team and rotation from the optimizer.'}
      </Text>

      <Drawer opened={setupOpen} onClose={() => setSetupOpen(false)} position='right' size={900} title={`Scoring setup · ${character.name}`}>
        <Stack gap='md'>
          <Text size='xs' c='dimmed'>
            The same settings as the optimizer's Teammates and Damage rows for this character: a change here shows there too.
          </Text>
          <Group align='flex-start' gap='md'>
            <GenshinTeamCards
              character={character}
              characters={roster}
              team={setup.team}
              result={setup.teamResult}
              onTeammates={(ids) => edit({ teammates: ids })}
              onField={(value) => edit({ onField: value })}
              onSetting={(key, value) => edit({ teamSettings: { ...custom.teamSettings, [key]: value } })}
            />
            <EnemyCard enemy={custom.enemy} debuffs={setup.damageSetup.debuffs} onChange={(enemy) => edit({ enemy })} />
            <RotationCard
              character={character}
              rotation={custom.rotation}
              talents={setup.talents}
              team={setup.reactionsInTeam}
              teamElements={setup.teamResult.members.flatMap((member) => member.element ?? [])}
              damage={score.damage}
              onChange={(rotation) => edit({ rotation })}
            />
            <EffectsCard
              name={character.name}
              fourPieceSet={fourPieceSet ? worn.find((a) => a.setId === fourPieceSet)?.setName ?? fourPieceSet : undefined}
              applied={setup.resolvedCombat.applied}
              onSetting={(id, value) => edit({ combatSettings: { ...custom.combatSettings, [id]: value } })}
            />
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  )
}

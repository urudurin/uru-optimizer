import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import {
  IconCopy,
  IconRefresh,
  IconRotate,
  IconSettings,
} from '@tabler/icons-react'
import type { GameId } from 'lib/games/games'
import type { DamageScore } from 'lib/games/shared/damageScore'
import { formatNumber } from 'lib/games/shared/format'
import {
  mergeSettings,
  optimizerSettingsStore,
} from 'lib/games/shared/optimizerSettings'
import { presetImportStore } from 'lib/games/shared/presetImports'
import {
  type ScoringMode,
  scoringStore,
} from 'lib/games/shared/scoringOverrides'
import type { TeammateOverrides } from 'lib/games/shared/teammateOverrides'
import {
  BuildRating,
  DPS_SCORE_LABEL,
} from 'lib/games/shared/ui/BuildRating'
import {
  type ReactNode,
  useState,
} from 'react'

// The characters pages' DPS score, after HSR's character screen (lib/characterPreview/scoring/ShowcaseSimScore.tsx):
// worked out on the page from a scoring setup, with the team under the score, Default / Custom and a settings button
// that opens the setup. As in HSR, Custom is a scoring setup of its own (shared/scoringOverrides.ts,
// <game>-scoring-overrides), apart from the optimizer's settings; Default is the character's metadata simulation, or
// the kit alone (no team, the default enemy and rotation) without one, and is what a character starts on. Each game
// (genshin/ui/GenshinScoring.tsx, zzz/ui/ZzzScoring.tsx, wuwa/ui/WuwaScoring.tsx) works the score out and passes
// the setup's cards.

export type { ScoringMode }

type ScoringFields = { teammateOverrides: TeammateOverrides }

export type ScoringSetup<T> = {
  mode: ScoringMode,
  setMode: (mode: ScoringMode) => void,
  // The setup being scored (Default or Custom)
  settings: T,
  // The Custom setup: the saved one, or a copy of Default until it's edited
  custom: T,
  customSaved: boolean,
  // Changes the Custom setup and scores Custom, like changing a teammate on HSR's showcase
  edit: (change: Partial<T>) => void,
  // HSR's sync teammates: every teammate as in the roster (their own rank, weapon and sets)
  syncTeammates: () => void,
  // Copies the optimizer's team, enemy, rotation and effects for this character into Custom
  copyFromOptimizer: () => void,
  hasOptimizerSettings: boolean,
  // Drops the Custom setup and scores Default
  resetCustom: () => void,
}

// defaults: the Default setup (scoringDefaults: the simulation, or the kit alone); kitAlone: the optimizer's damage
// defaults, under its saved settings when copying them
export function useScoringSetup<T extends ScoringFields>(game: string, characterId: string, defaults: T, kitAlone: T): ScoringSetup<T> {
  const store = scoringStore(game)
  // Re-render when the user's presets file changes: it can give the character a Default team (shared/presetImports.ts)
  presetImportStore(game as GameId)((s) => s.stored)
  presetImportStore(game as GameId)((s) => s.enabled)
  const mode = store((s) => s.modes[characterId]) ?? 'default'
  const saved = store((s) => s.overrides.byCharacter[characterId])
  const optimizerSaved = optimizerSettingsStore(`${game}-optimizer-settings`)((s) => s.saved.byCharacter[characterId])
  const custom = mergeSettings(defaults, saved)
  const { setMode, setOverride } = store.getState()
  const edit = (change: Partial<T>) => {
    const current = mergeSettings(defaults, store.getState().overrides.byCharacter[characterId])
    setOverride(characterId, { ...current, ...change })
    if (mode !== 'custom') setMode(characterId, 'custom')
  }
  return {
    mode,
    setMode: (next) => setMode(characterId, next),
    settings: mode === 'default' ? defaults : custom,
    custom,
    customSaved: saved !== undefined,
    edit,
    syncTeammates: () => edit({ teammateOverrides: {} } as Partial<T>),
    copyFromOptimizer: () => edit(mergeSettings(kitAlone, optimizerSaved)),
    hasOptimizerSettings: optimizerSaved !== undefined,
    resetCustom: () => {
      setOverride(characterId, undefined)
      setMode(characterId, 'default')
    },
  }
}

export type ScoringTeammate = { id: string, name: string, icon?: string }

export function CharacterScoringPanel({ name, score, scoring, teammates, slots, defaultText, setup }: {
  name: string,
  score: DamageScore,
  // useScoringSetup's result (the setup's type doesn't matter here)
  scoring: Omit<ScoringSetup<unknown>, 'settings' | 'custom' | 'edit'>,
  teammates: ScoringTeammate[],
  // Teammate slots shown (Genshin and WuWa 3, ZZZ 2)
  slots: number,
  // What Default means for this game
  defaultText: string,
  // The setup drawer's cards (team, enemy, rotation, effects); they edit Custom
  setup: ReactNode,
}) {
  const [open, setOpen] = useState(false)
  const { mode, setMode } = scoring
  const openSetup = () => {
    if (mode !== 'custom') setMode('custom')
    setOpen(true)
  }
  return (
    <Stack gap={6} align='center'>
      <BuildRating score={score} label={DPS_SCORE_LABEL} />
      <Text size='xs' c='dimmed'>{`Rotation damage ${formatNumber(Math.round(score.damage))}`}</Text>
      <Group gap='xs' justify='center'>
        {Array.from({ length: slots }, (_, index) => {
          const mate = teammates[index]
          return (
            <Tooltip key={index} label={mate ? mate.name : 'Add a teammate'}>
              <UnstyledButton
                onClick={openSetup}
                aria-label={mate ? `Teammate ${mate.name}` : 'Add a teammate'}
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
                {mate?.icon
                  ? <img src={mate.icon} alt={mate.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Text size='xs' c='dimmed'>{mate ? mate.name.slice(0, 2) : '+'}</Text>}
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
        {mode === 'default' ? defaultText : 'Custom: your own scoring setup for this character.'}
      </Text>

      <Drawer opened={open} onClose={() => setOpen(false)} position='right' size={900} title={`Scoring setup · ${name}`}>
        <Stack gap='md'>
          <Text size='xs' c='dimmed'>
            {`Custom scoring for ${name}, kept apart from the optimizer (its team and rotation don't change). ${
              scoring.customSaved ? '' : 'It starts as a copy of Default. '
            }${defaultText}`}
          </Text>
          <Group gap='xs'>
            <Tooltip label='Every teammate as in your roster: their own rank, weapon and sets'>
              <Button size='xs' variant='default' leftSection={<IconRefresh size={14} />} onClick={scoring.syncTeammates}>
                Sync teammates
              </Button>
            </Tooltip>
            <Tooltip
              label={scoring.hasOptimizerSettings
                ? 'The optimizer\'s team, enemy, rotation and effects for this character'
                : 'No optimizer settings saved for this character yet'}
            >
              <Button
                size='xs'
                variant='default'
                leftSection={<IconCopy size={14} />}
                disabled={!scoring.hasOptimizerSettings}
                onClick={scoring.copyFromOptimizer}
              >
                Copy from optimizer
              </Button>
            </Tooltip>
            <Tooltip label='Drop the Custom setup and score Default'>
              <Button
                size='xs'
                variant='default'
                leftSection={<IconRotate size={14} />}
                disabled={!scoring.customSaved}
                onClick={() => {
                  scoring.resetCustom()
                  setOpen(false)
                }}
              >
                Reset to Default
              </Button>
            </Tooltip>
          </Group>
          <Group align='flex-start' gap='md'>
            {setup}
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  )
}

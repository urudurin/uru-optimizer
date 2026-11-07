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
import type { DamageScore } from 'lib/games/shared/damageScore'
import { formatNumber } from 'lib/games/shared/format'
import {
  mergeSettings,
  optimizerSettingsStore,
} from 'lib/games/shared/optimizerSettings'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
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
// that opens the setup. Custom is the character's own damage settings, the same ones their optimizer page edits
// (<game>-optimizer-settings); Default is each game's kit alone (no team, the default enemy and rotation). Each game
// (genshin/ui/GenshinScoring.tsx, zzz/ui/ZzzScoring.tsx, wuwa/ui/WuwaScoring.tsx) works the score out and passes
// the setup's cards.

export type ScoringMode = 'default' | 'custom'

// Default or Custom per character, after HSR's showcase team preference: <game>-scoring-mode { [characterId]: mode }
function readModes(game: string): Record<string, ScoringMode> {
  try {
    const parsed: unknown = JSON.parse(readStorage(`${game}-scoring-mode`) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, ScoringMode> : {}
  } catch {
    return {}
  }
}

export function useScoringMode(game: string, characterId: string): [ScoringMode, (mode: ScoringMode) => void] {
  const [modes, setModes] = useState(() => readModes(game))
  const mode = modes[characterId] === 'default' ? 'default' : 'custom'
  const set = (next: ScoringMode) => {
    const all = { ...readModes(game), [characterId]: next }
    writeStorage(`${game}-scoring-mode`, JSON.stringify(all))
    setModes(all)
  }
  return [mode, set]
}

// A character's damage settings from their optimizer settings (Custom), and a function to change some of them; the
// optimizer's other settings stay as they are
export function useCustomDamageSettings<T extends object>(settingsKey: string, characterId: string, defaults: T): [T, (change: Partial<T>) => void] {
  const store = optimizerSettingsStore(settingsKey)
  const saved = store((s) => s.saved.byCharacter[characterId])
  const settings = mergeSettings(defaults, saved)
  const update = (change: Partial<T>) => {
    const { saved: all, write } = store.getState()
    const current = all.byCharacter[characterId] ?? {}
    write({ ...all, byCharacter: { ...all.byCharacter, [characterId]: { ...current, ...mergeSettings(defaults, current), ...change } } })
  }
  return [settings, update]
}

export type ScoringTeammate = { id: string, name: string, icon?: string }

export function CharacterScoringPanel({ name, score, mode, onMode, teammates, slots, defaultText, setup }: {
  name: string,
  score: DamageScore,
  mode: ScoringMode,
  onMode: (mode: ScoringMode) => void,
  teammates: ScoringTeammate[],
  // Teammate slots shown (Genshin and WuWa 3, ZZZ 2)
  slots: number,
  // What Default means for this game
  defaultText: string,
  // The setup drawer's cards (team, enemy, rotation, effects); they edit Custom
  setup: ReactNode,
}) {
  const [open, setOpen] = useState(false)
  const openSetup = () => {
    if (mode !== 'custom') onMode('custom')
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
          onChange={(value) => onMode(value as ScoringMode)}
          data={[{ value: 'default', label: 'Default' }, { value: 'custom', label: 'Custom' }]}
        />
        <Tooltip label='Scoring setup: team, enemy, rotation and effects'>
          <ActionIcon variant='default' onClick={openSetup} aria-label='Scoring setup'>
            <IconSettings size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Text size='xs' c='dimmed' ta='center'>
        {mode === 'default' ? defaultText : 'Custom: the team and rotation from the optimizer.'}
      </Text>

      <Drawer opened={open} onClose={() => setOpen(false)} position='right' size={900} title={`Scoring setup · ${name}`}>
        <Stack gap='md'>
          <Text size='xs' c='dimmed'>
            The same settings as the optimizer's team and damage rows for this character: a change here shows there too.
          </Text>
          <Group align='flex-start' gap='md'>
            {setup}
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  )
}

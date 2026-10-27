import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import type {
  GearDraft,
  GearKind,
} from 'lib/games/shared/gear/gearKind'
import classes from 'lib/games/shared/ui/gear/GearInventory.module.css'
import { useState } from 'react'

// Add or edit one piece of gear, after Fribbels' HSR relic editor (lib/overlays/modals/relicModal): slot, set, rarity,
// level and main stat (its value worked out, as in game), then each substat with only the values the game can roll.
// The game's GearKind checks the draft (fromDraft) and Save stays off while anything's wrong.

export function GearEditor<T>({ kind, existing, initial, onClose, onSave }: {
  kind: GearKind<T>,
  existing?: T,
  initial: GearDraft,
  onClose: () => void,
  onSave: (item: T) => void,
}) {
  const [draft, setDraft] = useState(initial)
  const update = (changes: Partial<GearDraft>) => setDraft((prev) => fixMainStat(kind, { ...prev, ...changes }))
  const result = kind.fromDraft(draft, existing)
  const mainStats = kind.mainStats(draft)
  const noun = kind.noun.toLowerCase()

  const substatRows = Array.from({ length: kind.substatCount }, (_, i) => draft.substats[i] ?? { stat: '', value: 0 })
  const setSubstat = (index: number, changes: Partial<{ stat: string, value: number }>) => {
    const next = substatRows.map((row, i) => (i === index ? { ...row, ...changes } : row))
    update({ substats: next.filter((row) => row.stat) })
  }

  return (
    <Modal opened onClose={onClose} title={existing ? `Edit ${noun}` : `Add ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`} size='lg' centered>
      <Stack gap='sm'>
        <Group grow gap='sm'>
          <Select label='Slot' allowDeselect={false} value={draft.slot} onChange={(slot) => slot && update({ slot })} data={kind.slots} />
          {kind.rarities.length > 1 && (
            <Select
              label='Rarity'
              allowDeselect={false}
              value={draft.rarity}
              onChange={(rarity) => rarity && update({ rarity })}
              data={kind.rarities}
            />
          )}
          <NumberInput
            label='Level'
            min={0}
            max={kind.maxLevel(draft)}
            value={draft.level}
            onChange={(value) => update({ level: Math.max(0, Math.floor(Number(value) || 0)) })}
          />
        </Group>
        <Select label='Set' searchable allowDeselect={false} value={draft.setId || null} onChange={(setId) => setId && update({ setId })} data={kind.sets()} />
        {kind.extraFields?.(draft, update)}
        <Group grow gap='sm' align='flex-end'>
          <Select
            label='Main stat'
            allowDeselect={false}
            value={draft.mainStat || null}
            onChange={(mainStat) => mainStat && update({ mainStat })}
            data={mainStats}
          />
          <div>
            <Text size='xs' c='dimmed'>Main value</Text>
            <Text fw={600}>{kind.mainValuePreview(draft)}</Text>
          </div>
        </Group>

        <Text size='sm' fw={600} mt='xs'>Substats</Text>
        {substatRows.map((row, i) => {
          const taken = new Set(substatRows.filter((_, j) => j !== i).map((other) => other.stat))
          if (!kind.substatCanMatchMain) taken.add(draft.mainStat)
          const choices = row.stat ? kind.substatChoices?.(draft, row.stat) : undefined
          return (
            <div key={i} className={classes.substatRow}>
              <Select
                placeholder='None'
                searchable
                clearable
                value={row.stat || null}
                onChange={(stat) => setSubstat(i, { stat: stat ?? '', value: 0 })}
                data={kind.substats.filter((s) => !taken.has(s.value))}
              />
              {choices
                ? (
                  <Select
                    disabled={!row.stat}
                    placeholder='Value'
                    value={row.value ? String(row.value) : null}
                    onChange={(value) => setSubstat(i, { value: Number(value ?? 0) })}
                    data={choices}
                  />
                )
                : (
                  <NumberInput
                    disabled={!row.stat}
                    placeholder='Value'
                    min={0}
                    step={row.stat ? kind.substatStep?.(row.stat) ?? 1 : 1}
                    decimalScale={1}
                    value={row.value || ''}
                    onChange={(value) => setSubstat(i, { value: Number(value) || 0 })}
                  />
                )}
            </div>
          )
        })}

        {result.errors.length > 0 && (
          <Stack gap={2}>
            {result.errors.map((error) => <Text key={error} size='xs' c='red'>{error}</Text>)}
          </Stack>
        )}
        <Group justify='flex-end' gap='xs'>
          <Button variant='subtle' onClick={onClose}>Cancel</Button>
          <Button disabled={!result.item} onClick={() => result.item && onSave(result.item)}>{existing ? 'Save' : `Add ${noun}`}</Button>
        </Group>
        <Text size='xs' c='dimmed'>Changes go to this browser's save only, never the game.</Text>
      </Stack>
    </Modal>
  )
}

// Keeps the main stat one the slot (or cost) allows, so changing the slot never leaves an impossible main stat
function fixMainStat<T>(kind: GearKind<T>, draft: GearDraft): GearDraft {
  const options = kind.mainStats(draft).map((o) => o.value)
  if (options.length > 0 && !options.includes(draft.mainStat)) return { ...draft, mainStat: options[0] }
  return draft
}

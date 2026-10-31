import {
  Button,
  FileButton,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import type {
  GearDraft,
  GearKind,
} from 'lib/games/shared/gear/gearKind'
import { readScreenshotLines } from 'lib/games/shared/gear/screenshotOcr'
import { draftFromScreenshot } from 'lib/games/shared/gear/screenshotText'
import classes from 'lib/games/shared/ui/gear/GearInventory.module.css'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

// The first image on the clipboard of a paste event, if any
export function imageFromClipboard(event: ClipboardEvent): File | undefined {
  for (const item of event.clipboardData?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile() ?? undefined
  }
  return undefined
}

// Add or edit one piece of gear, after Fribbels' HSR relic editor (lib/overlays/modals/relicModal): slot, set, rarity,
// level and main stat (its value worked out, as in game), then each substat with only the values the game can roll.
// The game's GearKind checks the draft (fromDraft) and Save stays off while anything's wrong.

export function GearEditor<T>({ kind, existing, initial, screenshot, onClose, onSave }: {
  kind: GearKind<T>,
  existing?: T,
  initial: GearDraft,
  // A screenshot to read as soon as the editor opens (pasted on the inventory page)
  screenshot?: Blob,
  onClose: () => void,
  // owner: who it should be on (Equipped by): a character id, or null for nobody
  onSave: (item: T, owner: string | null) => void,
}) {
  const [draft, setDraft] = useState(initial)
  // Equipped by, after HSR's relic editor: who wears the piece (empty for nobody)
  const [owner, setOwner] = useState(() => (existing ? kind.ownerOf(existing) ?? '' : ''))
  const update = (changes: Partial<GearDraft>) => setDraft((prev) => fixMainStat(kind, { ...prev, ...changes }))
  const [reading, setReading] = useState<{ busy: boolean, image?: string, message?: string, error?: boolean }>({ busy: false })
  const draftRef = useRef(draft)
  draftRef.current = draft
  const imageUrl = useRef<string | undefined>(undefined)

  const readScreenshot = useCallback(async (image: Blob) => {
    const spec = kind.screenshot
    if (!spec) return
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current)
    imageUrl.current = URL.createObjectURL(image)
    setReading({ busy: true, image: imageUrl.current, message: 'Reading the screenshot… (the first time also loads the text reader, about 4 MB)' })
    try {
      const read = await readScreenshotLines(image, spec.panel)
      let result = draftFromScreenshot(read.lines, spec, draftRef.current)
      // A full-screen-sized screenshot of another screen than expected: try the whole image
      if (read.cropped && !result.found.includes('main stat')) {
        result = draftFromScreenshot((await readScreenshotLines(image, spec.panel, true)).lines, spec, draftRef.current)
      }
      setDraft(fixMainStat(kind, result.draft))
      const message = result.found.length === 0
        ? 'Couldn\'t read anything useful from this screenshot. Try one cropped to the piece\'s details.'
        : `Read ${result.found.join(', ')}.${
          result.missed.length ? ` Not found: ${result.missed.join(', ')}, fill ${result.missed.length === 1 ? 'it' : 'them'} in.` : ''
        } Check every field before saving.`
      setReading((prev) => ({ ...prev, busy: false, message, error: result.found.length === 0 }))
    } catch (e) {
      setReading((prev) => ({ ...prev, busy: false, error: true, message: `Couldn't read the screenshot: ${e instanceof Error ? e.message : String(e)}` }))
    }
  }, [kind])

  // Read a pasted screenshot (Ctrl+V) while the editor is open, and the one handed in on opening
  useEffect(() => {
    if (!kind.screenshot) return
    const onPaste = (event: ClipboardEvent) => {
      const image = imageFromClipboard(event)
      if (!image) return
      event.preventDefault()
      void readScreenshot(image)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [kind, readScreenshot])
  const handedIn = useRef(false)
  useEffect(() => {
    if (screenshot && !handedIn.current) {
      handedIn.current = true
      void readScreenshot(screenshot)
    }
  }, [screenshot, readScreenshot])
  useEffect(() => () => {
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current)
  }, [])
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
        {kind.screenshot && (
          <div
            className={classes.screenshotDrop}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = [...event.dataTransfer.files].find((f) => f.type.startsWith('image/'))
              if (file) void readScreenshot(file)
            }}
          >
            {reading.image && <img src={reading.image} alt='' className={classes.screenshotThumb} />}
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap='xs'>
                <FileButton accept='image/*' onChange={(file) => file && void readScreenshot(file)}>
                  {(props) => (
                    <Button {...props} size='xs' variant='light' leftSection={<IconPhoto size={14} />} loading={reading.busy}>
                      Fill from a screenshot
                    </Button>
                  )}
                </FileButton>
                <Text size='xs' c='dimmed'>{`or paste one (Ctrl+V) or drop it here`}</Text>
              </Group>
              {reading.message
                ? <Text size='xs' c={reading.error ? 'red' : undefined}>{reading.message}</Text>
                : <Text size='xs' c='dimmed'>{`A screenshot of the ${noun}'s details, read in this browser; it isn't saved or sent anywhere.`}</Text>}
            </Stack>
          </div>
        )}
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
        <Group grow gap='sm' align='flex-end'>
          <Select
            label='Set'
            searchable
            allowDeselect={false}
            value={draft.setId || null}
            onChange={(setId) => setId && update({ setId })}
            data={kind.sets()}
          />
          {kind.owners && (
            <Select
              label='Equipped by'
              searchable
              allowDeselect={false}
              value={owner}
              onChange={(value) => setOwner(value ?? '')}
              data={[{ value: '', label: 'None' }, ...kind.owners()]}
            />
          )}
        </Group>
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
          <Button disabled={!result.item} onClick={() => result.item && onSave(result.item, owner || null)}>{existing ? 'Save' : `Add ${noun}`}</Button>
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

import {
  Alert,
  Button,
  FileInput,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { roundHalfUp } from 'lib/games/shared/format'
import type { ImportMode } from 'lib/games/shared/storage'
import {
  characterName,
  ECHO_DEFINITIONS,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { validateLoadout } from 'lib/games/wuwa/echoRules'
import { mainStatValue } from 'lib/games/wuwa/echoStats'
import { parseWuwaUserDataJson } from 'lib/games/wuwa/importer/userDataParser'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  type Echo,
  statLabel,
} from 'lib/games/wuwa/types'
import {
  useMemo,
  useState,
} from 'react'

const MAX_WARNINGS_SHOWN = 8

function echoName(echo: Echo): string {
  return ECHO_DEFINITIONS[echo.defId]?.name ?? echo.defId
}

function setName(setId: string): string {
  return SONATA_SETS[setId]?.name ?? setId
}

function describeMainStat(echo: Echo): string {
  return `${statLabel(echo.mainStat)} ${roundHalfUp(mainStatValue(echo.cost, echo.mainStat, echo.level), 1)}`
}

export function WuwaApp() {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const warnings = useWuwaStore((s) => s.lastWarnings)
  const importParsed = useWuwaStore((s) => s.importParsed)
  const clear = useWuwaStore((s) => s.clear)
  const [mode, setMode] = useState<ImportMode>('merge')

  const echoById = useMemo(() => new Map(echoes.map((echo) => [echo.id, echo])), [echoes])
  const wearer = useMemo(() => {
    const byEcho = new Map<string, string>()
    for (const character of characters) {
      for (const id of character.echoIds) if (id) byEcho.set(id, characterName(character.charId))
    }
    return byEcho
  }, [characters])
  const sortedEchoes = useMemo(() => [...echoes].sort((a, b) => b.cost - a.cost || setName(a.setId).localeCompare(setName(b.setId))), [echoes])

  async function handleFile(file: File | null) {
    if (!file) return
    importParsed(parseWuwaUserDataJson(await file.text()), mode)
  }

  function handleClear() {
    if (window.confirm('Remove all stored WuWa echoes and characters?')) clear()
  }

  return (
    <Stack p='md' gap='md' style={{ flex: 1, minWidth: 0 }}>
      <Title order={3}>Wuthering Waves</Title>

      <Group align='flex-end' gap='md'>
        <FileInput
          label='Import echoes and characters'
          placeholder='Choose a WuwaEchoScorer user-data file (.json)'
          accept='application/json,.json'
          clearable
          onChange={handleFile}
        />
        <SegmentedControl
          size='xs'
          value={mode}
          onChange={(value) => setMode(value === 'replace' ? 'replace' : 'merge')}
          data={[
            { value: 'merge', label: 'Merge' },
            { value: 'replace', label: 'Replace' },
          ]}
        />
        <Button variant='default' size='xs' onClick={handleClear} disabled={echoes.length === 0 && characters.length === 0}>
          Clear data
        </Button>
      </Group>

      <Text size='sm'>{`${echoes.length} echoes, ${characters.length} characters. Kept in this browser only.`}</Text>

      {warnings.length > 0 && (
        <Alert color='yellow' title={`${warnings.length} warning${warnings.length === 1 ? '' : 's'} during the last import`}>
          <Stack gap={2}>
            {warnings.slice(0, MAX_WARNINGS_SHOWN).map((warning, i) => <Text key={i} size='xs'>{warning}</Text>)}
            {warnings.length > MAX_WARNINGS_SHOWN && <Text size='xs'>{`...and ${warnings.length - MAX_WARNINGS_SHOWN} more`}</Text>}
          </Stack>
        </Alert>
      )}

      {characters.length > 0 && (
        <Table.ScrollContainer minWidth={720}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Character</Table.Th>
                <Table.Th>Level / sequence</Table.Th>
                <Table.Th>Weapon</Table.Th>
                <Table.Th>Echoes (main first)</Table.Th>
                <Table.Th>Cost</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {characters.map((character) => {
                const loadout = character.echoIds.flatMap((id) => {
                  const echo = id ? echoById.get(id) : undefined
                  return echo ? [echo] : []
                })
                const problems = validateLoadout(loadout)
                const weapon = character.weaponId ? WEAPONS[character.weaponId]?.name ?? character.weaponId : 'None'
                return (
                  <Table.Tr key={character.charId}>
                    <Table.Td>{characterName(character.charId)}</Table.Td>
                    <Table.Td>{`Lv ${character.level}, S${character.sequence}`}</Table.Td>
                    <Table.Td>{`${weapon} R${character.refinement}`}</Table.Td>
                    <Table.Td>
                      {character.echoIds.map((id, i) => {
                        const echo = id ? echoById.get(id) : undefined
                        return <Text key={i} size='xs'>{echo ? `${echoName(echo)} (${echo.cost}): ${describeMainStat(echo)}` : 'Empty slot'}</Text>
                      })}
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{`${loadout.reduce((sum, echo) => sum + echo.cost, 0)} / 12`}</Text>
                      {problems.map((problem, i) => <Text key={i} size='xs' c='yellow'>{problem}</Text>)}
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {sortedEchoes.length > 0 && (
        <Table.ScrollContainer minWidth={720}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Echo</Table.Th>
                <Table.Th>Cost / level</Table.Th>
                <Table.Th>Sonata set</Table.Th>
                <Table.Th>Main stat</Table.Th>
                <Table.Th>Substats</Table.Th>
                <Table.Th>Worn by</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedEchoes.map((echo) => (
                <Table.Tr key={echo.id}>
                  <Table.Td>{echoName(echo)}</Table.Td>
                  <Table.Td>{`${echo.cost} / +${echo.level}`}</Table.Td>
                  <Table.Td>{setName(echo.setId)}</Table.Td>
                  <Table.Td>{describeMainStat(echo)}</Table.Td>
                  <Table.Td>{echo.substats.map((sub) => `${statLabel(sub.stat)} ${sub.value}`).join(', ')}</Table.Td>
                  <Table.Td>{wearer.get(echo.id) ?? ''}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  )
}

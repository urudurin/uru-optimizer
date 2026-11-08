import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconTrash,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  scoreWithTeam,
  teamsStore,
} from 'lib/games/shared/savedTeams'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import {
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import { Message } from 'lib/interactions/message'
import {
  type ReactNode,
  useState,
} from 'react'

// The Teams page of every game, after HSR's Teams panel: saved teams (shared/savedTeams.ts) with each member's rating
// (their DPS score on the Characters page, or the gear score) and a button that scores every member with this team.

export type TeamOption = { value: string, label: string, icon?: string }

export function TeamsView({ game, size, options, rating, characterPage }: {
  game: string,
  // Members per team (Genshin 4, ZZZ and WuWa 3)
  size: number,
  options: TeamOption[],
  // A member's rating, as the Characters page shows it
  rating: (id: string) => ReactNode,
  // What the game calls its characters page
  characterPage: string,
}) {
  const store = teamsStore(game)
  const teams = store((s) => s.teams)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const label = (id: string) => options.find((o) => o.value === id)?.label ?? id
  const icon = (id: string) => options.find((o) => o.value === id)?.icon

  function add() {
    if (members.length < 2) return
    store.getState().save({ id: `team-${Date.now()}`, name: name.trim() || members.map(label).join(' / '), members })
    setName('')
    setMembers([])
  }

  async function remove(id: string, teamName: string) {
    if (!await confirmAction('Delete team', `Delete "${teamName}"?`, { danger: true, confirmLabel: 'Delete' })) return
    store.getState().remove(id)
  }

  return (
    <Stack gap='md'>
      <PageHeader
        title='Teams'
        description={`Saved teams, each member rated like on the ${characterPage} page. "Score with this team" makes each member's Custom DPS score use the others as teammates.`}
      />
      <Panel title='New team'>
        <Group align='flex-end' gap='sm'>
          <TextInput size='xs' label='Name' placeholder='Optional' value={name} onChange={(event) => setName(event.currentTarget.value)} w={220} />
          <MultiSelect
            size='xs'
            label={`Members (up to ${size})`}
            searchable
            maxValues={size}
            data={options.map(({ value, label: text }) => ({ value, label: text }))}
            value={members}
            onChange={setMembers}
            w={420}
          />
          <Button size='xs' onClick={add} disabled={members.length < 2}>Save team</Button>
        </Group>
      </Panel>
      {teams.length === 0
        ? (
          <Panel>
            <Text size='sm' c='dimmed'>No saved teams yet.</Text>
          </Panel>
        )
        : teams.map((team) => (
          <Panel
            key={team.id}
            title={team.name}
            actions={
              <Group gap='xs'>
                <Button
                  size='compact-xs'
                  variant='light'
                  leftSection={<IconUsersGroup size={14} />}
                  onClick={() => {
                    scoreWithTeam(game, team.members, size - 1)
                    Message.success(`Each member of ${team.name} now scores Custom with this team`)
                  }}
                >
                  Score with this team
                </Button>
                <Tooltip label='Delete team'>
                  <ActionIcon size='sm' variant='subtle' color='red' aria-label={`Delete ${team.name}`} onClick={() => void remove(team.id, team.name)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            }
          >
            <Group align='flex-start' gap='lg'>
              {team.members.map((id) => (
                <Stack key={id} gap={4} align='center' w={180}>
                  {icon(id)
                    ? <img src={icon(id)} alt={label(id)} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                    : <Text size='sm' fw={600}>{label(id).slice(0, 2)}</Text>}
                  <Text size='xs' fw={600}>{label(id)}</Text>
                  {rating(id)}
                </Stack>
              ))}
            </Group>
          </Panel>
        ))}
    </Stack>
  )
}

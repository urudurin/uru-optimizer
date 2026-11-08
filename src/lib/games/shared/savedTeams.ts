import { scoringStore } from 'lib/games/shared/scoringOverrides'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import {
  create,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'

// Saved teams, after HSR's Teams panel on the Characters tab: named teams of 3 or 4 characters, each member scored in
// that team. Kept per game in <game>-teams { teams: SavedTeamEntry[] } (in backups). "Score with this team" makes each
// member's Custom DPS score setup (shared/scoringOverrides.ts) use the other members as teammates, like picking a team
// on HSR's character screen.

export type SavedTeamEntry = { id: string, name: string, members: string[] }

const teamsKey = (game: string) => `${game}-teams`

export function readTeams(game: string): SavedTeamEntry[] {
  try {
    const parsed: unknown = JSON.parse(readStorage(teamsKey(game)) ?? '{}')
    const teams = parsed && typeof parsed === 'object' && 'teams' in parsed ? (parsed as { teams: unknown }).teams : []
    return (Array.isArray(teams) ? teams : []).filter((team): team is SavedTeamEntry =>
      typeof team === 'object' && team !== null && typeof team.id === 'string' && typeof team.name === 'string' && Array.isArray(team.members)
      && team.members.every((member: unknown) => typeof member === 'string')
    )
  } catch {
    return []
  }
}

type TeamsStore = {
  teams: SavedTeamEntry[],
  save: (team: SavedTeamEntry) => void,
  remove: (id: string) => void,
  reload: () => void,
}

const stores = new Map<string, UseBoundStore<StoreApi<TeamsStore>>>()

export function teamsStore(game: string): UseBoundStore<StoreApi<TeamsStore>> {
  let store = stores.get(game)
  if (!store) {
    const write = (teams: SavedTeamEntry[]) => writeStorage(teamsKey(game), JSON.stringify({ teams }))
    store = create<TeamsStore>()((set, get) => ({
      teams: readTeams(game),
      save: (team) => {
        const teams = get().teams.some((t) => t.id === team.id) ? get().teams.map((t) => (t.id === team.id ? team : t)) : [...get().teams, team]
        write(teams)
        set({ teams })
      },
      remove: (id) => {
        const teams = get().teams.filter((t) => t.id !== id)
        write(teams)
        set({ teams })
      },
      reload: () => set({ teams: readTeams(game) }),
    }))
    stores.set(game, store)
  }
  return store
}

export function reloadTeams(game: string) {
  stores.get(game)?.getState().reload()
}

// Each member scores Custom with the other members as teammates (their other Custom settings stay). Members past the
// game's teammate slots are left out of that member's team
export function scoreWithTeam(game: string, members: string[], slots: number) {
  const { overrides, setOverride, setMode } = scoringStore(game).getState()
  for (const member of members) {
    const teammates = members.filter((id) => id !== member).slice(0, slots)
    setOverride(member, { ...overrides.byCharacter[member], teammates })
    setMode(member, 'custom')
  }
}

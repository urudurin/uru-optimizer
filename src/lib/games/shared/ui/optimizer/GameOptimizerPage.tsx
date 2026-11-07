import {
  type SettingsUpdate,
  useActiveCharacter,
  useCharacterSettings,
} from 'lib/games/shared/optimizerSettings'
import {
  type PinnedCell,
  usePinnedBuilds,
} from 'lib/games/shared/ui/optimizer/BuildCompare'
import {
  OptimizerImportFirst,
  OptimizerPageShell,
  OptimizerResults,
} from 'lib/games/shared/ui/optimizer/OptimizerPage'
import {
  type OptimizerKind,
  useBuildActions,
} from 'lib/games/shared/ui/optimizer/useBuildActions'
import { useOptimizerRun } from 'lib/games/shared/ui/optimizer/useOptimizerRun'
import {
  OptimizerSidebar,
  type OptimizerSidebarProps,
  type StatView,
} from 'lib/games/shared/ui/OptimizerSidebar'
import type { WorkerRunner } from 'lib/games/shared/workerRunner'
import {
  type ComponentProps,
  type ReactNode,
  useState,
} from 'react'

// One optimizer page for every game, after HSR's single optimizer tab. The page owns what works the same everywhere:
// the open character (shared/optimizerSettings.ts), their saved settings, the search (useOptimizerRun), pins, the stat
// view, Equip / Save build / Load builds (useBuildActions), and the layout (OptimizerPage.tsx, OptimizerSidebar). Each
// game describes the rest once as an OptimizerPageKind: its data, default settings, and useView, which works out the
// form rows, the search request, the results and the build preview for one character.

export type OptimizerData<C, P> = {
  // Every character the optimizer can open (the roster, state/roster.ts)
  characters: C[],
  // Every piece of gear in the save
  gear: P[],
}

type Search<R, Runner extends WorkerRunner<never, unknown>> = ReturnType<typeof useOptimizerRun<R, Runner>>

export type OptimizerViewContext<C, P extends { id: string }, S extends object, R, Runner extends WorkerRunner<never, unknown>, D> = {
  character: C,
  data: D,
  settings: S,
  update: (change: SettingsUpdate<S>) => void,
  // Opens another character
  openCharacter: (id: string) => void,
  search: Search<R, Runner>,
  statView: StatView,
  buildActions: ReturnType<typeof useBuildActions<P>>,
}

export type OptimizerView = {
  // The form rows, and anything between them and the results (a disclaimer)
  form: ReactNode,
  sidebar: Pick<OptimizerSidebarProps, 'pools' | 'combinations' | 'combinationsLabel' | 'hint' | 'canStart' | 'onStart' | 'results' | 'equip'> & {
    // The picked build for Pin build (label and its analysis rows), and its pieces for Save build
    pin?: { label: string, cells: PinnedCell[] },
    onSave?: () => void,
  },
  results: Omit<ComponentProps<typeof OptimizerResults>, 'game' | 'gearNoun' | 'pins'>,
  // After the results (RememberDamageScore)
  footer?: ReactNode,
}

export type OptimizerPageKind<
  C,
  P extends { id: string },
  S extends object,
  R,
  Runner extends WorkerRunner<never, unknown>,
  D extends OptimizerData<C, P>,
> = OptimizerKind<P> & {
  settingsKey: string,
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
  description: string,
  // The page before any gear: what importing brings in, and the sample data
  importText: string,
  loadSample: () => void,
  // One-time changes to older saves, run once when the page opens (shared/optimizerSettings.ts migrateOptimizerSettings)
  migrateSaves?: () => void,
  runner: Runner,
  useData: () => D,
  idOf: (character: C) => string,
  nameOf: (character: C) => string,
  // The character opened when none was before (the first one otherwise)
  fallback?: (data: D) => C | undefined,
  defaultSettings: (characterId: string, data: D) => S,
  equip: (character: C, pieces: P[], settings: S, data: D) => void,
  useView: (context: OptimizerViewContext<C, P, S, R, Runner, D>) => OptimizerView,
}

export function GameOptimizerPage<C, P extends { id: string }, S extends object, R, Runner extends WorkerRunner<never, unknown>, D extends OptimizerData<C, P>>(
  { kind, onImport }: { kind: OptimizerPageKind<C, P, S, R, Runner, D>, onImport: () => void },
) {
  useState(() => kind.migrateSaves?.())
  const data = kind.useData()
  const [characterId, openCharacter] = useActiveCharacter(kind.settingsKey)
  const character = data.characters.find((c) => kind.idOf(c) === characterId) ?? kind.fallback?.(data) ?? data.characters[0]
  // Kept while the page is open, across characters (pins are per character)
  const pins = usePinnedBuilds(character ? kind.idOf(character) : '')
  // Results columns: in-combat stats (team, kit and set buffs) or the stat screen, after HSR's stat view
  const [statView, setStatView] = useState<StatView>('combat')

  if (!character || data.gear.length === 0) {
    return <OptimizerImportFirst gearNoun={kind.gearNoun} text={kind.importText} onImport={onImport} onSample={kind.loadSample} />
  }
  return (
    <OptimizerBody
      key={kind.idOf(character)}
      kind={kind}
      data={data}
      character={character}
      openCharacter={openCharacter}
      pins={pins}
      statView={statView}
      setStatView={setStatView}
    />
  )
}

// The page for one character; remounted when another opens, so the search starts fresh
function OptimizerBody<C, P extends { id: string }, S extends object, R, Runner extends WorkerRunner<never, unknown>, D extends OptimizerData<C, P>>({
  kind,
  data,
  character,
  openCharacter,
  pins,
  statView,
  setStatView,
}: {
  kind: OptimizerPageKind<C, P, S, R, Runner, D>,
  data: D,
  character: C,
  openCharacter: (id: string) => void,
  pins: ReturnType<typeof usePinnedBuilds>,
  statView: StatView,
  setStatView: (view: StatView) => void,
}) {
  const id = kind.idOf(character)
  const [settings, update] = useCharacterSettings(kind.settingsKey, id, (characterId) => kind.defaultSettings(characterId, data))
  const search = useOptimizerRun<R, Runner>(kind.runner)
  const buildActions = useBuildActions(kind, {
    characterId: id,
    name: kind.nameOf(character),
    gear: data.gear,
    equip: (pieces) => kind.equip(character, pieces, settings, data),
  })

  const view = kind.useView({ character, data, settings, update, openCharacter, search, statView, buildActions })

  const { pin, onSave, ...sidebar } = view.sidebar
  return (
    <OptimizerPageShell
      description={kind.description}
      sidebar={
        <OptimizerSidebar
          {...sidebar}
          running={search.running}
          progress={search.progress}
          onCancel={search.cancel}
          statView={{ value: statView, onChange: setStatView }}
          onReset={() => {
            update(kind.defaultSettings(id, data))
            search.clear()
          }}
          pins={{ onPin: pin ? () => pins.pin(pin.label, pin.cells) : undefined, count: pins.pinned.length, onClear: pins.clear }}
          builds={{ onSave, onLoad: buildActions.loadBuilds, count: buildActions.savedList.length }}
        />
      }
    >
      {view.form}
      <OptimizerResults game={kind.game} gearNoun={kind.gearNoun} pins={pins} {...view.results} />
      {view.footer}
    </OptimizerPageShell>
  )
}

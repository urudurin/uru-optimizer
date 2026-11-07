import { SwitchGearModal } from 'lib/games/shared/ui/CharacterMenu'
import {
  SaveBuildModal,
  SavedBuildsModal,
} from 'lib/games/shared/ui/optimizer/SavedBuilds'
import { ScoringModal } from 'lib/games/shared/ui/ScoringModal'

// Every game modal, mounted once by GameLayout, after HSR's GlobalModals (lib/overlays/GlobalModals.tsx). Each opens
// through its overlay store (gameModalStores.ts).
export function GameModals() {
  return (
    <>
      <SaveBuildModal />
      <SavedBuildsModal />
      <ScoringModal />
      <SwitchGearModal />
    </>
  )
}

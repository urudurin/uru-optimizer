import {
  type EnkaImportConfig,
  EnkaImportPanel,
} from 'lib/games/shared/ui/EnkaImportPanel'
import {
  enkaProfileApiUrl,
  enkaProfilePageUrl,
  fetchEnkaZzzProfile,
  isValidZzzUid,
} from 'lib/games/zzz/importer/enkaClient'
import { importEnkaZzzProfile } from 'lib/games/zzz/importer/enkaImport'

const CONFIG: EnkaImportConfig = {
  uidStorageKey: 'zzz-enka-uid',
  uidLabel: 'ZZZ UID',
  uidPlaceholder: 'e.g. 1000074590',
  uidHint: '8 to 11 digits',
  description: 'Loads the agents in your in-game showcase and the discs they wear. Your other discs stay as they are.',
  showcaseNoun: 'agents',
  isValidUid: isValidZzzUid,
  apiUrl: enkaProfileApiUrl,
  pageUrl: enkaProfilePageUrl,
  fetchProfile: (uid) => fetchEnkaZzzProfile(uid),
  importProfile: importEnkaZzzProfile,
}

export function ZzzEnkaImportPanel() {
  return <EnkaImportPanel config={CONFIG} />
}

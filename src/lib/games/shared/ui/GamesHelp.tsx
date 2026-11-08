import {
  Drawer,
  List,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core'

// The games' Getting started drawer and Changelog, after HSR's (lib/overlays/drawers/GettingStartedDrawer.tsx and the
// changelog modal). Opened from the sidebar's last group, next to Settings. Our own text.

type GuideStep = { title: string, text: string }

const IMPORT_STEP: Record<string, GuideStep> = {
  genshin: {
    title: 'Import your account',
    text:
      'Import / Save: a GOOD file from an artifact scanner (the whole inventory), or your UID through Enka.Network (the showcased characters). Pick what to import first: everything, artifacts only, or only characters you already have.',
  },
  zzz: {
    title: 'Import your account',
    text:
      'Import / Save: a builds export from your ZZZ optimizer tool, or your UID through Enka.Network (the showcased agents). Pick what to import first: everything, discs only, or only agents you already have.',
  },
  wuwa: {
    title: 'Import your account',
    text: 'Import / Save: the user-data file exported from WuwaEchoScorer. Resonators can also be added and edited by hand on the Resonators page.',
  },
}

const STEPS: GuideStep[] = [
  {
    title: 'Check your characters',
    text:
      'The characters page shows every character with their stats, gear and DPS score. Default scores the kit (or the character\'s recommended team when it has one); Custom is your own team and rotation, set in the scoring setup (the gear button), apart from the optimizer.',
  },
  {
    title: 'Optimize',
    text:
      'Optimizer: pick a character, use Recommended build to fill the filters, set the team and rotation in the Damage row, then Start. Pick a result to see its stats, upgrades, damage split and buffs, then Equip it or save it as a build.',
  },
  {
    title: 'Compare',
    text:
      'Benchmarks shows the builds a DPS score compares with. Teams keeps teams and scores each member with the others. Showcase (Genshin, ZZZ) looks up any UID without saving it.',
  },
  {
    title: 'Your own presets',
    text:
      'The Recommended build card can load your own presets file (weights, main stats, sets, team and rotation per character). It stays in this browser and fills the DPS score\'s Default team.',
  },
  {
    title: 'Back up',
    text: 'Everything is kept in this browser only. Save a backup on Import / Save now and then, and to move to another browser.',
  },
]

export function GettingStartedDrawer({ game, opened, onClose }: { game: string, opened: boolean, onClose: () => void }) {
  const steps = [IMPORT_STEP[game] ?? IMPORT_STEP.genshin, ...STEPS]
  return (
    <Drawer opened={opened} onClose={onClose} position='right' size={520} title='Getting started'>
      <Stack gap='md'>
        {steps.map((step, index) => (
          <div key={step.title}>
            <Text size='sm' fw={600}>{`${index + 1}. ${step.title}`}</Text>
            <Text size='sm' c='dimmed'>{step.text}</Text>
          </div>
        ))}
      </Stack>
    </Drawer>
  )
}

// Newest first
const CHANGELOG: { date: string, items: string[] }[] = [
  {
    date: 'Nov 7 2026',
    items: [
      'Every character has one metadata record (substat weights, ideal main stats, default rank and rotation), like HSR.',
      'The DPS score\'s Custom setup is kept apart from the optimizer, with Sync teammates, Copy from optimizer and Reset to Default. Characters start on Default.',
      'Recommended build card in every optimizer, from the character\'s metadata or your own presets file; new characters start with its main stats.',
      'Presets files v2: substat weights, main stats, sets, rank, team and rotation per character, filling the DPS score\'s Default team.',
      'The DPS score\'s benchmark picks its sets and main stats from the character\'s recommended ones when there are some. New Benchmarks page.',
      'Buffs analysis under the picked build, Teams page, Showcase page (Genshin, ZZZ), and a what-to-import choice on Import / Save.',
      'Earlier the same day: teammate set upgrades, the characters pages\' DPS score with Default / Custom, Mizuki\'s full kit.',
    ],
  },
]

export function ChangelogModal({ opened, onClose }: { opened: boolean, onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} size='lg' title='Changelog'>
      <Stack gap='md'>
        {CHANGELOG.map((entry) => (
          <div key={entry.date}>
            <Title order={5}>{entry.date}</Title>
            <List size='sm' spacing={4} mt={4}>
              {entry.items.map((item) => <List.Item key={item}>{item}</List.Item>)}
            </List>
          </div>
        ))}
      </Stack>
    </Modal>
  )
}

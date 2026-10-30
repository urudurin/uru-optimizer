import {
  Button,
  Card,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  type GameId,
  GAMES,
} from 'lib/games/games'
import { useGameStore } from 'lib/games/gameStore'

// The first page a new visitor sees: pick a game. Shown until a game has been picked once (gameStore.chosen); after
// that the site opens on the last game, and the header's switcher changes it

const ABOUT: Record<GameId, string> = {
  hsr: 'fribbels\' Star Rail optimizer: relic optimizer and scorer, character showcase, benchmarks and warp planner.',
  zzz: 'Disc optimizer ranked by rotation damage, with teams, Attribute Anomalies and W-Engines. Import from Enka or a builds export.',
  wuwa: 'Echo optimizer ranked by rotation damage, with Echo Skills and teams. Import a WuwaEchoScorer save or add Resonators by hand.',
  genshin: 'Artifact optimizer ranked by rotation damage, with reactions and teams. Import a GOOD scanner file or from Enka.',
}

export function GamePicker() {
  const setActiveGame = useGameStore((s) => s.setActiveGame)

  return (
    <Stack align='center' gap='xl' p='xl' style={{ flex: 1 }}>
      <Stack align='center' gap={4} mt='xl'>
        <Title order={2}>Uru's Gacha Optimizer</Title>
        <Text c='dimmed' ta='center'>
          Find the best gear for your characters. Pick a game to start; you can switch any time from the header.
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing='lg' maw={860} w='100%'>
        {GAMES.map((game) => (
          <Card key={game.id} withBorder radius='md' padding='lg'>
            <Stack gap='sm' h='100%' justify='space-between'>
              <div>
                <Text fw={600} size='lg'>{game.label}</Text>
                <Text size='sm' c='dimmed' mt={4}>{ABOUT[game.id]}</Text>
              </div>
              <Button variant='light' onClick={() => setActiveGame(game.id)}>Open {game.shortLabel}</Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <Text size='xs' c='dimmed' ta='center' maw={600}>
        Personal, non-commercial use. Your data stays in this browser. Not affiliated with any game's publisher.
      </Text>
    </Stack>
  )
}

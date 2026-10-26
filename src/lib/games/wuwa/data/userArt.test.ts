import { parseArtPath } from 'lib/games/wuwa/data/userArt'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('parseArtPath', () => {
  it('reads the Resonator id and whether the file is an icon', () => {
    expect(parseArtPath('../user-art/hsin.png')).toEqual(['hsin', false])
    expect(parseArtPath('../user-art/Rover-Havoc-icon.WEBP')).toEqual(['rover-havoc', true])
    expect(parseArtPath('../user-art/README.md')).toBeUndefined()
  })
})

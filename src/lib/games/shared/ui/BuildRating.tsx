import { rememberDamageScore } from 'lib/games/shared/damageScore'
import type { GearScore } from 'lib/games/shared/gearScore'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { useEffect } from 'react'

// The build's rating under a character's stat block, after the "135.2% · WTF / DPS Benchmark" summary on HSR's
// showcase and on the same scale (100% is the benchmark, SS). Either HSR's DPS score from the rotation's damage
// (shared/damageScore.ts, label 'DPS score') or, without one, the stretched average gear score (shared/gearScore.ts
// scoreBuild). label names what it's from, e.g. 'Disc score'
export const DPS_SCORE_LABEL = 'DPS score'

const GEAR_TITLE = 'The equipped pieces against a benchmark build, on the HSR scale: 100% is the benchmark (SS), 200% perfect. Empty slots count as 0'
const DPS_TITLE = 'Rotation damage against simulated builds with the same main stats and sets, after HSR\'s DPS score: 0% has only a few '
  + 'spread-out substat rolls, 100% (SS) the benchmark number of average rolls placed where they add the most damage, 200% every roll '
  + 'a max roll'

export function BuildRating({ score, label }: { score?: GearScore, label: string }) {
  if (!score) return null
  return (
    <div className={gear.buildRating} title={label === DPS_SCORE_LABEL ? DPS_TITLE : GEAR_TITLE}>
      <div className={gear.buildRatingValue}>{`${score.percent.toFixed(1)}% · ${score.rating}`}</div>
      <div className={gear.buildRatingLabel}>{label}</div>
    </div>
  )
}

// Keeps the current build's DPS score for the characters page (shared/damageScore.ts rememberDamageScore); renders
// nothing, and leaves the kept score alone while there is none (not ranking by damage)
export function RememberDamageScore({ game, characterId, pieceIds, score }: {
  game: string,
  characterId: string,
  pieceIds: string[],
  score?: GearScore,
}) {
  const percent = score?.percent
  const rating = score?.rating
  const gearKey = pieceIds.join(',')
  useEffect(() => {
    if (percent !== undefined) rememberDamageScore(game, characterId, gearKey ? gearKey.split(',') : [], { percent, rating: rating ?? '' })
  }, [game, characterId, gearKey, percent, rating])
  return null
}

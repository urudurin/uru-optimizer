import type { GearScore } from 'lib/games/shared/gearScore'
import gear from 'lib/games/shared/ui/GearCard.module.css'

// The build's rating under a character's stat block, after the "135.2% · WTF / DPS Benchmark" summary on HSR's
// showcase. Ours is the average gear score (shared/gearScore.ts scoreBuild): there's no damage calculation for a DPS
// benchmark yet. label names what it's from, e.g. 'Disc score'
export function BuildRating({ score, label }: { score?: GearScore, label: string }) {
  if (!score) return null
  return (
    <div className={gear.buildRating} title='The average score of the equipped pieces, an empty slot counting as 0'>
      <div className={gear.buildRatingValue}>{`${score.percent.toFixed(1)}% · ${score.rating}`}</div>
      <div className={gear.buildRatingLabel}>{label}</div>
    </div>
  )
}

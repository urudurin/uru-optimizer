import { IconSparkles } from '@tabler/icons-react'
import type { GearScore } from 'lib/games/shared/gearScore'
import gear from 'lib/games/shared/ui/GearCard.module.css'

// The Score line at the bottom of a gear card, after HSR's relic cards: "Score 49.3 (A+)". Nothing when there's no
// score (no weights for the character, or a rarity that isn't scored)
export function GearScoreLine({ score }: { score?: GearScore }) {
  if (!score) return null
  return (
    <div className={gear.score} title='How close the substats are to the best piece for this character'>
      <IconSparkles size={14} />
      <span>Score</span>
      <span className={gear.scoreValue}>{`${score.percent.toFixed(1)} (${score.rating})`}</span>
    </div>
  )
}

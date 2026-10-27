import {
  Stack,
  Text,
} from '@mantine/core'
import type { GearScore } from 'lib/games/shared/gearScore'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import { Notices } from 'lib/games/shared/ui/GameLayout'
import classes from 'lib/games/shared/ui/optimizer/OptimizerResults.module.css'
import {
  ShowcaseCard,
  StatList,
  type StatListRow,
} from 'lib/games/shared/ui/Showcase'
import type { ReactNode } from 'react'

// The picked optimizer result as the character's showcase card, after HSR's OptimizerBuildPreview: the same card as the
// character pages (shared/ui/Showcase.tsx), with the build's stats, its rating and its gear

export function BuildPreview({ title, description, name, accent, portrait, weapon, heading, rows, rating, ratingLabel, notes, footer, gear }: {
  title: string,
  description?: string,
  name: string,
  accent?: string,
  portrait?: string,
  weapon?: { image?: string, name: string, meta: string },
  // Badges and levels under the name
  heading?: ReactNode,
  rows: StatListRow[],
  rating?: GearScore,
  ratingLabel: string,
  notes?: string[],
  footer?: ReactNode,
  gear: ReactNode,
}) {
  return (
    <Stack gap='xs'>
      <div className={classes.previewHeading}>
        <Text fw={600}>{title}</Text>
        {description && <Text size='xs' c='dimmed'>{description}</Text>}
      </div>
      <ShowcaseCard
        name={name}
        accent={accent}
        portrait={portrait}
        weapon={weapon}
        info={
          <>
            <div>
              <Text size='xl' fw={700}>{name}</Text>
              {heading}
            </div>
            <StatList rows={rows} />
            <BuildRating score={rating} label={ratingLabel} />
            {notes && notes.length > 0 && <Notices messages={notes} />}
            {footer}
          </>
        }
        gear={gear}
      />
    </Stack>
  )
}

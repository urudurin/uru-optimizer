# Your WuWa character art

Images you put here show on the Resonators page. The folder is gitignored: nothing in it
except this file is ever committed, and the site never downloads art from anywhere itself.
Save the images by hand, from wherever you're comfortable getting them; the art belongs to
Kuro Games, so keep it to personal use.

Name each file after the Resonator's id (the lowercase name from the game data, words joined
with hyphens), as `.png`, `.jpg` or `.webp`:

- `hsin.png`: full character art, for the showcase card and the roster banner
- `hsin-icon.png` (optional): a small square or round icon; without one the banner uses the full art

Ids are the keys in `../data/generated/datamine.json` under `characters`, e.g. `aalto`,
`camellya`, `shorekeeper`, `rover-havoc`. New files show up after a page reload; images are
only loaded when a banner or card that needs them is on screen.

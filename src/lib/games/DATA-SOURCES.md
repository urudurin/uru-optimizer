# Data sources for the ZZZ and WuWa modules

**Personal, non-commercial use only.** The game data and recommendations used by `src/lib/games/` come from the games
themselves, community datamines, community wikis and the user's own screenshots and exports. None of it may be used to
make money: no paid features, ads, subscriptions or resale built on this data. Game names, data and art belong to their
publishers (HoYoverse for Zenless Zone Zero, Kuro Games for Wuthering Waves). This project isn't affiliated with them or
with any of the sites below.

Every value in the code carries a confidence tag: `confirmed` (matched the in-game stat screen), `sourced` (from one of
the sources below) or `unverified`.

## Zenless Zone Zero (`zzz/`)

| Data                        | Where it came from                                                                                                                                                              | Where it lives         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Agent base stats            | [Gachabase](https://zzz.gachabase.net), with HP, ATK and DEF fitted to the user's in-game stat screen screenshots                                                               | `zzz/data/agents.ts`   |
| W-Engine values             | User's builds export, [Icy Veins](https://www.icy-veins.com/zenless-zone-zero/) for the R1 split of Severed Innocence                                                           | `zzz/data/wEngines.ts` |
| Disc set bonuses            | [Icy Veins](https://www.icy-veins.com/zenless-zone-zero/drive-discs), [GameWith](https://gamewith.net/zenless-zone-zero/), checked against screenshots where marked `confirmed` | `zzz/data/sets.ts`     |
| Substat roll values         | Observed in the user's builds export                                                                                                                                            | `zzz/discStats.ts`     |
| Built-in build presets      | The user's own builds plus general game knowledge, written by hand                                                                                                              | `zzz/data/presets.ts`  |
| The user's discs and builds | The user's own export file, imported in the browser                                                                                                                             | browser storage only   |

## Wuthering Waves (`wuwa/`)

| Data                                                             | Where it came from                                                                                                                                                                                                     | Where it lives                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Character base HP/ATK/DEF by level, weapons, echoes, sonata sets | Community datamine [Arikatsu/WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data), branch 3.7, extracted by the user's WuwaEchoScorer pipeline. Details in the file's `provenance` block              | `wuwa/data/generated/datamine.json`                            |
| Character element and minor fortes, all 60 characters            | Same datamine, read directly from `BinData/role/roleinfo.json` and `BinData/skillTree/skilltree.json` by `src/scripts/wuwa/extractCharacters.mjs`. Hsin's values also match her in-game stat screen                    | `wuwa/data/generated/datamine.json` (`characters`)             |
| Always-on weapon passive bonuses (59 of 124 weapons)             | Same datamine, from the first sentence of each weapon passive description and its R1-R5 values in `BinData/weapon/weaponconf.json`, only when that sentence has no trigger. Unspoken Rue matches Suoming's stat screen | `wuwa/data/generated/datamine.json` (`weapons.*.passiveStats`) |
| The user's echoes and characters                                 | The user's own WuwaEchoScorer save file (user-data.json), imported in the browser                                                                                                                                      | browser storage only (`wuwa-state`)                            |
| Echo main stat and substat values, echo rules                    | The user's WuwaEchoScorer project (datamine level scaling)                                                                                                                                                             | `wuwa/echoStats.ts`, `wuwa/echoRules.ts`                       |

Left out on purpose: everything the WuwaEchoScorer project took from Prydwen (character build profiles, substat
weights, stat targets, teams, weapon rankings, buff values, minor fortes, images).

## Imported presets (any game)

Users can import a presets file of their own, for example notes taken from a guide site such as Prydwen or a community
group such as SipSip Squad. That file stays in the user's browser (`<game>-imported-presets` in local storage). It is
never committed to this repo, and nothing in this project fetches or scrapes those sites. Whoever imports a file is
responsible for following its source's terms, which for Prydwen means personal, non-commercial use and no automated
scraping.

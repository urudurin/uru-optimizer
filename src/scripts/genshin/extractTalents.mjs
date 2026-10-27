// Extracts every Genshin character's talent damage multipliers from genshin-optimizer's generated stats file and its
// English talent labels, and writes src/lib/games/genshin/data/generated/talents.json for the rotation damage
// calculation (genshin/damage/).
//
// Source: https://github.com/frzyc/genshin-optimizer (MIT license, Copyright (c) 2020 frzyc):
//   libs/gi/stats/src/allStat_gen.json (char.skillParam: the multipliers, by talent level 1-15)
//   libs/gi/dm-localization/assets/locales/en/char_<key>_gen.json (skillParams: the labels, and skillParamsEncoding:
//   which numbers each label shows and what they scale with, e.g. "{{0, percent}}% Max HP")
// Download them yourself, then run:
//   node src/scripts/genshin/extractTalents.mjs <allStat_gen.json> <folder with the char_*_gen.json files>
//
// A hit keeps its label, talent, category and scaling terms ([stat, percent at levels 1-15]). Labels that aren't damage
// (CD, Duration, Stamina, DMG Bonus...) are dropped. In an encoding, "a%+b%" with the same scaling is two hits,
// "a% ATK+b% Elemental Mastery" one hit with two terms, "a%/b%" two alternatives ("Low/High Plunge DMG") and "a%*4" one
// hit landing 4 times. Personal, non-commercial use, see src/lib/games/DATA-SOURCES.md.

import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const [input, labelDir] = process.argv.slice(2)
if (!input || !labelDir) {
  console.error('Usage: node src/scripts/genshin/extractTalents.mjs <allStat_gen.json> <folder with char_*_gen.json>')
  process.exit(1)
}
const all = JSON.parse(readFileSync(input, 'utf8'))

const round = (value) => Math.round(value * 1000000) / 10000

const SCALING = { 'Max HP': 'hp', 'ATK': 'atk', 'DEF': 'def', 'Elemental Mastery': 'elementalMastery' }
const NOT_DAMAGE = /Bonus|Increase|Interval|Reduction|Conversion|Ratio|Absorption|Stamina|Duration|CD|Cost|Limit|Maximum|Per |Threshold|Decrease/

// "{{0, percent(fixed: 1)}}% Max HP+{{1, percent}}%" -> [{ index, stat, separator }]
function parseEncoding(encoding) {
  // "(a% ATK+b% Elemental Mastery)×3": the whole hit lands 3 times
  const grouped = /^\((.*)\)\s*[*×](\d+)$/.exec(encoding)
  if (grouped) return parseEncoding(grouped[1])?.map((term) => ({ ...term, times: term.times * Number(grouped[2]) }))
  const terms = []
  const pattern = /\{\{(\d+), percent[^}]*\}\}%(?: (Max HP|ATK|DEF|Elemental Mastery))?(?: each| per \w+|\/Strike)?(?: ?[*×](\d+))?([+/]|$)?/g
  let match
  let end = 0
  while ((match = pattern.exec(encoding))) {
    // Anything between two terms other than a separator ("1 Character ", "Per Stack") means it isn't a plain damage line
    if (encoding.slice(end, match.index).trim() !== '') return undefined
    terms.push({ index: Number(match[1]), stat: SCALING[match[2] ?? 'ATK'], times: match[3] ? Number(match[3]) : 1, separator: match[4] ?? '' })
    end = pattern.lastIndex
  }
  if (terms.length === 0 || encoding.slice(end).trim() !== '') return undefined
  return terms
}

// The game's physical hits for weapons other than catalysts: plain normal, charged and plunging attacks
const PHYSICAL =
  /^(\d+-Hit DMG|Charged Attack|Charged Attack DMG|Charged Attack Cyclic DMG|Charged Attack Final DMG|Plunge DMG|Low Plunge DMG|High Plunge DMG|Low\/High Plunge DMG|Aimed Shot|Aimed Shot DMG)$/

function categoryOf(talent, label) {
  if (talent !== 'auto') return talent
  if (/Plunge/.test(label)) return 'plunging'
  if (/Charged|Aimed/.test(label)) return 'charged'
  return 'normal'
}

function talentHits(talent, params, labels, encodings) {
  const hits = []
  for (const key of Object.keys(labels)) {
    const label = labels[key]
    const encoding = encodings[key]
    if (!label || !encoding || !/DMG|Shot|Charged Attack|Judgment/.test(label) || NOT_DAMAGE.test(label)) continue
    const terms = parseEncoding(encoding)
    if (!terms || terms.some((term) => !params[term.index])) {
      if (process.env.DEBUG) console.log('dropped', talent, label, encoding)
      continue
    }

    // Split into hits: "/" always starts one, "+" starts one when the next term scales with the same stat
    const groups = [[terms[0]]]
    for (let i = 1; i < terms.length; i++) {
      const previous = terms[i - 1]
      const group = groups[groups.length - 1]
      if (previous.separator === '+' && !group.some((term) => term.stat === terms[i].stat)) group.push(terms[i])
      else groups.push([terms[i]])
    }
    const alternatives = terms.some((term) => term.separator === '/')
    const names = alternatives && label.split('/').length === groups.length
      ? altNames(label, groups.length)
      : groups.map((_, i) => (groups.length > 1 ? `${label} (${i + 1})` : label))
    groups.forEach((group, i) => {
      const times = group[0].times
      const hit = {
        label: times > 1 ? `${names[i]} ×${times}` : names[i],
        talent,
        category: categoryOf(talent, names[i]),
        terms: group.map((term) => [term.stat, params[term.index].map((value) => round(value * term.times))]),
      }
      if (talent === 'auto' && (PHYSICAL.test(label) || PHYSICAL.test(names[i]))) hit.physical = true
      hits.push(hit)
    })
  }
  return hits
}

// "Low/High Plunge DMG" -> ["Low Plunge DMG", "High Plunge DMG"]
function altNames(label, count) {
  const parts = label.split('/')
  const [first, ...rest] = parts
  const tail = rest[rest.length - 1].split(' ').slice(1).join(' ')
  const names = [`${first} ${tail}`.trim(), ...rest.slice(0, -1).map((part) => `${part} ${tail}`.trim()), rest[rest.length - 1]]
  return names.length === count ? names : parts
}

const characters = {}
const skipped = []
for (const [key, params] of Object.entries(all.char.skillParam)) {
  // The Traveler's multipliers are the same for both; ours are keyed TravelerAnemo, TravelerGeo...
  if (/^Traveler.*M$/.test(key)) continue
  const id = key.replace(/^(Traveler\w+)F$/, '$1')
  const labelFile = join(labelDir, `char_${key}_gen.json`)
  if (!existsSync(labelFile)) {
    skipped.push(key)
    continue
  }
  const loc = JSON.parse(readFileSync(labelFile, 'utf8'))
  const hits = ['auto', 'skill', 'burst'].flatMap((talent) =>
    talentHits(talent, params[talent] ?? [], loc[talent]?.skillParams ?? {}, loc[talent]?.skillParamsEncoding ?? {})
  )
  // Which talent C3 raises by 3 levels (C5 raises the other)
  const c3 = Object.values(loc.constellation3?.description ?? {}).join(' ')
  const c3Talent = loc.burst?.name && c3.includes(loc.burst.name) ? 'burst' : 'skill'
  const data = all.char.data[key]
  characters[id] = { c3: c3Talent, catalyst: data?.weaponType === 'catalyst' || undefined, hits }
}

const output = {
  provenance: {
    source:
      'https://github.com/frzyc/genshin-optimizer: libs/gi/stats/src/allStat_gen.json (char.skillParam) and libs/gi/dm-localization/assets/locales/en/char_*_gen.json',
    license: 'MIT, Copyright (c) 2020 frzyc',
    extractedBy: 'src/scripts/genshin/extractTalents.mjs',
    extractedOn: new Date().toISOString().slice(0, 10),
    note: 'Talent hits with scaling terms [stat, percent at talent levels 1-15]. Personal, non-commercial use.',
  },
  characters,
}
writeFileSync('src/lib/games/genshin/data/generated/talents.json', `${JSON.stringify(output)}\n`)
console.log(`Wrote ${Object.keys(characters).length} characters${skipped.length ? `, no labels for ${skipped.join(', ')}` : ''}`)

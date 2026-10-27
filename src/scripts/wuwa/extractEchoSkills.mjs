// Extracts every echo's Echo Skill damage from the community datamine Arikatsu/WutheringWaves_Data and writes
// src/lib/games/wuwa/data/generated/echoSkills.json for the rotation damage calculation (wuwa/damage/). Run by hand when
// the datamine updates:
//
//   node src/scripts/wuwa/extractEchoSkills.mjs <datamine folder> <branch>
//
// The datamine folder must hold these files, downloaded from
// https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/<branch>/<path>:
//   BinData/phantom/phantomitem.json, BinData/phantom/phantomskill.json, BinData/damage/damage.json,
//   Textmaps/en/multi_text/MultiText.json
// Only data files are read, nothing is fetched or run. Personal, non-commercial use, see src/lib/games/DATA-SOURCES.md.
//
// An echo's skill description has numbered values ({0}, {1}...) and its skill lists damage entries (SettleIds). A value is
// a damage hit when it equals one of those entries' multiplier at the highest rank (RateLv[4], in hundredths of a
// percent); the entry also says what the hit scales on and its element. Values are kept at the highest rank (+25).

import {
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const [datamineDir, branch] = process.argv.slice(2)
if (!datamineDir || !branch) {
  console.error('Usage: node src/scripts/wuwa/extractEchoSkills.mjs <datamine folder> <branch>')
  process.exit(1)
}
const read = (path) => JSON.parse(readFileSync(join(datamineDir, path), 'utf8'))

const OUTPUT = 'src/lib/games/wuwa/data/generated/echoSkills.json'
const DATAMINE = 'src/lib/games/wuwa/data/generated/datamine.json'
const MAX_RANK = 4
const ELEMENTS = { 1: 'glacio', 2: 'fusion', 3: 'electro', 4: 'aero', 5: 'spectro', 6: 'havoc' }
const SCALING = { 2: 'hp', 7: 'atk', 10: 'def' }

function normalise(name) {
  return name.toLowerCase().replace(/[‘’']/g, '').replace(/[:().,\-_/]/g, ' ').replace(/\s+/g, ' ').trim()
}

const text = new Map(read('Textmaps/en/multi_text/MultiText.json').map((row) => [row.Id, row.Content]))
const skills = new Map(read('BinData/phantom/phantomskill.json').map((skill) => [skill.PhantomSkillId, skill]))
const damage = new Map(read('BinData/damage/damage.json').map((entry) => [entry.Id, entry]))
const data = JSON.parse(readFileSync(DATAMINE, 'utf8'))
const idByName = new Map(Object.values(data.echoes).map((echo) => [normalise(echo.name), echo.id]))

const echoes = {}
const unmatched = new Set()
for (const item of read('BinData/phantom/phantomitem.json')) {
  const name = text.get(item.MonsterName)
  const id = name ? idByName.get(normalise(name)) : undefined
  if (!name || !id) {
    if (name) unmatched.add(name)
    continue
  }
  if (echoes[id]) continue
  const skill = skills.get(item.SkillId)
  if (!skill) continue
  const values = skill.LevelDescStrArray?.[MAX_RANK]?.ArrayString ?? skill.LevelDescStrArray?.at(-1)?.ArrayString ?? []
  const entries = (skill.SettleIds ?? []).map((settleId) => damage.get(settleId)).filter((entry) => entry?.RateLv?.length)
  const hits = []
  values.forEach((value, index) => {
    const match = /^([\d.]+)%$/.exec(String(value))
    if (!match) return
    const rate = Math.round(Number(match[1]) * 100)
    const entry = entries.find((e) => (e.RateLv[MAX_RANK] ?? e.RateLv.at(-1)) === rate)
    if (!entry) return
    hits.push({
      label: `Hit {${index}}`,
      index,
      multiplier: Number(match[1]),
      stat: SCALING[entry.RelatedProperty] ?? 'atk',
      element: ELEMENTS[entry.Element] ?? null,
    })
  })
  if (hits.length === 0) continue
  echoes[id] = { name, description: text.get(skill.DescriptionEx) ?? '', values, hits }
}

const output = {
  provenance: {
    source: `https://github.com/Arikatsu/WutheringWaves_Data/tree/${branch}`,
    files: ['BinData/phantom/phantomitem.json', 'BinData/phantom/phantomskill.json', 'BinData/damage/damage.json', 'Textmaps/en/multi_text/MultiText.json'],
    extractedBy: 'src/scripts/wuwa/extractEchoSkills.mjs',
    extractedOn: new Date().toISOString().slice(0, 10),
    note: 'Echo Skill damage hits at the highest rank: multiplier (percent), scaling stat and element. Personal, non-commercial use.',
  },
  echoes: Object.fromEntries(Object.keys(echoes).sort().map((id) => [id, echoes[id]])),
}
writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`)
console.log(`Wrote ${Object.keys(echoes).length} echoes with Echo Skill damage`)
if (process.env.DEBUG) console.log('No id for:', [...unmatched].join(', '))

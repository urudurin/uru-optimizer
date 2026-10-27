// Extracts every Resonator's skill damage multipliers from the community datamine Arikatsu/WutheringWaves_Data and
// writes src/lib/games/wuwa/data/generated/skills.json for the rotation damage calculation (wuwa/damage/). Run by hand
// when the datamine updates:
//
//   node src/scripts/wuwa/extractSkills.mjs <datamine folder> <branch>
//
// The datamine folder must hold these files, downloaded from
// https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/<branch>/<path>:
//   BinData/role/roleinfo.json, BinData/skill/skill.json, BinData/skill/skilldescription.json,
//   BinData/skill/skilltype.json, BinData/damage/damage.json, Textmaps/en/multi_text/MultiText.json
// Only data files are read, nothing is fetched or run. Personal, non-commercial use, see src/lib/games/DATA-SOURCES.md.
//
// Each damage line of a skill's description ("Basic Attack Stage 1 DMG: 27.84%+41.76%") becomes one hit with its
// multiplier at skill levels 1-10. Each number in it is matched to the damage entry with the same multiplier at level 10
// in damage.json, which says what the part counts as (Basic Attack, Heavy Attack, Resonance Skill, Liberation, Intro,
// Outro: the DMG Bonus it gets) and what it scales on (ATK, HP or DEF). A number with no match takes its skill's most
// common type and stat; Normal Attack lines go by their name (Heavy Attack or Basic Attack).

import {
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const [datamineDir, branch] = process.argv.slice(2)
if (!datamineDir || !branch) {
  console.error('Usage: node src/scripts/wuwa/extractSkills.mjs <datamine folder> <branch>')
  process.exit(1)
}
const read = (path) => JSON.parse(readFileSync(join(datamineDir, path), 'utf8'))

const OUTPUT = 'src/lib/games/wuwa/data/generated/skills.json'
const DATAMINE = 'src/lib/games/wuwa/data/generated/datamine.json'
const LEVELS = 10

const ELEMENT_IDS = { 1: 'glacio', 2: 'fusion', 3: 'electro', 4: 'aero', 5: 'spectro', 6: 'havoc' }
// damage.json Type -> what the hit counts as
const DAMAGE_TYPES = { 0: 'basic', 1: 'heavy', 2: 'liberation', 3: 'intro', 4: 'skill', 7: 'outro' }
// damage.json RelatedProperty -> scaling stat (7 ATK, 2 HP, 10 DEF; anything else counts as ATK)
const SCALING = { 2: 'hp', 7: 'atk', 10: 'def' }
// skilltype.json names -> sections of the rotation editor
const SECTIONS = {
  'Normal Attack': 'normal',
  'Resonance Skill': 'skill',
  'Resonance Liberation': 'liberation',
  'Intro Skill': 'intro',
  'Forte Circuit': 'forte',
  'Outro Skill': 'outro',
}
const NOT_DAMAGE = /Cost|Cooldown|STA|Concerto|Energy|Regen|Reduction|Bonus|Increase|Duration|Healing|Shield|Recovery|Restore/

function normalise(name) {
  return name.toLowerCase().replace(/[‘’']/g, '').replace(/[:().,\-_/]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '')
}

const text = new Map(read('Textmaps/en/multi_text/MultiText.json').map((row) => [row.Id, row.Content]))
const skillTypes = new Map(read('BinData/skill/skilltype.json').map((type) => [type.Id, text.get(type.TypeName)]))
const damage = new Map(read('BinData/damage/damage.json').map((entry) => [entry.Id, entry]))
const skills = read('BinData/skill/skill.json')
const descriptions = read('BinData/skill/skilldescription.json')
const data = JSON.parse(readFileSync(DATAMINE, 'utf8'))
const idByName = new Map(Object.keys(data.bases).map((id) => [normalise(id), id]))

// "15.15%*2+68.14%" -> [{ value: 15.15, times: 2 }, { value: 68.14, times: 1 }], undefined when it isn't all percents
function parseTerms(value) {
  const parts = String(value).split('+')
  const terms = parts.map((part) => /^([\d.]+)%(?:\*(\d+))?$/.exec(part.trim()))
  if (terms.some((match) => !match)) return undefined
  return terms.map((match) => ({ value: Number(match[1]), times: match[2] ? Number(match[2]) : 1 }))
}

function mostCommon(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

const round = (value) => Math.round(value * 100) / 100
const characters = {}
const unmatched = []

for (const role of read('BinData/role/roleinfo.json')) {
  if (role.IsTrial || role.RoleType !== 1) continue
  const name = text.get(role.Name)
  if (!name) continue
  const element = ELEMENT_IDS[role.ElementId]
  const id = idByName.get(normalise(name)) ?? (element ? idByName.get(normalise(`${name} ${element}`)) : undefined)
  if (!id || characters[id]) continue

  const roleSkills = skills.filter((skill) => skill.SkillGroupId === role.SkillId)
  // Every damage entry of the Resonator by its level-10 multiplier (in hundredths of a percent)
  const byRate = new Map()
  for (const skill of roleSkills) {
    for (const damageId of skill.DamageList) {
      const entry = damage.get(damageId)
      const rate = entry?.RateLv?.[LEVELS - 1] ?? entry?.RateLv?.[entry.RateLv.length - 1]
      if (!rate) continue
      const list = byRate.get(rate) ?? []
      list.push({ skillId: skill.Id, entry })
      byRate.set(rate, list)
    }
  }

  const hits = []
  for (const skill of roleSkills) {
    const section = SECTIONS[skillTypes.get(skill.SkillType)]
    if (!section) continue
    const own = skill.DamageList.map((damageId) => damage.get(damageId)).filter((entry) => entry?.RateLv?.some(Boolean))
    const sectionType = DAMAGE_TYPES[mostCommon(own.map((entry) => entry.Type))] ?? 'none'
    const sectionStat = SCALING[mostCommon(own.map((entry) => entry.RelatedProperty))] ?? 'atk'

    const lines = descriptions.filter((d) => d.SkillLevelGroupId === skill.SkillLevelGroupId).sort((a, b) => a.Order - b.Order)
    for (const line of lines) {
      const label = text.get(line.AttributeName)
      if (!label || !/DMG|Damage|Attack/.test(label) || NOT_DAMAGE.test(label)) continue
      const strings = line.SkillDetailNum?.[0]?.ArrayString ?? []
      const parsed = Array.from({ length: LEVELS }, (_, level) => parseTerms(strings[Math.min(level, strings.length - 1)]))
      if (parsed.some((terms) => !terms) || parsed.some((terms) => terms.length !== parsed[0].length)) {
        if (process.env.DEBUG) console.log('skipped', name, label, strings[0], strings[LEVELS - 1])
        continue
      }

      // What each part of the line counts as, from its level-10 number
      const kinds = parsed[LEVELS - 1].map((term) => {
        const matches = byRate.get(Math.round(term.value * 100)) ?? []
        const match = matches.find((m) => m.skillId === skill.Id) ?? matches[0]
        if (!match) unmatched.push(`${name}: ${label}`)
        const byName = section === 'normal' ? (label.startsWith('Heavy Attack') ? 'heavy' : 'basic') : sectionType
        return {
          type: match ? DAMAGE_TYPES[match.entry.Type] ?? 'none' : byName,
          stat: match ? SCALING[match.entry.RelatedProperty] ?? 'atk' : sectionStat,
        }
      })
      // Parts of the same type and stat add up: [type, stat, multipliers at levels 1-10]
      const terms = new Map()
      parsed.forEach((levelTerms, level) => {
        levelTerms.forEach((term, i) => {
          const key = `${kinds[i].type}:${kinds[i].stat}`
          const values = terms.get(key) ?? Array(LEVELS).fill(0)
          values[level] = round(values[level] + term.value * term.times)
          terms.set(key, values)
        })
      })
      hits.push({ label, section, terms: [...terms].map(([key, values]) => [...key.split(':'), values]) })
    }
  }
  characters[id] = { hits }
}

const output = {
  provenance: {
    source: `https://github.com/Arikatsu/WutheringWaves_Data/tree/${branch}`,
    files: [
      'BinData/role/roleinfo.json',
      'BinData/skill/skill.json',
      'BinData/skill/skilldescription.json',
      'BinData/skill/skilltype.json',
      'BinData/damage/damage.json',
      'Textmaps/en/multi_text/MultiText.json',
    ],
    extractedBy: 'src/scripts/wuwa/extractSkills.mjs',
    extractedOn: new Date().toISOString().slice(0, 10),
    note: 'Skill damage lines with terms [counts as, scaling stat, percent at skill levels 1-10]. Personal, non-commercial use.',
  },
  characters: Object.fromEntries(Object.keys(characters).sort().map((id) => [id, characters[id]])),
}
writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`)
const missing = Object.keys(data.bases).filter((id) => !characters[id])
console.log(`Wrote ${Object.keys(characters).length} Resonators${missing.length ? `, missing ${missing.join(', ')}` : ''}`)
console.log(`${unmatched.length} numbers had no damage entry and took their skill's type and stat`)
if (process.env.DEBUG) console.log(unmatched.join('\n'))

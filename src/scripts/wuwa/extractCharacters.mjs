// Adds each WuWa character's element and minor forte bonuses to src/lib/games/wuwa/data/generated/datamine.json,
// read straight from the community datamine Arikatsu/WutheringWaves_Data. Run by hand when the datamine updates:
//
//   node src/scripts/wuwa/extractCharacters.mjs <datamine folder> <branch>
//
// The datamine folder must hold these files, downloaded from
// https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/<branch>/<path>:
//   BinData/role/roleinfo.json, BinData/skillTree/skilltree.json, BinData/property/propertyindex.json,
//   Textmaps/en/multi_text/MultiText.json
// Only data files are read, nothing is fetched or run. Personal, non-commercial use, see src/lib/games/DATA-SOURCES.md.

import {
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const [datamineDir, branch] = process.argv.slice(2)
if (!datamineDir || !branch) {
  console.error('Usage: node src/scripts/wuwa/extractCharacters.mjs <datamine folder> <branch>')
  process.exit(1)
}

const OUTPUT = 'src/lib/games/wuwa/data/generated/datamine.json'
const read = (path) => JSON.parse(readFileSync(join(datamineDir, path), 'utf8'))

const ELEMENT_IDS = { 1: 'glacioDmg', 2: 'fusionDmg', 3: 'electroDmg', 4: 'aeroDmg', 5: 'spectroDmg', 6: 'havocDmg' }

// Datamine property keys to stat keys, same mapping as the WuwaEchoScorer pipeline
const PERCENT_KEYS = {
  Crit: 'critRate',
  CritDamage: 'critDmg',
  EnergyEfficiency: 'energyRegen',
  HealChange: 'healingBonus',
  DamageChangeAuto: 'basicDmg',
  DamageChangeCast: 'heavyDmg',
  DamageChangeNormalSkill: 'skillDmg',
  DamageChangeUltra: 'libDmg',
  DamageChangeElement1: 'glacioDmg',
  DamageChangeElement2: 'fusionDmg',
  DamageChangeElement3: 'electroDmg',
  DamageChangeElement4: 'aeroDmg',
  DamageChangeElement5: 'spectroDmg',
  DamageChangeElement6: 'havocDmg',
}
const BASIC_KEYS = {
  Atk: ['atkFlat', 'atkPct'],
  GreenAtk: ['atkFlat', 'atkPct'],
  LifeMax: ['hpFlat', 'hpPct'],
  GreenLifeMax: ['hpFlat', 'hpPct'],
  Def: ['defFlat', 'defPct'],
  GreenDef: ['defFlat', 'defPct'],
}
const round = (n) => Math.round(n * 1e6) / 1e6

// Percent values are stored x100 (120 = 1.2%), except ratios given as fractions (0.018 = 1.8%)
function toStat(key, raw, ratio) {
  const basic = BASIC_KEYS[key]
  if (basic) return ratio ? { stat: basic[1], value: raw < 10 ? round(raw * 100) : round(raw / 100) } : { stat: basic[0], value: raw }
  const pct = PERCENT_KEYS[key]
  return pct ? { stat: pct, value: ratio && raw < 10 ? round(raw * 100) : round(raw / 100) } : undefined
}

// Same name matching as the existing ids in datamine.json: lower case, punctuation to spaces, no leading "the"
function normalise(name) {
  return name.toLowerCase().replace(/[‘’']/g, '').replace(/[:().,\-_/]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '')
}

const text = new Map(read('Textmaps/en/multi_text/MultiText.json').map((row) => [row.Id, row.Content]))
const propertyKey = new Map(read('BinData/property/propertyindex.json').map((p) => [p.Id, p.Key]))
const tree = read('BinData/skillTree/skilltree.json')
const data = JSON.parse(readFileSync(OUTPUT, 'utf8'))

const idByName = new Map(Object.keys(data.bases).map((id) => [normalise(id), id]))
const characters = {}
const unknownProperties = new Set()

for (const role of read('BinData/role/roleinfo.json')) {
  if (role.IsTrial || role.RoleType !== 1) continue
  const name = text.get(role.Name)
  if (!name) continue
  const element = ELEMENT_IDS[role.ElementId]
  // Rovers share one name, so their ids carry the element: "rover-havoc"
  const id = idByName.get(normalise(name)) ?? (element ? idByName.get(normalise(`${name} ${element.replace('Dmg', '')}`)) : undefined)
  if (!id || characters[id]) continue

  const minorFortes = {}
  for (const node of tree) {
    // Node type 4 is a minor forte stat node
    if (node.NodeGroup !== role.SkillTreeGroupId || node.NodeType !== 4) continue
    for (const property of node.Property ?? []) {
      const key = propertyKey.get(property.Id)
      const converted = key ? toStat(key, property.Value, property.IsRatio) : undefined
      if (!converted) {
        unknownProperties.add(key ?? property.Id)
        continue
      }
      minorFortes[converted.stat] = round((minorFortes[converted.stat] ?? 0) + converted.value)
    }
  }
  characters[id] = { id, name, element: element ?? null, minorFortes }
}

const missing = Object.keys(data.bases).filter((id) => !characters[id])
data.characters = Object.fromEntries(Object.keys(characters).sort().map((id) => [id, characters[id]]))
data.provenance.included = ['bases.baseByLevel', 'weapons', 'echoes', 'sets', 'characters (element, minorFortes)']
data.provenance.characters =
  `Element (BinData/role/roleinfo.json ElementId) and minor fortes (BinData/skillTree/skilltree.json stat nodes) read directly from the datamine branch ${branch} by src/scripts/wuwa/extractCharacters.mjs on ${
    new Date().toISOString().slice(0, 10)
  }`
writeFileSync(OUTPUT, `${JSON.stringify(data, null, 2)}\n`)

console.log(`characters: ${Object.keys(characters).length}, without a match: ${missing.join(', ') || 'none'}`)
if (unknownProperties.size > 0) console.log(`unmapped forte properties: ${[...unknownProperties].join(', ')}`)

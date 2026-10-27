// Every agent's faction, by agent id, for Additional Abilities that need a teammate of the same faction (team/buffs.ts).
// From genshin-optimizer's generated ZZZ stat data (libs/zzz/stats/src/allStat_gen.json, https://github.com/frzyc/genshin-optimizer,
// MIT, Copyright (c) 2020 frzyc), faction keys as it spells them. Extracted 2026-10-26 by hand from the file's char.<name>.faction.

export type Faction =
  | 'AngelsOfDelusion'
  | 'BelebogHeavyIndustries'
  | 'CovenantOfDayat'
  | 'CriminalInvestigationSpecialResponseTeam'
  | 'CunningHares'
  | 'HollowSpecialOoperationsSection6'
  | 'KrampusComplianceAuthority'
  | 'Mockingbird'
  | 'NewEriduDefenseForce'
  | 'Phaethon'
  | 'RoscaeliferExternalStrategyDepartment'
  | 'SonsOfCalydon'
  | 'SpookShack'
  | 'StarsOfLyra'
  | 'VictoriaHousekeepingCo'
  | 'YunkuiSummit'

export const FACTIONS: Record<string, Faction> = {
  '1011': 'CunningHares', // Anby
  '1021': 'CunningHares', // Nekomata
  '1031': 'CunningHares', // Nicole
  '1041': 'NewEriduDefenseForce', // Soldier11
  '1051': 'SpookShack', // Yidhari
  '1061': 'VictoriaHousekeepingCo', // Corin
  '1071': 'SonsOfCalydon', // Caesar
  '1081': 'CunningHares', // Billy
  '1091': 'HollowSpecialOoperationsSection6', // Miyabi
  '1101': 'BelebogHeavyIndustries', // Koleda
  '1111': 'BelebogHeavyIndustries', // Anton
  '1121': 'BelebogHeavyIndustries', // Ben
  '1131': 'HollowSpecialOoperationsSection6', // Soukaku
  '1141': 'VictoriaHousekeepingCo', // Lycaon
  '1151': 'SonsOfCalydon', // Lucy
  '1161': 'SonsOfCalydon', // Lighter
  '1171': 'SonsOfCalydon', // Burnice
  '1181': 'BelebogHeavyIndustries', // Grace
  '1191': 'VictoriaHousekeepingCo', // Ellen
  '1201': 'HollowSpecialOoperationsSection6', // Harumasa
  '1211': 'VictoriaHousekeepingCo', // Rina
  '1221': 'HollowSpecialOoperationsSection6', // Yanagi
  '1241': 'CriminalInvestigationSpecialResponseTeam', // ZhuYuan
  '1251': 'CriminalInvestigationSpecialResponseTeam', // Qingyi
  '1261': 'CriminalInvestigationSpecialResponseTeam', // Jane
  '1271': 'CriminalInvestigationSpecialResponseTeam', // Seth
  '1281': 'SonsOfCalydon', // Piper
  '1291': 'Mockingbird', // Hugo
  '1301': 'NewEriduDefenseForce', // OrphieMagus
  '1311': 'StarsOfLyra', // AstraYao
  '1321': 'StarsOfLyra', // Evelyn
  '1331': 'Mockingbird', // Vivian
  '1341': 'KrampusComplianceAuthority', // Zhao
  '1351': 'SonsOfCalydon', // Pulchra
  '1361': 'NewEriduDefenseForce', // Trigger
  '1371': 'YunkuiSummit', // Yixuan
  '1381': 'NewEriduDefenseForce', // Soldier0Anby
  '1391': 'YunkuiSummit', // JuFufu
  '1401': 'SpookShack', // Alice
  '1411': 'SpookShack', // Yuzuha
  '1421': 'YunkuiSummit', // PanYinhu
  '1431': 'YunkuiSummit', // YeShunguang
  '1441': 'SpookShack', // Manato
  '1451': 'SpookShack', // Lucia
  '1461': 'NewEriduDefenseForce', // Seed
  '1471': 'KrampusComplianceAuthority', // Banyue
  '1481': 'KrampusComplianceAuthority', // Dialyn
  '1491': 'AngelsOfDelusion', // Sunna
  '1501': 'AngelsOfDelusion', // Aria
  '1511': 'AngelsOfDelusion', // NangongYu
  '1521': 'CriminalInvestigationSpecialResponseTeam', // Cissia
  '1531': 'CunningHares', // StarlightBilly
  '1541': 'KrampusComplianceAuthority', // Promeia
  '1551': 'Phaethon', // Pyrois
  '1561': 'RoscaeliferExternalStrategyDepartment', // Velina
  '1571': 'RoscaeliferExternalStrategyDepartment', // Norma
  '1581': 'CovenantOfDayat', // Remielle
  '1591': 'RoscaeliferExternalStrategyDepartment', // Sigrid
  '1611': 'RoscaeliferExternalStrategyDepartment', // Claret
  '1621': 'RoscaeliferExternalStrategyDepartment', // Roxy
}

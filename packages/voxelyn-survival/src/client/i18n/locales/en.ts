// Inglês. Tipado como `Record<MessageKey, string>` de propósito: uma chave nova
// em pt-BR quebra a COMPILAÇÃO aqui, e não a tela do jogador.
//
// A tradução persegue a VOZ, não a literalidade. O bestiário é um relatório
// corporativo que evita admitir que catalogou pessoas, e as descobertas são o
// que o jogador aprendeu morrendo — as duas coisas se perdem numa tradução
// palavra a palavra. Onde a frase em português é curta e seca, a inglesa também
// é: o texto é lido em canvas, sob pressão, e cada palavra a mais é uma que não
// cabe na linha.

import type { PT_BR } from './pt-BR';

export const EN: Record<keyof typeof PT_BR, string> = {
  // ---------------------------------------------------------------------
  // Brand and menus
  // ---------------------------------------------------------------------
  'app.title': 'Voxelyn Survival',
  'menu.title': 'VOXELYN SURVIVAL',
  'menu.tagline': 'the Vein is alive — survive it',
  'menu.solo': 'Descend',
  'menu.online': 'Online co-op',
  'menu.contract': 'Weekly Challenge',
  'menu.room.label': 'Room',
  'menu.room.placeholder': 'code',
  'menu.room.hint': 'empty = any room',
  'menu.options': 'Options',
  'menu.records': 'Log',
  'menu.rank': 'Leaderboard',
  'menu.dev.seed': 'Seed',
  'menu.dev.seed.placeholder': 'random',
  'menu.dev.server': 'Server',
  'menu.dev.server.placeholder': 'auto',
  'menu.controls': 'Tap to play · WASD/mouse on desktop · R restarts · M mutes',
  'menu.headphones': 'Use headphones: the sound warns you before the screen does.',

  'options.title': 'OPTIONS',
  'options.name': 'Name',
  'options.name.placeholder': 'anonymous',
  'options.language': 'Language',
  'options.quality': 'Quality',
  'options.quality.high': 'High',
  'options.quality.medium': 'Medium',
  'options.quality.low': 'Low (30 FPS)',
  'options.volume': 'Volume',
  'options.sound.on': 'Sound: on',
  'options.sound.off': 'Sound: off',
  'options.telemetry.on': 'Telemetry: on',
  'options.telemetry.off': 'Telemetry: off',
  'options.telemetry.note': 'anonymous session data, no identification',
  'options.back': 'Back',

  // ---------------------------------------------------------------------
  // Field menu and abandonment
  // ---------------------------------------------------------------------
  'pause.title': 'FIELD TERMINAL',
  'pause.coopWarning':
    'In co-op the world does not stop — the descent continues while you read this.',
  'pause.resume': 'Resume descent',
  'pause.abandon': 'Abandon contract',
  'pause.leave': 'Exit to terminal',
  'pause.status.noSignal': 'no signal from the sector — connection pending',
  'pause.status.closed': 'contract closed — no active descent',
  'pause.status.running': 'Sector {sector} · contamination {contamination}% · contract open',
  'pause.hint': 'ESC or hold the top of the screen for the menu',

  'abandon.title': 'ABANDON CONTRACT?',
  'abandon.notice': 'Termination record — read before confirming.',
  'abandon.material': 'Material collected in this sector',
  'abandon.material.value': 'not credited',
  'abandon.progress': 'Descent progress',
  'abandon.progress.value': 'lost',
  'abandon.rank': 'Leaderboard position',
  'abandon.rank.value': 'none',
  'abandon.unit': 'Unit in the field',
  'abandon.unit.value': 'operational loss',
  'abandon.footnote': 'the company does not record the reason.',
  'abandon.cancel': 'Continue the descent',
  'abandon.confirm': 'Confirm abandonment',

  // ---------------------------------------------------------------------
  // Co-op invite
  // ---------------------------------------------------------------------
  'invite.copy': 'Copy invite',
  'invite.shared': 'Sent',
  'invite.copied': 'Copied!',
  'invite.manual': 'Copy from the bar',
  'invite.shareText': 'Come down with me — room {room}',

  // ---------------------------------------------------------------------
  // System banners
  // ---------------------------------------------------------------------
  'banner.sound.on': 'Sound on',
  'banner.sound.off': 'Sound off',
  'banner.run.duplicate': 'Run already recorded',
  'banner.run.verified': 'Run verified and recorded',
  'banner.quality.downgraded': 'Quality lowered to {quality} (performance)',
  'banner.room.invalid': 'Invalid room code: {code}',
  'banner.connecting': 'Connecting…',
  'banner.reconnecting': 'Reconnecting…',
  'banner.offline': 'Offline — retrying',
  'banner.resync': 'Resyncing the world…',
  'banner.session.expired': 'Session expired — reconnecting…',
  'banner.version.mismatch': 'Incompatible version ({field}) — reload the page.',
  'banner.server.invalid': 'Invalid server address: {url}',
  'banner.restarting': 'Descending again…',

  // ---------------------------------------------------------------------
  // Company challenge (contract)
  // ---------------------------------------------------------------------
  'contract.weekly': 'WEEKLY CHALLENGE {period} — {vein} VEIN',
  'contract.daily': 'DAILY CHALLENGE {period} — {vein} VEIN',

  // ---------------------------------------------------------------------
  // Log panel
  // ---------------------------------------------------------------------
  'records.title': 'LOG',
  'records.totals': 'TOTALS',
  'records.totals.runs': 'Descents',
  'records.totals.deaths': 'Deaths',
  'records.totals.extractions': 'Extractions',
  'records.totals.withCore': 'With the core',
  'records.totals.kills': 'Kills',
  'records.totals.time': 'Time in the Vein',
  'records.best': 'BEST',
  'records.best.stars': 'Best grade',
  'records.best.fastestCore': 'Fastest core',
  'records.best.longestSurvival': 'Longest survival',
  'records.best.masteredSeeds': 'Seeds mastered',
  'records.assets': 'ASSET REGISTRY',
  'records.assets.locked': '— — —',
  'records.assets.noOccurrence': 'no occurrence on record',
  'records.assets.fieldName': 'field: {name}',
  'records.assets.tally': '×{count}',
  'records.discoveries': 'DISCOVERIES',
  'records.discoveries.locked': 'has not happened to you yet',
  'records.history': 'LAST DESCENTS',
  'records.history.empty': 'none yet',
  'records.history.seed': 'seed {seed}',
  'records.history.core': 'core',
  'records.history.extracted': 'out',

  // ---------------------------------------------------------------------
  // Leaderboard panel
  // ---------------------------------------------------------------------
  'rank.title': 'LEADERBOARD',
  'rank.best': 'BEST DESCENTS',
  'rank.seed': 'SEED {seed}',
  'rank.empty': 'nobody has extracted yet',
  'rank.empty.offline': 'nobody has extracted yet — or the server is down',
  'rank.loading': 'loading…',
  'rank.entry': '{position}. {stars} {name}',
  'rank.how': 'HOW TO GET IN',
  'rank.how.text':
    'Only runs that extracted count. The server re-simulates your match from the keys you pressed — there is no score to submit, only what happened.',

  // ---------------------------------------------------------------------
  // Bestiary: corporate designation and field name
  // ---------------------------------------------------------------------
  'enemy.stalker': 'Stalker',
  'enemy.spitter': 'Spitter',
  'enemy.bomber': 'Spore Bearer',
  'enemy.bruiser': 'Crusher',
  'enemy.miner': 'Miner',
  'enemy.fungal_horse': 'Steed',
  'enemy.bishop': 'Bishop',
  'enemy.guardian': 'Guardian',
  'enemy.resonant': 'Resonant',
  'enemy.mud_lamprey': 'Lamprey',
  'enemy.bellows': 'Bellows',
  'enemy.scoriac': 'Scoriac',
  'enemy.frost_wraith': 'Wraith',
  'enemy.sulfur_bomber': 'Sulfur Bearer',
  'enemy.undertaker': 'Undertaker',

  'bestiary.name.stalker': 'Stalker',
  'bestiary.name.spitter': 'Spitter',
  'bestiary.name.bomber': 'Spore Bearer',
  'bestiary.name.bruiser': 'Crusher',
  'bestiary.name.miner': 'Impoverished Miner',
  'bestiary.name.fungal_horse': 'Fungal Steed',
  'bestiary.name.resonant': 'Resonant',
  'bestiary.name.mud_lamprey': 'Mud Lamprey',
  'bestiary.name.bellows': 'Bellows',
  'bestiary.name.scoriac': 'Scoriac',
  'bestiary.name.frost_wraith': 'Frost Wraith',
  'bestiary.name.sulfur_bomber': 'Sulfur Bomber',
  'bestiary.name.undertaker': 'Undertaker',
  'bestiary.name.bishop': 'Bishop of the Vein',
  'bestiary.name.guardian': 'Guardian of the Core',

  'bestiary.code.stalker': 'SPECIMEN QUIT-04',
  'bestiary.note.stalker':
    'Tunnel fauna. Aggressive by instinct, not by organization. Removal cost negligible.',
  'bestiary.code.spitter': 'SPECIMEN FUNG-11',
  'bestiary.note.spitter':
    'Corrosive secretion with no confirmed industrial value. Sampling program discontinued.',
  'bestiary.code.bomber': 'SPECIMEN FUNG-23',
  'bestiary.note.bomber':
    'Spore vector. Spontaneous rupture documented in 100% of recorded encounters.',
  'bestiary.code.bruiser': 'SPECIMEN MIN-07',
  'bestiary.note.bruiser':
    'Animated mineral mass. Reclassified from "misplaced machinery" after the third report.',
  'bestiary.code.miner': 'UNIT EX-016',
  'bestiary.note.miner':
    'Previous-generation extractor. Operation after contract termination was not authorized. No recovery value.',
  'bestiary.code.fungal_horse': 'HOSTILE ASSET EQ-02',
  'bestiary.note.fungal_horse':
    'Adapted quadruped. The presence of a harness does not imply an operator.',
  'bestiary.code.resonant': 'SPECIMEN CRYST-01',
  'bestiary.note.resonant':
    'Induces discharge in nearby crystal formations. Loss of catalogable material attributed to the specimen, not to extraction protocol.',
  'bestiary.code.mud_lamprey': 'SPECIMEN AQU-03',
  'bestiary.note.mud_lamprey':
    'Lacustrine predator. Attacks occur exclusively from beneath the waterline. Preventive drainage exceeds sector budget.',
  'bestiary.code.bellows': 'SPECIMEN SULF-08',
  'bestiary.note.bellows':
    'Redistributes stratum gases through respiration. Utility as ventilation equipment evaluated and shelved.',
  'bestiary.code.scoriac': 'SPECIMEN VULC-05',
  'bestiary.note.scoriac':
    'Refractory slag carapace. Vulnerable after thermal exposure — a condition that also makes it considerably worse.',
  'bestiary.code.frost_wraith': 'SPECIMEN GLAC-02',
  'bestiary.note.frost_wraith':
    'Travels beneath the ice sheet. Reports of "haunting" reflect poor visibility, not anomalous phenomena.',
  'bestiary.code.sulfur_bomber': 'SPECIMEN SULF-14',
  'bestiary.note.sulfur_bomber':
    'Mineral variant of vector FUNG-23. Flammable internal charge. Neutralisation at distance from heat sources is advised — advice reiterated after the gallery 7 incident.',
  'bestiary.code.undertaker': 'UNIT EX-041',
  'bestiary.note.undertaker':
    'Scrap retrieval unit. Continues to execute its collection directive without distinguishing inactive machinery from personnel on duty. Reclassification pending since the last audit.',
  'bestiary.code.bishop': 'HOSTILE ASSET EQ-09',
  'bestiary.note.bishop':
    'Ceremonial figure. The claim of religious structure remains uncorroborated.',
  'bestiary.code.guardian': 'TERMINAL ANOMALY',
  'bestiary.note.guardian':
    'Blocks access to the core. No other property is relevant to this operation.',

  // ---------------------------------------------------------------------
  // Discoveries (codex)
  // ---------------------------------------------------------------------
  'discovery.fireSpread.title': 'Fire walks',
  'discovery.fireSpread.lesson': 'Biofluid carries flame cell by cell. A pool is a fuse.',
  'discovery.gasIgnition.title': 'The gas does not wait',
  'discovery.gasIgnition.lesson':
    'Sulfuric gas lights on first contact with fire. A closed room is a chamber.',
  'discovery.dischargePool.title': 'The whole pool is the target',
  'discovery.dischargePool.lesson':
    'A discharge runs through every connected biofluid — and does not ask who is standing in it.',
  'discovery.oreChain.title': 'Ore is wiring',
  'discovery.oreChain.lesson':
    'One vein carries the charge to the far side of the wall and releases it at the openings.',
  'discovery.fragileBreach.title': 'Not every wall is a wall',
  'discovery.fragileBreach.lesson':
    'Fragile rock yields to blast and piercing. Routes exist where there seemed to be none.',
  'discovery.selfHarm.title': 'The Vein picks no sides',
  'discovery.selfHarm.lesson':
    'Every reaction hits you the same. The strongest build is the most dangerous to carry.',
  'discovery.minerFled.title': 'It drops the load',
  'discovery.minerFled.lesson':
    'A warm gun and the miner retreats through the tunnels — leaving what it carried. Catching it costs time.',
  'discovery.minerEnraged.title': 'Heat overloads it',
  'discovery.minerEnraged.lesson':
    'Arrive red-hot and its circuit fails: pickaxe in a circle. Backing off answers it; orbiting does not.',
  'discovery.cargoLost.title': 'No recovery value',
  'discovery.cargoLost.lesson':
    'Cargo only exists past the platform. What stayed in the Vein was never yours.',
  'discovery.horseFelled.title': 'The trail stays',
  'discovery.horseFelled.lesson':
    'The charge crosses the room and leaves fire where it passed. Rock in the way ends it.',
  'discovery.bishopFelled.title': 'It heals off the ground',
  'discovery.bishopFelled.lesson':
    'On living fungus the Bishop regenerates more than you take. Burning the carpet already cuts the healing.',
  'discovery.guardianFelled.title': 'The Guardian falls',
  'discovery.guardianFelled.lesson':
    'It seals the arena at half health and calls company. The siege collapses with it.',
  'discovery.coreTaken.title': 'The core is only half',
  'discovery.coreTaken.lesson':
    'Taking it doubles the pace of contamination. The way out is the other half.',

  // ---------------------------------------------------------------------
  // End screen: cause of death and lesson
  // ---------------------------------------------------------------------
  'summary.enemy.elite': 'mutated {name}',
  'summary.cause.none.headline': 'You came out whole',
  'summary.cause.contact.headline': '{enemy} reached you',
  'summary.cause.contact.lesson': 'Melee is telegraphed. The windup sound arrives before the blow.',
  'summary.cause.projectile.headline': '{enemy} hit you from range',
  'summary.cause.projectile.rock.lesson':
    'The throw warns for 0.8 s before it leaves. Break line of sight or step sideways.',
  'summary.cause.projectile.spit.lesson':
    'Spit leaves a biofluid pool. Backing off in a straight line keeps you in its path.',
  'summary.cause.fire.headline': 'The fire consumed you',
  'summary.cause.fire.lesson':
    'Flame walks through biofluid and fungus. The floor catches before you see the flame.',
  'summary.cause.gas.headline': 'The sulfuric gas dissolved you',
  'summary.cause.gas.lesson': 'Gas pools in closed space. The kinetic pulse scatters the cloud.',
  'summary.cause.spores.headline': 'The spores took you',
  'summary.cause.spores.lesson':
    "The Bearer's cloud does not spread, but it stays. Step out of it instead of through it.",
  'summary.cause.discharge.self.headline': 'Your own discharge caught you',
  'summary.cause.discharge.self.lesson':
    'Conductive runs the whole pool. Before you electrify, look at where you are standing.',
  'summary.cause.discharge.world.headline': 'A discharge caught you in the pool',
  'summary.cause.discharge.world.lesson':
    'A broken crystal electrifies every connected biofluid. A pool is hostile ground.',
  'summary.cause.explosion.self.headline': 'You blew yourself up',
  'summary.cause.explosion.self.lesson':
    'The explosive module arms at 2.25 tiles. In a corridor, it comes back to you.',
  'summary.cause.explosion.world.headline': 'An explosion reached you',
  'summary.cause.explosion.world.lesson':
    'The Bearer detonates on death. Killing it up close is the same as setting it off on yourself.',
  'summary.cause.overheat.headline': 'Your weapon overheated on you',
  'summary.cause.overheat.lesson':
    'Heat climbs with every shot and the whine climbs with it. Let go before the top.',
  'summary.cause.bleedout.headline': 'You went out in the dark',
  'summary.cause.bleedout.lesson':
    'Downed lasts 20 s. Fall near your partner, not in the middle of the room.',
  'summary.cause.unknown.headline': 'The Vein consumed you',

  // ---------------------------------------------------------------------
  // End screen: numbers, outcome and next star
  // ---------------------------------------------------------------------
  'summary.stat.time': 'Time',
  'summary.stat.contamination': 'Contamination',
  'summary.stat.kills': 'Kills',
  'summary.stat.damageDealt': 'Damage dealt',
  'summary.stat.damageTaken': 'Damage taken',
  'summary.stat.damagePerShot': 'Damage/shot',
  'summary.stat.salvage': 'Salvage',
  'summary.stat.modules': 'Modules',
  'summary.stat.ore': 'Ore',
  'summary.stat.none': '—',
  'summary.outcome.core': 'CORE EXTRACTED',
  'summary.outcome.extracted': 'EXTRACTED WITHOUT THE CORE',
  'summary.outcome.dead': 'THE VEIN CONSUMED YOU',
  'summary.reputation.one': 'CORPORATE RECORD: 1 inactive unit destroyed — no recovery value.',
  'summary.reputation.other':
    'CORPORATE RECORD: {count} inactive units destroyed — no recovery value.',
  'summary.nextStar.three': '★★★ requires the core in {target} — you went {over} over.',
  'summary.nextStar.two': "★★ requires leaving with the Guardian's core.",
  'summary.nextStar.one': '★ requires reaching extraction alive.',
  'summary.seed': 'seed {seed}',
  'summary.restart': 'Tap or press R to descend again',

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  'banner.expedition.offline': 'AURIX UNREACHABLE · LOCAL SIMULATION, NOTHING WILL BE RECORDED',
  'banner.expedition.pending': 'TRANSMISSION INTERRUPTED · TELEMETRY WILL BE RESENT',
  'banner.cargo.cleared': 'CARGO CLEARED · +{ore} ORE AND +{cores} CORE',
  'banner.cargo.lost': 'NO RECOVERY VALUE · {ore} CARGO LOST IN THE VEIN',
  'hud.cargo': '{count} CARGO',
  'hud.purgeCells': 'PURGE CELL ×{count}',
  'hud.sector': 'SECTOR {sector}/{total}',
  'hud.objective.descend': 'DESCEND THE SHAFT',
  'hud.objective.ascend': 'ASCEND AT THE ENTRANCE — THE SHAFT IS SEALED',
  'hud.objective.extract': 'EXTRACT AT THE ENTRANCE',
  'hud.objective.findCore': 'FIND THE CORE',
  'hud.cache': 'CACHE: {direction} · ~{distance}m',
  'hud.direction.east': 'EAST',
  'hud.direction.west': 'WEST',
  'hud.direction.south': 'SOUTH',
  'hud.direction.north': 'NORTH',

  // Strata and occupations of the Vein (the descent's biome grammar)
  'biome.stratum.basalt': 'BASALT GALLERIES',
  'biome.stratum.prismatic': 'PRISMATIC CATHEDRAL',
  'biome.stratum.aquifer': 'BLACK AQUIFER',
  'biome.stratum.sulfur': 'SULFUROUS RIFT',
  'biome.stratum.furnace': 'ABYSSAL FURNACE',
  'biome.stratum.silica': 'SILICA SINKHOLES',
  'biome.stratum.glacial': 'GLACIAL CRYPT',
  'biome.stratum.ferric': 'FERRIC STRATUM',
  'biome.occupation.mycelial': 'MYCELIAL MATRIX',
  'biome.occupation.aurix': 'AURIX SCAR',

  // ---------------------------------------------------------------------
  // Run toasts
  // ---------------------------------------------------------------------
  'toast.ability.assimilated': '{ability} ASSIMILATED',
  'toast.core.taken': 'CORE EXTRACTED — RETURN TO THE ENTRANCE!',
  'toast.guardian.awake': 'THE GUARDIAN AWOKE',
  'toast.module.expired': '{module} DEACTIVATED',
  'toast.cache.opened': 'CACHE RECOVERED',
  'toast.purgeCell': '+1 PURGE CELL',
  'toast.scan.complete': 'SCAN COMPLETE — CACHE REVEALED',
  'toast.overheat': 'OVERHEAT!',
  'toast.well.resonance': 'THE VEIN RESONATES — TWO ECHOES DEMONSTRATE',
  'toast.sector.entered': 'SECTOR {sector} — {biome}',

  // Messages emitted by the simulation (they arrive as a key, never as text)
  'sim.partnerRevived': 'Partner revived.',
  'sim.reviveBeforeDescend': 'Revive the downed partner before descending.',
  'sim.waitAtShaft': 'Wait for everyone at the shaft to descend.',
  'sim.coreTaken': 'Core extracted. The Vein woke — climb back to the surface, sector by sector!',
  'sim.wellSealedReturn': 'The shaft has sealed. The way out is the way you came in.',
  'sim.reviveBeforeExtract': 'Revive the downed partner before extracting.',
  'sim.waitAtExit': 'Wait for everyone at the exit to extract.',
  'sim.contaminationRising': 'The Vein stirs — contamination is rising.',
  'sim.coreDropped': 'The core fell with its bearer.',
  'sim.arenaSealed': 'The Vein closes in. Open a way or fight.',
  'sim.siegeCollapsed': 'The siege collapses with the Guardian.',

  // ---------------------------------------------------------------------
  // Module choice
  // ---------------------------------------------------------------------
  'choice.title': 'MODULE DATA FOUND',
  'choice.card': '[{index}] {label}',
  'choice.recharge': 'RECHARGE · {lifetime}',
  'choice.volatile': 'VOLATILE',

  'module.piercing.label': 'PIERCING',
  'module.piercing.description':
    'Pierces targets without repeating damage during the pass-through.',
  'module.piercing.proc': 'PASS-THROUGHS',
  'module.conductive.label': 'CONDUCTIVE',
  'module.conductive.description': 'Discharges connected biofluid and materials.',
  'module.conductive.proc': 'DISCHARGES',
  'module.explosive.label': 'EXPLOSIVE',
  'module.explosive.description': 'Detonates armed impacts in an area. Dangerous at close range.',
  'module.explosive.proc': 'EXPLOSIONS',
  'module.siphon.label': 'SIPHON',
  'module.siphon.description': 'Recovers 2 HP when a useful hit is drained.',
  'module.siphon.proc': 'DRAINS',
  'module.ricochet.label': 'RICOCHET LENS',
  'module.ricochet.description': 'Makes the bolt bounce once off a solid surface.',
  'module.ricochet.proc': 'BOUNCES',
  'module.return_disc.label': 'RETURN DISC',
  'module.return_disc.description':
    'Deals damage on the way out and returns chasing the Prospector.',
  'module.return_disc.proc': 'RETURNS',
  'module.lifetime.charges': '{count} {proc}',
  'module.lifetime.duration': '{seconds}s',

  // ---------------------------------------------------------------------
  // Abilities and resonance
  // ---------------------------------------------------------------------
  'ability.pulse.label': 'KINETIC PULSE',
  'ability.pulse.hint':
    'Shoves and scatters clouds. It is the way out when something is already on you.',
  'ability.pulse.origin': 'Standard prospecting equipment.',
  'ability.flamethrower.label': 'THERMAL BREATH',
  'ability.flamethrower.hint':
    'The flame STAYS on the ground. Worth it in a corridor, a trap on your way back.',
  'ability.flamethrower.origin': 'The Vein heard you dry and burn what you found.',
  'ability.seeker.label': 'SEEKER LANCE',
  'ability.seeker.hint':
    'Just one, curving slowly. Release once the target has committed to a direction.',
  'ability.seeker.origin': 'The Vein heard you detonate what you found.',
  'ability.arc.label': 'CONDUCTIVE ARC',
  'ability.arc.hint':
    'Jumps between nearby bodies and needs no pool. A packed group is the target.',
  'ability.arc.origin': 'The Vein heard you electrify what you found.',
  'ability.offer.use': 'USE — {ability}',

  'resonance.fire': 'COMBUSTION',
  'resonance.current': 'CURRENT',
  'resonance.blast': 'BLAST',
  'resonance.kinetic': 'IMPACT',

  // ---------------------------------------------------------------------
  // Echoes of the Vein (black box)
  // ---------------------------------------------------------------------
  'echo.prompt': 'USE — PAIR BLACK BOX',
  'echo.designation': 'UNIT {serial}',
  'echo.carcass': '{condition} CARCASS',
  'echo.aggregate': '{count} UNITS LOST IN THIS CHAMBER — PREDOMINANT CAUSE BELOW',
  'echo.condition.scorched': 'CHARRED',
  'echo.condition.arced': 'ELECTROCUTED',
  'echo.condition.ruptured': 'RUPTURED',
  'echo.condition.crushed': 'CRUSHED',
  'echo.condition.dissolved': 'CORRODED',
  'echo.condition.overgrown': 'COLONIZED',
  'echo.condition.intact': 'INTACT',
};

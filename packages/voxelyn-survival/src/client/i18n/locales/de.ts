// Deutsch. Typisiert als `Record<MessageKey, string>` mit Absicht: Ein neuer
// Schlüssel in pt-BR bricht hier die KOMPILIERUNG, nicht den Bildschirm der
// spielenden Person.
//
// Die Übersetzung folgt der STIMME, nicht der Wörtlichkeit — wie schon in
// en.ts. Das deutsche Amtsdeutsch ist der natürliche Partner der
// Firmenstimme dieses Spiels: Nominalstil, Passiv und die Gewohnheit, einen
// Befehl im Infinitiv zu benennen (Sicherheitshinweis, keine Einladung),
// treffen genau den Ton, den pt-BR und Englisch erst nachbilden müssen.

import type { PT_BR } from './pt-BR';

export const DE: Record<keyof typeof PT_BR, string> = {
  'arena.suture.flight': 'Tick {tick} · Flug {takeoff}–{land} · Treffer {impact}',
  'arena.suture.tick': 'Einen Tick vorrücken',
  'arena.suture.title': 'Nähte · Inspektion',
  'arena.suture.select': 'Die Schneiderin auswählen und die Arena starten.',
  'arena.suture.status': 'Tick {tick} · Ladung {done}/{total} · {taut} gespannte Halteseile',
  'arena.suture.inspect': 'Halteseil untersuchen',
  'arena.suture.cut': 'Halteseil durchtrennen',
  'arena.suture.anchor': 'Anker sprengen',
  'arena.suture.step': 'Um 0,4 s vorrücken',
  'arena.suture.phase': 'Zweite Phase',
  'arena.suture.pause': 'Pausieren',
  'arena.suture.resume': 'Fortsetzen',
  'arena.tools.show': 'Werkzeuge',
  'arena.tools.hide': 'Werkzeuge ausblenden',
  'arena.setup.title': 'BOSS-ARENA',
  'arena.setup.subtitle':
    'Isoliertes Playtest-Werkzeug: Boss und Startbedingungen wählen und den Kampf selbst bestreiten. Der gesamte Sektor (Gelände, Trash-Gegner, Fundorte) entspricht dem, was ein normaler Abstieg erzeugen würde — nur der Weg bis hierher entfällt.',
  'arena.setup.locale': 'Sprache',
  'arena.setup.boss': 'Boss',
  'arena.setup.hp': 'Maximale HP des Prospectors',
  'arena.setup.ability': 'Echo (ausgerüstete Fähigkeit)',
  'arena.setup.modules': 'Aktive Module',
  'arena.setup.matrix': 'Generationsmatrix',
  'arena.setup.stabilisers': 'Gyroskopische Stabilisatoren (MV-04)',
  'arena.setup.stabilisersHint':
    'Ohne das Upgrade bremst der Prospector auf Eis ~2,5 Kacheln aus; mit ihm ~1,0 — und er findet die Richtung viermal schneller wieder. Schützt nicht vor Rissen: Erkauft wird nur die Routenpräzision, um der kritischen Zelle auszuweichen.',
  'arena.setup.coop': 'Vorführ-Koop',
  'arena.setup.coopPartner': 'Zweiter Prospector, unbeweglich (Slot 1)',
  'arena.setup.coopHint':
    'Niemand steuert ihn: Er zeigt das Einfrieren des Partners — Reif, Erstarrung und beide Anzeigen auf unterschiedlichem Stand.',
  'arena.setup.enter': 'Arena betreten',
  'arena.end.victory': 'Boss besiegt',
  'arena.end.defeat': 'Der Prospector ist gefallen',
  'arena.end.abandoned': 'Kampf abgebrochen',
  'arena.end.ticks': '{ticks} Ticks simuliert',
  'arena.end.cause': 'Ursache: {cause}',
  'arena.end.noCause': 'keine',
  'arena.end.damageDealt': 'Verursachter Schaden: {value}',
  'arena.end.damageTaken': 'Erlittener Schaden: {value}',
  'arena.end.shots': 'Abgefeuerte Schüsse: {value}',
  'arena.end.retry': 'Erneut versuchen (gleiche Bedingungen)',
  'arena.end.reconfigure': 'Konfiguration ändern',
  'toast.boss.awake': '{name} ERWACHTE',
  // ---------------------------------------------------------------------
  // Marke und Menübildschirme
  // ---------------------------------------------------------------------
  'app.title': 'Voxelyn Survival',

  // ---------------------------------------------------------------------
  // Boot-Sequenz (siehe src/client/boot/)
  // ---------------------------------------------------------------------
  'boot.ident.alt': 'Marke der Entwickler',
  'boot.title.line1': 'VOXELYN',
  'boot.title.line2': 'SURVIVAL',
  'boot.status.start': 'Einheitssysteme werden hochgefahren',
  'boot.status.fonts': 'Firmentypografie wird geladen',
  'boot.status.core': 'Chassis und Kontaktkörper werden montiert',
  'boot.status.terrain': 'Schichten und Oberflächen werden aufgebaut',
  'boot.status.props': 'Feldausrüstung wird installiert',
  'boot.status.keyart': 'Eröffnungsbild wird komponiert',
  'boot.status.ready': 'Einheit einsatzbereit',
  'boot.error.title': 'INBETRIEBNAHME FEHLGESCHLAGEN',
  'boot.error.body':
    'Wesentliche Ressourcen der Einheit sind nicht eingetroffen. Verbindung prüfen und einen neuen Versuch autorisieren.',
  'boot.error.retry': 'Erneut versuchen',
  'menu.title': 'VOXELYN SURVIVAL',
  'menu.tagline': 'die Ader lebt — überlebe sie',
  'menu.solo': 'Absteigen',
  'menu.online': 'Online-Koop',
  'menu.contract': 'Wochenherausforderung',
  'menu.room.label': 'Raum',
  'menu.room.placeholder': 'Code',
  'menu.room.hint': 'leer = beliebiger Raum',
  'menu.mode.solo': 'Freier Abstieg',
  'menu.mode.solo.sub': 'Allein · zufälliger Seed',
  'menu.mode.online.sub': 'Offener Raum oder per Code',
  'menu.mode.training.sub': 'Chassis-Übung',
  'menu.options': 'Optionen',
  // Kurze Trittleisten-Labels mit Absicht: fünf Reiter müssen auf 320px passen.
  'rail.records': 'Register',
  'rail.matrix': 'Matrix',
  'rail.rank': 'Bestenliste',
  'rail.options': 'Optionen',
  'menu.records': 'Register',
  'menu.rank': 'Bestenliste',
  'menu.dev.seed': 'Seed',
  'menu.dev.seed.placeholder': 'zufällig',
  'menu.dev.server': 'Server',
  'menu.dev.server.placeholder': 'automatisch',
  'menu.controls.tap': 'Zum Spielen tippen',
  'menu.controls.headphones': 'Kopfhörer benutzen: der Ton warnt zuerst',
  'menu.controls.keys':
    ' · WASD bewegt · Maus zielt und feuert · R startet neu · T zurück zum Terminal · M stummschalten',

  // Aurix-Chrom des Redesigns (Dok. AD-UI-2.0): dekorative Beschriftungen im
  // Dokumentenstil. Ändern die Bedeutung keines bestehenden Buttons — nur den
  // Briefkopf.
  'aurix.motto': 'FÖRDERN. SCHÜTZEN. ANPASSEN.',
  'aurix.rail.dispatch': 'Einsatzbefehl',
  'aurix.rail.copy': 'Durchschlag für die Einheit',
  'aurix.menu.docTitle': 'Einsatzbefehl',
  'aurix.menu.requisition': 'Anforderung',
  'menu.clearance.generation': 'PROSPECTOR {generation}',
  'menu.clearance.depth': 'ABSTIEGSGENEHMIGUNG: {sectors} SEKTOREN',
  'menu.clearance.cores': 'ERFASSBARE KERNE: {cores}',
  'aurix.menu.authorisation': 'Abstiegsgenehmigung',
  'aurix.doc.options': 'AD-CFG-2.1 · lokales Terminal',
  'aurix.doc.records': 'AD-REG-8.1 · Bergungsregister',
  'aurix.doc.matrix': 'AD-MTX-5.0 · Freigabekonsole',
  'aurix.doc.rank': 'AD-RNK-6.2 · freigegebene Expeditionen',
  'aurix.doc.pause': 'AD-DEP-0114 · laufender Vertrag',
  'aurix.doc.abandon': 'FORMULAR AD-RS-04 · Ausbuchung eines Assets',
  'aurix.abandon.stamp': 'ohne Verwertungswert',
  'aurix.options.operator': 'Bedienperson',
  'aurix.options.video': 'Bildsystem',
  'aurix.options.audio': 'Audio',
  'aurix.options.network': 'Netzwerk',
  'aurix.options.telemetry': 'Telemetrie',
  'aurix.options.credits': 'Danksagung',
  'credits.game': 'Spiel von DaniTools (@dani.tools)',
  'credits.music': 'Musik von Clevo (@clevoclevoclevo)',
  'aurix.options.footer': 'Änderungen werden lokal gespeichert',

  'options.title': 'OPTIONEN',
  'options.name': 'Name',
  'options.name.placeholder': 'anonym',

  'runname.label.solo': 'BERICHT UNTERZEICHNEN',
  'runname.label.team': 'TEAMNAME',
  'runname.hint.solo': 'Unter diesem Namen kommt der Lauf in die Rangliste.',
  'runname.hint.team': 'Du hast den Raum eröffnet: Der Teamname in der Rangliste ist deiner.',
  'runname.confirm': 'UNTERZEICHNEN',
  'runname.skip': 'ÜBERSPRINGEN',
  'options.language': 'Sprache',
  'options.quality': 'Qualität',
  'options.quality.high': 'Hoch',
  'options.quality.medium': 'Mittel',
  'options.quality.low': 'Niedrig (30 FPS)',
  'options.volume': 'Lautstärke',
  'options.sfx': 'Effekte',
  'options.music': 'Musik',
  'options.musicSource': 'Soundtrack',
  'options.musicSource.composed': 'Komponiert',
  'options.musicSource.synth': 'Synthetisiert (klassisch)',
  'options.sound.on': 'Ton: an',
  'options.sound.off': 'Ton: aus',
  'options.telemetry.on': 'Telemetrie: an',
  'options.telemetry.off': 'Telemetrie: aus',
  'options.telemetry.note': 'anonyme Sitzungsdaten, ohne Identifikation',
  'options.net.probe': 'Messen',
  'options.net.probing': 'wird gemessen…',
  'options.net.idle': 'Latenz noch nicht gemessen',
  'options.net.live': 'Umlaufzeit {rtt} ms zum Server des Raums',
  'options.net.probed': 'Umlaufzeit {rtt} ms zum Server',
  'options.net.unreachable': 'Server nicht erreichbar',
  'options.net.cushion':
    'die Darstellung bleibt {cushion} ms hinter dem Server zurück, um Schwankungen abzufedern — das unterscheidet Zielen auf das Gesehene von Zielen dahinter',
  'options.back': 'Zurück',

  // ---------------------------------------------------------------------
  // Feldmenü und Abbruch
  // ---------------------------------------------------------------------
  'pause.title': 'FELDTERMINAL',
  'pause.coopWarning':
    'Im Koop steht die Welt nicht still — der Abstieg läuft weiter, während Sie dies lesen.',
  'pause.resume': 'Abstieg fortsetzen',
  'pause.abandon': 'Vertrag abbrechen',
  'pause.leave': 'Zum Terminal zurückkehren',
  'pause.status.noSignal': 'kein Signal vom Sektor — Verbindung ausstehend',
  'pause.status.closed': 'Vertrag beendet — kein aktiver Abstieg',
  'pause.status.running': 'Sektor {sector} · Kontamination {contamination}% · Vertrag offen',
  'pause.hint': 'ESC oder oberen Bildschirmrand halten fürs Menü',

  'abandon.title': 'VERTRAG ABBRECHEN?',
  'abandon.notice': 'Kündigungsprotokoll — vor Bestätigung lesen.',
  'abandon.material': 'In diesem Sektor geborgenes Material',
  'abandon.material.value': 'nicht angerechnet',
  'abandon.progress': 'Fortschritt des Abstiegs',
  'abandon.progress.value': 'verloren',
  'abandon.rank': 'Platzierung in der Bestenliste',
  'abandon.rank.value': 'keine',
  'abandon.unit': 'Einheit im Feld',
  'abandon.unit.value': 'Betriebsverlust',
  'abandon.footnote': 'die Firma erfasst den Grund nicht.',
  'abandon.cancel': 'Abstieg fortsetzen',
  'abandon.confirm': 'Abbruch bestätigen',

  // ---------------------------------------------------------------------
  // Koop-Einladung
  // ---------------------------------------------------------------------
  'invite.channel': 'VERSCHLÜSSELTER KANAL',
  'invite.copy': 'Einladung kopieren',
  'invite.shared': 'Gesendet',
  'invite.copied': 'Kopiert!',
  'invite.manual': 'Aus der Leiste kopieren',
  'invite.shareText': 'Steig mit mir ab — Raum {room}',

  // ---------------------------------------------------------------------
  // Systembanner
  // ---------------------------------------------------------------------
  'banner.sound.on': 'Ton an',
  'banner.sound.off': 'Ton aus',
  'banner.run.duplicate': 'Lauf bereits erfasst',
  'banner.run.verified': 'Lauf geprüft und erfasst',
  'banner.quality.downgraded': 'Qualität auf {quality} reduziert (Leistung)',
  'banner.room.invalid': 'Ungültiger Raumcode: {code}',
  'banner.connecting': 'Verbindung wird aufgebaut…',
  'banner.reconnecting': 'Verbindung wird wiederhergestellt…',
  'banner.offline': 'Offline — neuer Versuch läuft',
  'banner.resync': 'Welt wird neu synchronisiert…',
  'banner.session.expired': 'Sitzung abgelaufen — Verbindung wird wiederhergestellt…',
  'banner.version.mismatch': 'Version nicht kompatibel ({field}) — Seite neu laden.',
  'banner.server.invalid': 'Ungültige Serveradresse: {url}',
  'banner.restarting': 'Erneuter Abstieg…',

  // ---------------------------------------------------------------------
  // Herausforderung der Firma (Vertrag)
  // ---------------------------------------------------------------------
  'contract.weekly': 'WOCHENHERAUSFORDERUNG {period} — ADER {vein}',
  'contract.daily': 'TAGESHERAUSFORDERUNG {period} — ADER {vein}',

  // ---------------------------------------------------------------------
  // Panel „Register“
  // ---------------------------------------------------------------------
  'records.title': 'REGISTER',
  'records.tab.summary': 'Übersicht',
  'records.tab.assets': 'Assets',
  'records.tab.discoveries': 'Entdeckungen',
  'records.tab.history': 'Verlauf',
  'records.totals': 'GESAMT',
  'records.totals.runs': 'Abstiege',
  'records.totals.deaths': 'Tode',
  'records.totals.extractions': 'Bergungen',
  'records.totals.withCore': 'Mit Kern',
  'records.totals.kills': 'Abschüsse',
  'records.totals.time': 'Zeit in der Ader',
  'records.best': 'BESTLEISTUNGEN',
  'records.best.stars': 'Beste Wertung',
  'records.best.fastestCore': 'Schnellster Kern',
  'records.best.longestSurvival': 'Längstes Überleben',
  'records.best.masteredSeeds': 'Gemeisterte Seeds',
  'records.assets': 'ASSET-REGISTER',
  'records.assets.locked': '— — —',
  'records.assets.noOccurrence': 'kein Vorkommen erfasst',
  'records.assets.fieldName': 'Feld: {name}',
  'records.assets.tally': '×{count}',
  'records.discoveries': 'ENTDECKUNGEN',
  'records.discoveries.locked': 'ist Ihnen noch nicht widerfahren',
  'records.history': 'LETZTE ABSTIEGE',
  'records.history.empty': 'noch keine',
  'records.history.seed': 'Seed {seed}',
  'records.history.core': 'Kern',
  'records.history.extracted': 'geborgen',
  'records.replay': 'Diesen Abstieg erneut ansehen',

  // ---------------------------------------------------------------------
  // Panel „Bestenliste“
  // ---------------------------------------------------------------------
  'rank.title': 'BESTENLISTE',
  'rank.best': 'BESTE ABSTIEGE',
  'rank.seed': 'SEED {seed}',
  'rank.empty': 'noch niemand hat geborgen',
  'rank.empty.unreachable': 'Aurix hat nicht geantwortet — das Register war nicht einsehbar',
  'rank.loading': 'wird geladen…',
  'rank.entry': '{position}. {stars} {name}',
  'rank.col.operator': 'Bedienperson',
  'rank.col.cores': 'Kerne',
  'rank.col.time': 'Zeit',
  'rank.class': '{sectors} Sektoren',
  'rank.class.entries': '{entries} freigegebene Expeditionen',
  'rank.replay': 'Maßgeblichen Replay ansehen',
  'rank.self': 'Sie',
  'rank.how': 'TEILNAHMEBEDINGUNGEN',
  'rank.how.1':
    'Nur geborgene Läufe zählen. Der Server simuliert die Partie anhand Ihrer Tastenanschläge neu: Es gibt keinen Punktestand zum Einreichen, nur das, was geschehen ist.',
  'rank.how.2':
    'Die Platzierung ergibt sich aus zwei Größen: wie viele Kerne Sie geborgen haben und wie lange es gedauert hat.',
  'rank.how.3':
    'Jede Tiefe führt ihr eigenes Register: Abstiege über drei Sektoren treten nicht gegen solche über sieben an.',

  // ---------------------------------------------------------------------
  // Panel „Replay“ (replay.html)
  // ---------------------------------------------------------------------
  'replay.badge': 'Maßgeblicher Replay — neu simuliert aus dem freigegebenen Protokoll',
  'replay.badge.local':
    'Lokaler Replay — neu simuliert aus dem auf diesem Gerät erfassten Protokoll',
  'replay.back': '← zurück zur Bestenliste',
  'replay.unavailable.local':
    'Das Protokoll dieses Abstiegs liegt nicht mehr auf diesem Gerät — oder wurde von einer anderen Simulationsversion erstellt.',
  'replay.loading.title': 'Replay wird geladen…',
  'replay.invalid.title': 'Ungültiger Replay',
  'replay.invalid.detail': 'Diese Seite benötigt eine Lauf-ID in der URL.',
  'replay.unavailable.title': 'Replay nicht verfügbar',
  'replay.unavailable.detail':
    'Für diesen Lauf ist kein Replay gespeichert — oder der Server ist nicht erreichbar.',
  'replay.corrupt.title': 'Replay beschädigt',
  'replay.corrupt.detail': 'Das gespeicherte Protokoll dieses Laufs konnte nicht gelesen werden.',
  'replay.pause': 'Pausieren',
  'replay.resume': 'Fortsetzen',
  'replay.restart': 'Neu starten',

  // ---------------------------------------------------------------------
  // Bestiarium: Firmenbezeichnung und Feldname
  // ---------------------------------------------------------------------
  'enemy.stalker': 'Schleicher',
  'enemy.spitter': 'Spucker',
  'enemy.bomber': 'Sporenträger',
  'enemy.bruiser': 'Brecher',
  'enemy.miner': 'Bergmann',
  'enemy.fungal_horse': 'Ross',
  'enemy.bishop': 'Bischof',
  'enemy.guardian': 'Hüter',
  'enemy.resonant': 'Resonator',
  'enemy.mud_lamprey': 'Neunauge',
  'enemy.bellows': 'Blasebalg',
  'enemy.scoriac': 'Scoriac',
  'enemy.frost_wraith': 'Frostgeist',
  'enemy.sulfur_bomber': 'Bomber',
  'enemy.seamstress_brood': 'Brut der Schneiderin',
  'enemy.silk_spiderling': 'Spinnchen',
  'bestiary.name.silk_spiderling': 'Spinnchen',
  'bestiary.code.silk_spiderling': 'EXEMPLAR SUT-04',
  'bestiary.note.silk_spiderling':
    'Harmlos. Lebt im Umkreis der Nähte und flüchtet, sobald es einen Prospector erblickt; ein Schritt darauf genügt, um es zu zerquetschen.',
  'bestiary.name.seamstress_brood': 'Brut der Schneiderin',
  'bestiary.code.seamstress_brood': 'EXEMPLAR SUT-03',
  'bestiary.note.seamstress_brood':
    'Schlüpft aus dem Hinterleib der Schneiderin. Duckt sich, markiert den Landepunkt und springt. Die Markierung verlassen und während der Erholung angreifen.',
  'seamstress.hint': 'Faden durchtrennen · der Markierung ausweichen',
  'seamstress.exposed': 'HINTERLEIB FREI · jetzt angreifen',
  'seamstress.aloft': 'SIE IST AUFGESTIEGEN · das Netz entsteht: die Bänder lesen',
  'seamstress.frenzy':
    'RASEREI · das Netz trägt sie ({integrity}%) · unter 60% durchtrennen, um sie freizulegen · die Näher töten',
  'enemy.stitcher': 'Näher',
  'enemy.seamstress': 'Die Schneiderin',
  'bestiary.name.stitcher': 'Näher',
  'bestiary.name.seamstress': 'Die Schneiderin',
  'bestiary.code.stitcher': 'EXEMPLAR SUT-01',
  'bestiary.code.seamstress': 'MATRIX SUT-00',
  'bestiary.note.stitcher':
    'Näht Durchgänge zwischen zwei Ankern. Den Arbeiter vor dem dritten Stich unterbrechen oder die Route schließen lassen. Gespannte Fäden peitschen nach dem Durchtrennen zurück.',
  'bestiary.note.seamstress':
    'Wählt einen Halt, fliegt über den Fels und schlägt an der markierten Stelle zu. Den einzigen aktiven Faden durchtrennen, um den Hinterleib freizulegen. Die Brut springt; unter halber Lebenskraft reiht sie zwei Stürmangriffe aneinander.',
  'biome.occupation.stitchers': 'NÄHERKOLONIE',
  'bossBar.material.seamstress': 'mineralische Seide und blasses Chitin',
  'suture.objective': 'Hängende Ladung: {done}/{total} · +24 Erz',
  'suture.reward': 'GENÄHTE LADUNG GEBORGEN',
  'summary.cause.suture_whip.headline': 'Die Naht schlug zurück.',
  'summary.cause.suture_whip.lesson':
    'Nach dem Durchtrennen eines gespannten Fadens die markierte Bahn verlassen, bevor er zurückschnellt.',
  'summary.cause.suture_fall.headline': 'Die hängende Last stürzte ab.',
  'summary.cause.suture_fall.lesson':
    'Ein gesprengter Anker lässt die Platte fallen. Kreuze auf dem Boden zeigen an, wo sie aufschlägt.',
  'enemy.undertaker': 'Totengräber',
  'enemy.diamandis': 'Diamandis',
  'enemy.white_devourer': 'Weißer Verschlinger',
  'enemy.devourer_brood': 'Brut',
  'enemy.archcantor': 'Erzkantor',
  'enemy.sheet_leviathan': 'Grundwasser-Leviathan',
  'enemy.lung_matrix': 'Lungenmatrix',
  'enemy.furnace_heart': 'Ofenherz',
  'enemy.frost_queen': 'Frostkönigin',
  'enemy.magnetarch': 'Magnetarch',

  'bestiary.name.stalker': 'Schleicher',
  'bestiary.name.spitter': 'Spucker',
  'bestiary.name.bomber': 'Sporenträger',
  'bestiary.name.bruiser': 'Brecher',
  'bestiary.name.miner': 'Verarmter Bergmann',
  'bestiary.name.fungal_horse': 'Pilzross',
  'bestiary.name.resonant': 'Resonator',
  'bestiary.name.mud_lamprey': 'Schlammneunauge',
  'bestiary.name.bellows': 'Blasebalg',
  'bestiary.name.scoriac': 'Scoriac',
  'bestiary.name.frost_wraith': 'Frostgeist',
  'bestiary.name.sulfur_bomber': 'Schwefelbomber',
  'bestiary.name.undertaker': 'Totengräber',
  'bestiary.name.diamandis': 'Diamandis',
  'bestiary.name.white_devourer': 'Weißer Verschlinger',
  'bestiary.name.devourer_brood': 'Würmchen',
  'bestiary.name.archcantor': 'Erzkantor',
  'bestiary.name.sheet_leviathan': 'Grundwasser-Leviathan',
  'bestiary.name.lung_matrix': 'Lungenmatrix',
  'bestiary.name.furnace_heart': 'Ofenherz',
  'bestiary.name.frost_queen': 'Frostkönigin',
  'bestiary.name.magnetarch': 'Magnetarch',
  'bestiary.name.bishop': 'Bischof der Ader',
  'bestiary.name.guardian': 'Hüter des Kerns',
  // Der MATERIAL-AKZENT der Lebensleiste jedes Bosses (boss-health-bar-palette.ts):
  // das Materialpaar, das Rahmen und Name tragen. Das Label, das die Arena-Galerie
  // neben dem Namen zeigt.
  'bossBar.material.neutral': 'Knochen und Schiefer',
  'bossBar.material.guardian': 'Basalt und Knochen',
  'bossBar.material.bishop': 'Pilz und Bioflüssigkeit',
  'bossBar.material.diamandis': 'Aurix-Metall und Energie',
  'bossBar.material.white_devourer': 'Elfenbein-Silikat',
  'bossBar.material.archcantor': 'prismatischer Kristall',
  'bossBar.material.sheet_leviathan': 'Tiefenwasser und elektrisches Zyan',
  'bossBar.material.lung_matrix': 'Schwefel und Knochen',
  'bossBar.material.furnace_heart': 'Kohle und Glut',
  'bossBar.material.frost_queen': 'weißes Eis und Zyan',
  'bossBar.material.magnetarch': 'Eisen, Rost und Magnetismus',

  'bestiary.code.stalker': 'EXEMPLAR QUIT-04',
  'bestiary.note.stalker':
    'Tunnelfauna. Aggressiv aus Instinkt, nicht aus Organisation. Beseitigungskosten vernachlässigbar.',
  'bestiary.code.spitter': 'EXEMPLAR FUNG-11',
  'bestiary.note.spitter':
    'Ätzendes Sekret ohne bestätigten industriellen Wert. Probenprogramm eingestellt.',
  'bestiary.code.bomber': 'EXEMPLAR FUNG-23',
  'bestiary.note.bomber':
    'Sporenvektor. Spontane Ruptur in 100% der erfassten Begegnungen dokumentiert.',
  'bestiary.code.bruiser': 'EXEMPLAR MIN-07',
  'bestiary.note.bruiser':
    'Belebte Mineralmasse. Nach dem dritten Bericht von „verirrtem Maschinenpark“ umklassifiziert.',
  'bestiary.code.miner': 'EINHEIT EX-016',
  'bestiary.note.miner':
    'Fördereinheit der Vorgängergeneration. Betrieb nach Vertragsende nicht autorisiert. Ohne Verwertungswert.',
  'bestiary.code.fungal_horse': 'FEINDLICHES ASSET EQ-02',
  'bestiary.note.fungal_horse':
    'Angepasster Vierbeiner. Das Vorhandensein von Geschirr impliziert keine Bedienperson.',
  'bestiary.code.resonant': 'EXEMPLAR CRIST-01',
  'bestiary.note.resonant':
    'Induziert Entladung in nahen Kristallformationen. Verlust von katalogisierbarem Material wird dem Exemplar zugeschrieben, nicht dem Förderprotokoll. Zusatz: In Gegenwart eines größeren Exemplars stellen isolierte Individuen den Eigenbetrieb ein und nehmen feste Positionen um es herum ein. Ungeklärt, wer den Befehl dazu gibt.',
  'bestiary.code.mud_lamprey': 'EXEMPLAR AQU-03',
  'bestiary.note.mud_lamprey':
    'Räuber der Stillgewässer. Angriffe erfolgen ausschließlich unterhalb der Wasserlinie. Vorbeugende Entwässerung übersteigt das Sektorbudget.',
  'bestiary.code.bellows': 'EXEMPLAR SULF-08',
  'bestiary.note.bellows':
    'Verteilt Gase des Gesteins durch Atmung um. Nutzung als Lüftungsgerät geprüft und zu den Akten gelegt.',
  'bestiary.code.scoriac': 'EXEMPLAR VULC-05',
  'bestiary.note.scoriac':
    'Feuerfester Schlackenpanzer. Nach thermischer Belastung verwundbar — ein Zustand, der es zugleich erheblich schlimmer macht.',
  'bestiary.code.frost_wraith': 'EXEMPLAR GLAC-02',
  'bestiary.note.frost_wraith':
    'Vereisender Nebelkörper, der über und unter der Eisdecke wandert und sich zum Angriff zu einem kristallinen Elementar verdichtet. Bei Kontakt wird dem Chassis Wärme entzogen. Berichte von „Spuk“ beschreiben die diffuse Phase, kein anomales Phänomen.',
  'bestiary.code.sulfur_bomber': 'EXEMPLAR SULF-14',
  'bestiary.note.sulfur_bomber':
    'Mineralische Variante des Vektors FUNG-23. Entzündliche Innenladung. Neutralisierung auf Abstand zu Wärmequellen wird empfohlen — Empfehlung nach dem Vorfall in Stollen 7 bekräftigt.',
  'bestiary.code.undertaker': 'EINHEIT EX-041',
  'bestiary.code.diamandis': 'VERMÖGENSGEGENSTAND DX-001',
  'bestiary.code.white_devourer': 'BEWEGUNGSMUSTER SIL-00',
  'bestiary.code.devourer_brood': 'BEWEGUNGSMUSTER SIL-00b',
  'bestiary.code.archcantor': 'PIEZOELEKTRISCHES ARRANGEMENT PRZ-00',
  'bestiary.note.archcantor':
    'Die Firma klassifiziert es als „natürliches piezoelektrisches Arrangement“. Spätere Gutachten halten fest, dass die Kristalle Frequenzen der Übertragung reproduzieren — und dass manche VOR Eintreffen des Impulses reagieren. Die vier Körper in seiner Umlaufbahn wurden gesondert als Fauna katalogisiert, bis jemand bemerkte, dass sie gemeinsam die Position wechseln.',
  'bestiary.code.sheet_leviathan': 'FEINDLICHES ASSET AQF-00',
  'bestiary.note.sheet_leviathan':
    'Jedes Team maß eine andere Länge. Die einfachste Erklärung ist, dass die Messungen falsch sind. Die zweiteinfachste ist, dass es sich nicht um einen einzelnen Körper handelt.',
  'bestiary.code.lung_matrix': 'LÜFTUNGSSTRUKTUR VNT-00',
  'bestiary.note.lung_matrix':
    'Der Betrieb ging davon aus, die Lüftungsschächte würden die Kreatur nähren. Spätere Untersuchungen deuten auf das Gegenteil hin: Sie ist das Organ, das das gesamte Gestein am Atmen hält. Ob ihre Tötung ein Erfolg ist, steht nicht fest.',
  'bestiary.code.furnace_heart': 'MAGMATISCHE FORMATION FRN-00',
  'bestiary.note.furnace_heart':
    'Die Firma versuchte, die Formation als Energiequelle zu nutzen. Die Aufzeichnungen zeigen: Die Wärme kommt nicht aus dem Magma. Das Magma bleibt WEGEN der Emission flüssig, und die Temperatur reagiert mit Verzögerung auf Schwankungen der Übertragung.',
  'bestiary.code.frost_queen': 'FEINDLICHES ASSET CRP-00',
  'bestiary.note.frost_queen':
    '„Königin“ ist ein Spitzname früherer Teams, keine Klassifikation. Die Aufzeichnungen widersprechen sich zur Identität: Manche legen eine Person nahe; andere, dass sie sich aus allen im Gestein verlorenen Stimmen bildet. Sie reproduziert keine Person — sie reproduziert eine HIERARCHIE.',
  'bestiary.code.magnetarch': 'MAGNETISCHE ANOMALIE MGN-00',
  'bestiary.note.magnetarch':
    'Die Firma erklärt, das Feld sei durch Jahrzehnte des Abbaus entstanden. Aufzeichnungen von vor dem Betrieb zeigen bereits dasselbe magnetische Muster. Vielleicht wählte die Firma diesen Ort, weil das Feld schon vorher Daten durch das Erz übertrug.',
  'bestiary.note.devourer_brood':
    'Dieselbe Signatur wie SIL-00, im Zentimetermaßstab und in Zahl. Sie greifen nicht an, meiden keine Wärme und besitzen nichts, das einem Maul ähnelt. Der Feldbericht fügt die einzige Beobachtung an, die das Team für relevant hielt und die die Firma nirgends zitierte: Sie halten sich an das ausgewachsene Tier. Etwas dort unten kümmert sich um etwas.',
  'bestiary.note.white_devourer':
    'Die geschätzte Masse übersteigt um mehrere Größenordnungen die organische Materie, die das gesamte Gestein tragen könnte. Die Hypothese, die spätere Gutachten formulieren und keines davon unterzeichnet: Der Körper bewegt sich nicht durch das Silikat — das Silikat nimmt vorübergehend die Form des Körpers an.',
  'bestiary.note.diamandis':
    'Wirtschaftlich nicht bergbare mobile Förderanlage. Sie wurde nicht stillgelegt: Sie wurde UMKLASSIFIZIERT — die Firma machte aus einer laufenden Maschine einen Teil der Landkarte, um den Verlust nicht verbuchen zu müssen. Sie gräbt weiter in eine Richtung, die in keinem Vertrag steht.',
  'bestiary.note.undertaker':
    'Schrottbergungseinheit. Führt die Sammelanweisung unverändert aus, ohne zwischen außer Betrieb gesetztem Maschinenpark und Personal im Dienst zu unterscheiden. Umklassifizierung seit der letzten Prüfung ausstehend.',
  'bestiary.code.bishop': 'FEINDLICHES ASSET EQ-09',
  'bestiary.note.bishop':
    'Zeremonielle Figur. Die Behauptung einer religiösen Struktur bleibt unbestätigt.',
  'bestiary.code.guardian': 'TERMINALE ANOMALIE',
  'bestiary.note.guardian':
    'Versperrt den Zugang zum Kern. Keine weitere Eigenschaft ist für diesen Einsatz relevant.',

  // ---------------------------------------------------------------------
  // Entdeckungen (Codex)
  // ---------------------------------------------------------------------
  'discovery.fireSpread.title': 'Feuer geht zu Fuß',
  'discovery.fireSpread.lesson':
    'Bioflüssigkeit trägt die Flamme von Zelle zu Zelle. Eine Lache ist eine Zündschnur.',
  'discovery.gasIgnition.title': 'Das Gas wartet nicht',
  'discovery.gasIgnition.lesson':
    'Schwefelgas entzündet sich beim ersten Kontakt mit Feuer. Ein geschlossener Raum ist eine Kammer.',
  'discovery.dischargePool.title': 'Die ganze Lache ist das Ziel',
  'discovery.dischargePool.lesson':
    'Entladung durchläuft jede verbundene Bioflüssigkeit — und fragt nicht, wer darin steht.',
  'discovery.oreChain.title': 'Erz ist Verkabelung',
  'discovery.oreChain.lesson':
    'Eine Ader trägt die Ladung bis zur anderen Seite der Wand und gibt sie an den Öffnungen ab.',
  'discovery.fragileBreach.title': 'Nicht jede Wand ist eine Wand',
  'discovery.fragileBreach.lesson':
    'Brüchiges Gestein gibt Explosion und Durchschlag nach. Wege bestehen, wo keine zu sein schienen.',
  'discovery.selfHarm.title': 'Die Ader wählt keine Seiten',
  'discovery.selfHarm.lesson':
    'Jede Reaktion trifft Sie gleichermaßen. Der stärkste Aufbau ist der gefährlichste zum Tragen.',
  'discovery.minerFled.title': 'Er lässt die Ladung fallen',
  'discovery.minerFled.lesson':
    'Eine heißgeschossene Waffe, und der Bergmann weicht durch die Stollen zurück — und lässt liegen, was er trug. Ihn einzuholen kostet Zeit.',
  'discovery.minerEnraged.title': 'Hitze überlastet ihn',
  'discovery.minerEnraged.lesson':
    'Glühend heiß ankommen, und sein Schaltkreis versagt: Spitzhacke im Kreis. Rückzug beantwortet das; Umkreisen nicht.',
  'discovery.cargoLost.title': 'Ohne Verwertungswert',
  'discovery.cargoLost.lesson':
    'Die Ladung existiert erst hinter der Plattform. Was in der Ader blieb, war nie Ihres.',
  'discovery.horseFelled.title': 'Die Spur bleibt',
  'discovery.horseFelled.lesson':
    'Der Sturmangriff durchquert den Raum und hinterlässt Feuer auf seinem Weg. Ein Stein im Weg beendet ihn.',
  'discovery.bishopFelled.title': 'Er heilt sich vom Boden',
  'discovery.bishopFelled.lesson':
    'Über lebendem Pilz regeneriert der Bischof mehr, als Sie ihm nehmen. Den Teppich zu erhitzen kappt die Heilung bereits.',
  'discovery.guardianFelled.title': 'Der Hüter fällt',
  'discovery.guardianFelled.lesson':
    'Er versiegelt die Arena bei halber Lebenskraft und ruft Verstärkung. Mit ihm bricht die Belagerung zusammen.',
  'discovery.leylineRouted.title': 'Die Verzweigung gehorcht',
  'discovery.leylineCircuit.title': 'Das ganze Netz, auf einmal',
  'discovery.leylineCircuit.lesson':
    'Eine einzige Kaskade erhellte jeden Abschnitt des Leiters. Das Gestein hörte auf, gegen Sie zu arbeiten — und die Eigenschaft, die es verlor, gehörte auch Ihnen.',
  'discovery.leylineRouted.lesson':
    'Eine geroutete Verzweigung wird zum Relais: Die Entladung läuft hindurch und lädt den Nachbarabschnitt. Das Netz leitet dorthin, wohin Sie es schicken.',
  'discovery.coreTaken.title': 'Der Kern ist nur die Hälfte',
  'discovery.coreTaken.lesson':
    'Ihn zu nehmen verdoppelt das Tempo der Kontamination. Der Ausgang ist die andere Hälfte.',

  // ---------------------------------------------------------------------
  // Schlussbildschirm: Todesursache und Lektion
  // ---------------------------------------------------------------------
  'summary.enemy.elite': 'mutierter {name}',
  'summary.cause.none.headline': 'Sie kamen unversehrt heraus',
  'summary.cause.contact.headline': '{enemy} hat Sie erreicht',
  'summary.cause.contact.lesson':
    'Nahkampf kündigt sich an. Das Geräusch des Ausholens kommt vor dem Schlag.',
  'summary.cause.projectile.headline': '{enemy} hat Sie aus der Ferne getroffen',
  'summary.cause.projectile.rock.lesson':
    'Der Wurf warnt 0,8 s, bevor er losgeht. Sichtlinie brechen oder seitlich ausweichen.',
  'summary.cause.projectile.spit.lesson':
    'Spucke hinterlässt eine Lache aus Bioflüssigkeit. Rückzug in gerader Linie hält Sie in ihrer Bahn.',
  'summary.cause.fire.headline': 'Das Feuer hat Sie verzehrt',
  'summary.cause.fire.lesson':
    'Die Flamme geht zu Fuß durch Bioflüssigkeit und Pilz. Der Boden fängt Feuer, bevor Sie die Flamme sehen.',
  'summary.cause.gas.headline': 'Das Schwefelgas hat Sie aufgelöst',
  'summary.cause.gas.lesson':
    'Gas sammelt sich im geschlossenen Raum. Der kinetische Impuls verstreut die Wolke.',
  'summary.cause.spores.headline': 'Die Sporen haben Sie eingenommen',
  'summary.cause.spores.lesson':
    'Die Wolke des Trägers breitet sich nicht aus, aber sie bleibt. Verlassen Sie sie, statt hindurchzugehen.',
  'summary.cause.contamination.headline': 'Die Luft hat Sie aufgezehrt',
  'summary.cause.contamination.lesson':
    'Die Sättigung hinterlässt keine Wolke, aus der man treten könnte — sie berechnet pro Sekunde, und die Rechnung wächst. Absteigen bereinigt sie; Stillstehen nie.',
  'summary.cause.discharge.self.headline': 'Ihre eigene Entladung hat Sie erwischt',
  'summary.cause.discharge.self.lesson':
    'Leitfähiges durchläuft die ganze Lache. Bevor Sie elektrifizieren, prüfen Sie, worauf Sie stehen.',
  'summary.cause.discharge.world.headline': 'Eine Entladung hat Sie in der Lache erwischt',
  'summary.cause.discharge.world.lesson':
    'Zerbrochener Kristall elektrifiziert jede verbundene Bioflüssigkeit. Eine Lache ist feindliches Terrain.',
  'summary.cause.leviathanDischarge.headline': 'Der Leviathan elektrifizierte die Sintflut',
  'summary.cause.leviathanDischarge.lesson':
    'Vor der Entladung vollständig in eine der großen Luftblasen gelangen.',
  'summary.cause.explosion.self.headline': 'Sie haben sich selbst gesprengt',
  'summary.cause.explosion.self.lesson':
    'Das Explosivmodul scharft sich bei 2,25 Kacheln. Im Korridor kommt es zu Ihnen zurück.',
  'summary.cause.explosion.world.headline': 'Eine Explosion hat Sie erreicht',
  'summary.cause.explosion.world.lesson':
    'Der Träger detoniert beim Tod. Ihn aus der Nähe zu töten heißt, ihn an sich selbst zu zünden.',
  'summary.cause.overheat.headline': 'Ihre Waffe überhitzte an Ihnen',
  'summary.cause.overheat.lesson':
    'Die Hitze steigt mit jedem Schuss, und das Pfeifen steigt mit. Den Abzug loslassen, bevor es kippt.',
  'summary.cause.bleedout.headline': 'Sie sind im Dunkeln erloschen',
  'summary.cause.bleedout.lesson':
    'Kampfunfähig hält 20 s. In der Nähe des Partners fallen, nicht mitten im Raum.',
  'summary.cause.deepWater.headline': 'Das Eis gab unter Ihnen nach',
  'summary.cause.deepWater.lesson':
    'Jede Überquerung sprengt die Platte weiter an: haarrissig, gebrochen, kritisch, Loch. Route wechseln, die kritische Zelle schmelzen oder warten, bis die Königin den Boden wiederherstellt.',
  'summary.cause.unknown.headline': 'Die Ader hat Sie verzehrt',

  // ---------------------------------------------------------------------
  // Schlussbildschirm: Zahlen, Ausgang und nächster Stern
  // ---------------------------------------------------------------------
  'summary.stat.time': 'Zeit',
  'summary.stat.contamination': 'Kontamination',
  'summary.stat.kills': 'Abschüsse',
  'summary.stat.damageDealt': 'Verursachter Schaden',
  'summary.stat.damageTaken': 'Erlittener Schaden',
  'summary.stat.damagePerShot': 'Schaden/Schuss',
  'summary.stat.salvage': 'Salvage',
  'summary.stat.modules': 'Module',
  'summary.stat.ore': 'Erz',
  'summary.stat.none': '—',
  'summary.outcome.core': 'KERN GEBORGEN',
  'summary.outcome.cores': 'KERNE GEBORGEN ×{cores}',
  'summary.outcome.extracted': 'OHNE KERN GEBORGEN',
  'summary.outcome.dead': 'DIE ADER HAT SIE VERZEHRT',
  'summary.reputation.one': 'KONZERNREGISTER: 1 inaktive Einheit zerstört — ohne Verwertungswert.',
  'summary.reputation.other':
    'KONZERNREGISTER: {count} inaktive Einheiten zerstört — ohne Verwertungswert.',
  'summary.nextStar.three': '★★★ erfordert alle Kerne in {target} — Sie brauchten {over} mehr.',
  'summary.nextStar.three.cores':
    '★★★ erfordert alle {total} Kerne des Abstiegs — Sie sind mit {missing} noch in der Ader aufgestiegen.',
  'summary.nextStar.two': '★★ erfordert den Ausstieg mit dem Kern des Hüters.',
  'summary.nextStar.one': '★ erfordert, die Bergung lebend zu erreichen.',
  'summary.seed': 'Seed {seed}',
  'summary.action.restart': 'ERNEUT ABSTEIGEN',
  'summary.action.terminal': 'ZURÜCK ZUM TERMINAL',
  'summary.doc.loss': 'BERICHT ÜBER EINHEITENVERLUST',
  'summary.doc.settlement': 'VERTRAGSABRECHNUNG',
  'summary.doc.cause': 'WAHRSCHEINLICHE URSACHE',
  'summary.doc.recommendation': 'EMPFEHLUNG FÜRS FELD',

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  'banner.expedition.offline': 'AURIX NICHT ERREICHBAR · LOKALE SIMULATION, NICHTS WIRD ERFASST',
  'banner.expedition.tooLong': 'EXPEDITION ÜBERSCHRITT DIE 30-MIN-GRENZE · LADUNG NICHT FREIGEBBAR',
  'banner.expedition.pending': 'ÜBERTRAGUNG UNTERBROCHEN · TELEMETRIE WIRD ERNEUT GESENDET',
  'banner.cargo.cleared': 'LADUNG FREIGEGEBEN · +{ore} ERZ',
  'banner.cargo.cleared.core': 'VERTRAG ERFÜLLT · +{ore} ERZ UND +{cores} KERN',
  'banner.cargo.lost': 'OHNE VERWERTUNGSWERT · {ore} LADUNG IN DER ADER VERLOREN',
  'matrix.title': 'AURIX-GENERATIONSMATRIX',
  'matrix.tab.matrix': 'Matrix',
  'matrix.tab.codex': 'Aurix-Akten',
  'matrix.wallet.ore': 'Erz',
  'matrix.wallet.ore.note': 'freigegeben',
  'matrix.wallet.cores': 'Kerne',
  'matrix.wallet.cores.note': 'geborgen',
  'matrix.generation': 'Generation',
  'matrix.generation.note': 'aktuelles Chassis',
  'matrix.protocols': 'Protokolle',
  'matrix.protocols.note': 'von {total}',
  'matrix.branch.chassis': 'CHASSIS',
  'matrix.branch.chassis.note': 'Überleben',
  'matrix.branch.mobility': 'MOBILITÄT',
  'matrix.branch.mobility.note': 'Bewegung',
  'matrix.branch.reactor': 'REAKTOR',
  'matrix.branch.reactor.note': 'Hitze und Kampf',
  'matrix.branch.survey': 'VERMESSUNG',
  'matrix.branch.survey.note': 'Navigation',
  'matrix.branch.intelligence': 'KI',
  'matrix.branch.intelligence.note': 'Kampfkognition',
  'matrix.node.installed': 'VERBAUT',
  'matrix.node.locked': 'erfordert {id}',
  'matrix.node.missing': 'es fehlen {ore} ⬡ und {cores} ◉',
  'matrix.node.missingOre': 'es fehlen {ore} ⬡',
  'matrix.node.missingCores': 'es fehlen {cores} ◉',
  'matrix.node.sealed': 'PROTOKOLL NICHT SPEZIFIZIERT',
  'matrix.confirm.title': 'PROTOKOLL IN DIE NÄCHSTE GENERATION AUFNEHMEN?',
  'matrix.confirm.cost': 'Kosten: {ore} Erz und {cores} Kern(e).',
  'matrix.confirm.warning': 'Dieser Vorgang kann nicht rückgängig gemacht werden.',
  'matrix.confirm.yes': 'Aufnehmen',
  'matrix.confirm.no': 'Abbrechen',
  'matrix.buying': 'WIRD VERARBEITET…',
  'matrix.inspector.title': 'AUSGEWÄHLTER KNOTEN',
  'matrix.inspector.hint': 'ein Protokoll in der Leiste antippen, um es zu prüfen',
  'matrix.inspector.requires': 'Erfordert',
  'matrix.inspector.cost': 'Kosten',
  'matrix.inspector.balanceAfter': 'Bestand danach',
  'matrix.inspector.sealed':
    'Aurix Dynamics spezifiziert nichts, was noch nicht erreicht wurde. Das vorherige Protokoll aufnehmen, um diese Spezifikation freizuschalten.',
  'matrix.legend':
    '● verbaut · + freischaltbar · ⬡ ungedeckt · ✕ Voraussetzung fehlt · X Abschlussprotokoll des Zweigs',
  'matrix.declassified': 'AKTE FREIGEGEBEN',
  'matrix.generationUp': 'CHASSIS FREIGEGEBEN: {generation}',
  'matrix.offline':
    'Verbindung zu Aurix Dynamics nicht verfügbar. Die Matrix zeigt den letzten bekannten Stand, keine Anschaffung kann aufgenommen werden.',
  'matrix.badUrl':
    'Ungültige Serveradresse. Es wurde keine Anfrage gesendet — das Feld Server im Menü oder den Parameter server= in der URL prüfen.',
  'matrix.refused':
    'Aurix Dynamics hat geantwortet und die Anfrage abgelehnt ({code}). Die Matrix zeigt den letzten bekannten Stand, keine Anschaffung kann aufgenommen werden.',
  'matrix.conflict':
    'DER MATRIXSTAND WURDE IN EINER ANDEREN SITZUNG AKTUALISIERT. DATEN VOR DER AUFNAHME DES PROTOKOLLS PRÜFEN.',
  'matrix.loading': 'Aurix Dynamics wird angefragt…',
  'matrix.policy': 'Was zurückkehrt, wird freigegeben. Was in der Ader bleibt, hat nie existiert.',
  'codex.locked': 'UNZUREICHENDE FREIGABESTUFE',
  'codex.lockedGroup.one': '1 Akte · Stufe {level}',
  'codex.lockedGroup.many': '{count} Akten · Stufe {level}',
  'codex.clearance': 'Stufe {level}',
  'codex.related': 'Verwandte Akten',
  'codex.source': 'Quelle',
  'codex.count': '{unlocked} von {total} Akten',
  'codex.empty': 'Keine Akte über das öffentliche Material hinaus freigegeben.',
  'codex.offlineHint':
    'Akten werden freigegeben, sobald Sie Assets in der Ader begegnen. Ohne Verbindung ist keine einsehbar.',
  'codex.new': 'neu',
  'codex.filter.all': 'Alle',
  'codex.filter.asset': 'Asset: {name}',
  'codex.filter.discovery': 'Entdeckung: {name}',
  'codex.filter.upgrade': 'Protokoll: {id}',
  'codex.contextEmpty': 'Für diesen Kontext ist noch kein Dokument freigegeben.',
  'codex.backToRecords': 'Zurück zum Register',
  'codex.related.aria': 'Verwandte Akte {code} öffnen',
  'records.viewDocs': 'Dokumente ansehen',
  'records.viewDocs.aria': 'Dokumente zu {name} in den Aurix-Akten ansehen',
  'menu.matrix': 'Generationsmatrix',
  'upgrade.CA-01.name': 'Verstärkte Hülle I',
  'upgrade.CA-01.desc': '+4 maximale Lebenspunkte',
  'upgrade.CA-02.name': 'Aufprall-Lager',
  'upgrade.CA-02.desc': 'Betäubungsdauer −10%',
  'upgrade.CA-03.name': 'Verstärkte Hülle II',
  'upgrade.CA-03.desc': '+4 maximale Lebenspunkte',
  'upgrade.CA-04.name': 'Umgebungsdichtung',
  'upgrade.CA-04.desc': 'Umgebungsschaden −8%',
  'upgrade.CA-05.name': 'Verstärkte Hülle III',
  'upgrade.CA-05.desc': '+4 maximale Lebenspunkte',
  'upgrade.CA-X.name': 'Hilfstank',
  'upgrade.CA-X.desc': 'startet mit +1 Entlüftungszelle',
  'upgrade.MV-01.name': 'Servomotoren I',
  'upgrade.MV-01.desc': 'Bewegung +2%',
  'upgrade.MV-02.name': 'Ausweichrelais',
  'upgrade.MV-02.desc': 'Abklingzeit des Ausweichens 18 → 17 Ticks',
  'upgrade.MV-03.name': 'Segmentierte Traktion',
  'upgrade.MV-03.desc': 'Verlangsamung durch Flüssigkeit −8%',
  'upgrade.MV-04.name': 'Gyroskopische Stabilisatoren',
  'upgrade.MV-04.desc':
    'bremst auf Eis in ~1 Kachel aus (statt ~2,5) und findet die Richtung 4× schneller wieder — schützt nicht vor Rissen',
  'upgrade.MV-05.name': 'Servomotoren II',
  'upgrade.MV-05.desc': 'Bewegung +2%',
  'upgrade.MV-X.name': 'Reflex-Firmware',
  'upgrade.MV-X.desc': '+1 Unverwundbarkeitsframe beim Ausweichen',
  'upgrade.RX-01.name': 'Erweiterter Kühlkörper',
  'upgrade.RX-01.desc': 'Wärmeabfuhr +5%',
  'upgrade.RX-02.name': 'Thermosammler',
  'upgrade.RX-02.desc': 'Hitzeobergrenze 100 → 105',
  'upgrade.RX-03.name': 'Reaktionskondensator',
  'upgrade.RX-03.desc': 'Abklingzeit der Fähigkeit −4%',
  'upgrade.RX-04.name': 'Ballistischer Kollimator',
  'upgrade.RX-04.desc': 'Projektile +6% Geschwindigkeit',
  'upgrade.RX-05.name': 'Notfallregler',
  'upgrade.RX-05.desc': 'Überhitzung −4 Ticks und −1 Schaden',
  'upgrade.RX-X.name': 'Kampfgeflecht',
  'upgrade.RX-X.desc': 'Schaden von Bolzen und Fähigkeit +4%',
  'upgrade.SV-01.name': 'Zielbake',
  'upgrade.SV-01.desc': 'Impuls zum Ziel beim Betreten des Sektors',
  'upgrade.SV-02.name': 'Salvage-Spur',
  'upgrade.SV-02.desc': 'zeigt Terminal innerhalb von 18 Kacheln an',
  'upgrade.SV-03.name': 'Mineralspektrometer',
  'upgrade.SV-03.desc': 'Ader pulsiert durch 1 Wand',
  'upgrade.SV-04.name': 'Routenspeicher',
  'upgrade.SV-04.desc': 'die Karte behält besuchte Hallen',
  'upgrade.SV-05.name': 'Rückkehrvektor',
  'upgrade.SV-05.desc': 'Richtung zum Eingang, solange der Kern getragen wird',
  'upgrade.SV-X.name': 'Kontaminationsprognose',
  'upgrade.SV-X.desc': 'Anzeige der nächsten Welle im HUD',
  'upgrade.IA-01.name': 'Signaturklassifikation',
  'upgrade.IA-01.desc': 'Klammern an nahen Feinden; unterscheidet feindlich, passiv und fliehend',
  'upgrade.IA-02.name': 'Absichtserkennung',
  'upgrade.IA-02.desc': 'hebt das Ausholen von Stürmen und Schüssen vor der Ausführung hervor',
  'upgrade.IA-03.name': 'Abfanglösung',
  'upgrade.IA-03.desc': 'Vorhaltemarkierung; die Zielführung bleibt Ihre',
  'upgrade.IA-04.name': 'Vektorkorrektur',
  'upgrade.IA-04.desc': 'knapp vorbeigehende Zielführung rastet am Ziel ein (6°-Kegel)',
  'upgrade.IA-05.name': 'Engagement-Speicher',
  'upgrade.IA-05.desc': 'kurze Haftung am erfassten Ziel; wechselt, wenn es fällt',
  'upgrade.IA-X.name': 'Autonome Direktive',
  'upgrade.IA-X.desc': 'richtungsloses Antippen feuert auf den nächsten gültigen Feind',
  'summary.cargo.lost': 'LADUNG NICHT GEBORGEN: {ore} ⬡ · OHNE VERWERTUNGSWERT',
  'summary.cargo.cleared': 'LADUNG ZUR FREIGABE ÜBERTRAGEN: {ore} ⬡',
  'summary.cargo.core': 'LADUNG UND KERNE ZUR FREIGABE ÜBERTRAGEN: {ore} ⬡ · {cores} ◉',
  'hud.contamination': 'KONTAMINATION',
  'hud.contamination.saturated': 'LUFT GESÄTTIGT — RAUS HIER',
  'hud.cargo': '{count} LADUNG',
  'hud.purgeCells': 'ENTLÜFTUNGSZELLE ×{count}',
  'hud.purge': 'ENTLÜFTUNG',
  'hud.sector': 'SEKTOR {sector}/{total}',
  'hud.objective.descend': 'DEN SCHACHT HINABSTEIGEN',
  'hud.objective.ascend': 'AM EINGANG AUFSTEIGEN — DER SCHACHT IST VERSIEGELT',
  'hud.objective.extract': 'AM EINGANG BERGEN',
  'hud.objective.findCore': 'DEN KERN FINDEN',
  'hud.objective.breakSeal': 'DAS SEKTORSIEGEL HÄLT — SEINEN TRÄGER AUSSCHALTEN',
  'hud.cores': 'KERNE {taken}/{total}',
  // Der Cache-Lokalisator wurde zum 360°-Instrument oben in der Mitte (siehe
  // cache-locator.ts); der Himmelsrichtungstext „TRESOR: OST“ ist mit ihm gestorben.
  'hud.locator.distance': '{distance}m',

  // Schichten und Besetzungen der Ader (die Biomgrammatik des Abstiegs)
  'biome.stratum.basalt': 'BASALTGALERIEN',
  'biome.stratum.prismatic': 'PRISMATISCHE KATHEDRALE',
  'biome.stratum.aquifer': 'SCHWARZER AQUIFER',
  'biome.stratum.sulfur': 'SCHWEFELSPALTE',
  'biome.stratum.furnace': 'ABGRUNDOFEN',
  'biome.stratum.silica': 'SILIKADOLINEN',
  'biome.stratum.glacial': 'GLETSCHERGRUFT',
  'biome.stratum.ferric': 'EISENERZSCHICHT',
  'biome.occupation.mycelial': 'MYZELMATRIX',
  'biome.occupation.aurix': 'AURIX-NARBE',

  // ---------------------------------------------------------------------
  // Zentrale Meldungen des Laufs
  // ---------------------------------------------------------------------
  'toast.ability.assimilated': '{ability} ASSIMILIERT',
  'toast.core.deeper': 'KERN {taken}/{total} GEBORGEN — WEITERER ABSTIEG AUTORISIERT',
  'toast.furnace.cooled': 'DER RAUM KÜHLT AB',
  'toast.magnetarch.attract': 'ANZIEHUNG — BLEIBEN SIE AUSSERHALB DES INNEREN RINGS',
  'toast.magnetarch.repel': 'ABSTOSSUNG — VERLASSEN SIE NICHT DEN ÄUSSEREN RING',
  'toast.magnetarch.invert': 'DAS FELD VERSTUMMT — DIE POLARITÄT KEHRT SICH GLEICH UM',
  'toast.magnetarch.crack': 'MASSE GEBORSTEN — ER WIRD SIE SO EINHOLEN',
  'toast.magnetarch.shatter': 'KERN FREIGELEGT — DAS FELD VERLOR DEN TAKT',
  'toast.core.taken': 'KERN GEBORGEN — KEHREN SIE ZUM EINGANG ZURÜCK!',
  'voice.diamandis.unmapped': 'DIAMANDIS: GEBIET NICHT KARTIERT.',
  'voice.diamandis.standClear': 'DIAMANDIS: ABSTAND HALTEN.',
  'voice.diamandis.armed': 'DIAMANDIS: LADUNG SCHARF.',
  'voice.diamandis.survey': 'DIAMANDIS: VERMESSUNG.',
  'voice.diamandis.obstruction': 'DIAMANDIS: HINDERNIS.',
  'voice.diamandis.fault': 'DIAMANDIS: BETRIEBSSTÖRUNG.',
  'voice.diamandis.lost': 'DIAMANDIS: EINHEIT NICHT BERGBAR.',
  'toast.module.expired': '{module} DEAKTIVIERT',
  'toast.bossModule.exposed': '{module} LÖSTE SICH AUS DER HÜLLE',
  'toast.bossModule.detached': 'TOTENGRÄBER TRÄGT {module} FORT',
  'toast.bossModule.dropped': '{module} GEFALLEN — BERGBAR',
  'toast.bossModule.lost': '{module} VERLOREN',
  'bossModule.drill': 'BOHRER',
  'bossModule.tower': 'TURM',
  'bossModule.scanner': 'LINSE',
  'bossModule.unknown': 'MODUL',
  'toast.cache.opened': 'TRESOR GEBORGEN',
  'toast.purgeCell': '+1 ENTLÜFTUNGSZELLE',
  'toast.purge.used': 'ENTLÜFTUNG — SYSTEME WIEDERHERGESTELLT +{amount}',
  'toast.scan.complete': 'SCAN ABGESCHLOSSEN — TRESOR AUFGEDECKT',
  'toast.overheat': 'ÜBERHITZUNG!',
  'toast.sector.entered': 'SEKTOR {sector} — {biome}',

  // Meldungen der Simulation (kommen als Schlüssel an, nie als Text)
  'sim.partnerRevived': 'Partner wiederbelebt.',
  'sim.reviveBeforeDescend': 'Den abgestürzten Partner wiederbeleben, bevor Sie absteigen.',
  'sim.waitAtShaft': 'Am Schacht auf alle warten, um abzusteigen.',
  'sim.coreTaken':
    'Kern geborgen. Die Ader ist erwacht — steigen Sie zur Oberfläche auf, Sektor für Sektor!',
  'sim.wellSealedReturn':
    'Der Schacht hat sich versiegelt. Der Ausgang liegt dort, wo Sie eingestiegen sind.',
  'sim.reviveBeforeExtract': 'Den abgestürzten Partner wiederbeleben, bevor Sie bergen.',
  'sim.waitAtExit': 'Am Ausgang auf alle warten, um zu bergen.',
  'sim.contaminationRising': 'Die Ader regt sich — die Kontamination steigt.',
  'sim.contaminationCritical':
    'Die Luft ist gesättigt. Jede Sekunde hier unten kostet jetzt Blut — bergen oder absteigen.',
  'sim.coreDropped': 'Der Kern fiel mit seinem Träger.',
  'sim.leylineCircuitClosed':
    'Der Leiter hat sich geschlossen. Das Gestein gibt nach bis zum Abstieg.',
  'sim.arenaSealed': 'Die Ader schließt sich. Weg freikämpfen oder kämpfen.',
  'sim.ceilingCollapsing': 'Die Decke gibt nach. Die Kammer stürzt ein.',
  'sim.delugeRising': 'Der Grundwasserspiegel steigt — der ganze Sektor wird untergehen.',
  'sim.devourerHunger':
    'Der Verschlinger hungert. Die Krater bleiben offen — und das Maul kommt für Sie.',
  'sim.furnaceUnstable': 'Das Konstrukt hat die Form verloren — der Raum ist jetzt Feuer.',
  'sim.furnaceCooled': 'Das Herz ist stehen geblieben. Die Hitze ging mit ihm.',
  'sim.siegeCollapsed': 'Die Belagerung bricht mit dem Hüter zusammen.',
  'sim.descentSealedByBoss':
    'Der Schacht antwortet nicht: Das Siegel dieses Sektors ist noch aktiv.',
  'sim.coreSealedByBoss':
    'Der Sockel verweigert die Kopplung. Das Siegel dieses Sektors ist noch aktiv.',
  'sim.coreTakenDeeper': 'Kern geborgen — weiterer Abstieg autorisiert.',

  // ---------------------------------------------------------------------
  // Modulauswahl
  // ---------------------------------------------------------------------
  'choice.title': 'MODULDATEN GEBORGEN',
  'choice.card': '[{index}] {label}',
  'choice.recharge': 'AUFLADUNG · {lifetime}',
  'choice.volatile': 'FLÜCHTIG',
  // Das Aurix-Bergungsterminal: gleichgültiger Firmenausrüstungstext, kurz genug
  // für den Bildschirm eines liegenden Mobiltelefons.
  'choice.terminal.brand': 'AURIX DYNAMICS // BERGUNG',
  'choice.terminal.unit': 'AD-SLV 04',
  'choice.cacheClass': 'TRESORKLASSE {tier}',
  'choice.integrity': 'DATENINTEGRITÄT {percent}%',
  'choice.select': 'BERGBARE AUSRÜSTUNG WÄHLEN',
  'choice.moduleIndex': 'MODUL 0{index}',
  'choice.moduleTier': 'STUFE {tier}',
  'choice.install': '[{index}] INSTALLIEREN',
  'choice.rechargeAction': '[{index}] AUFLADEN',

  'module.piercing.label': 'PIERCING',
  'module.piercing.description':
    'Durchdringt Ziele, ohne Schaden während des Durchgangs zu wiederholen.',
  'module.piercing.proc': 'DURCHGÄNGE',
  'module.conductive.label': 'CONDUCTIVE',
  'module.conductive.description': 'Entlädt verbundene Bioflüssigkeit und Materialien.',
  'module.conductive.proc': 'ENTLADUNGEN',
  'module.explosive.label': 'EXPLOSIVE',
  'module.explosive.description':
    'Zündet scharfe Treffer in einem Bereich. Auf kurze Distanz gefährlich.',
  'module.explosive.proc': 'EXPLOSIONEN',
  'module.siphon.label': 'SIPHON',
  'module.siphon.description':
    'Stellt 2 HP wieder her, wenn ein nützlicher Treffer abgesaugt wird.',
  'module.siphon.proc': 'ABSAUGUNGEN',
  'module.ricochet.label': 'RICOCHET LENS',
  'module.ricochet.description': 'Lässt den Bolzen einmal an einer festen Oberfläche abprallen.',
  'module.ricochet.proc': 'ABPRALLER',
  'module.return_disc.label': 'RETURN DISC',
  'module.return_disc.description':
    'Verursacht Schaden beim Hinflug und kehrt zurück, den Prospector verfolgend.',
  'module.return_disc.proc': 'RÜCKKEHREN',
  'module.minigun.label': 'DREHKANONE',
  'module.minigun.description':
    'Die Läufe brauchen einen Moment zum Hochlaufen. Danach entlädt sie schwache Geschosse, bis der Lauf blockiert.',
  'module.minigun.proc': 'GESCHOSSE',
  'module.prospect_lance.label': 'PROSPEKTIONSLANZE',
  'module.prospect_lance.description':
    'Belegt den Abzug: ein Schuss nach dem anderen, härter, und drei Felder weiter als der Bolzen. Kein Burst-Fenster — was sie gibt, ist Stetigkeit und Reichweite.',
  'module.prospect_lance.proc': 'SCHÜSSE',
  'module.blunderbuss.label': 'DONNERBÜCHSE',
  'module.blunderbuss.description':
    'Belegt den Abzug: fünf Schrotkugeln in kurzem Fächer. Aufgesetzt treffen alle fünf; auf fünf Feldern stirbt der Schuss in der Luft.',
  'module.blunderbuss.proc': 'LADUNGEN',
  'hud.minigun.spinup': 'LÄUFT AN',
  'hud.minigun.overheated': 'LAUF BLOCKIERT',
  'hud.freeze.label': 'EIS',
  'hud.freeze.critical': 'KRITISCHE UNTERKÜHLUNG',
  'hud.freeze.hold': 'ABZUG HALTEN ZUM AUFWÄRMEN',
  'hint.freeze.partial': 'Die Kälte staut sich an.',
  'hint.freeze.frostbite': 'MOTOREN UND CHASSIS EINGEFROREN — ABZUG HALTEN ZUM AUFWÄRMEN.',
  'toast.frostbite.break': 'KRUSTE GEBROCHEN',
  'module.lifetime.charges': '{count} {proc}',
  'module.lifetime.duration': '{seconds}s',

  'ability.pulse.effect':
    'Stößt Feinde zurück und zerstreut Feuer, Gas und Sporen im Umkreis von {radius} m. Verursacht keinen Schaden.',

  'ability.flamethrower.effect':
    'Strahl von {duration} s, Reichweite {range} m und bis zu {totalDamage} direktem Schaden pro Ziel. Schützt während des Strahls + {guard} s vor Bodenfeuer. Gas und Explosionen bleiben gefährlich.',

  'ability.seeker.effect':
    'Gelenkte Drohne mit {damage} Schaden und Explosion beim Einschlag. Kurvt langsam und kann danebengehen.',

  'ability.arc.effect':
    '{damage} Schaden pro Ziel, bis zu {targets} Feinde. Jeder Sprung erreicht {range} m. Betäubt leitfähige Kreaturen; kommt ohne Lachen aus.',

  'ability.seismic.label': 'SEISMISCHE WELLE',

  'ability.seismic.hint': 'Schaffen Sie Raum, wenn ein Schwarm den Durchgang blockiert.',

  'ability.seismic.origin': 'Die Ader zeichnete Ihre Einschläge und Zerstreuungen auf.',

  'ability.seismic.effect':
    'Verursacht {damage} Schaden, stößt zurück und betäubt für {stun} s im Umkreis von {radius} m. Wände blockieren die Welle.',

  'ability.slipstream.label': 'SPURT',

  'ability.slipstream.hint':
    'Die Richtung folgt dem Steuerknüppel: zum Ausgang oder zum Ziel laufen. Tiefes Wasser hält Sie nicht auf.',

  'ability.slipstream.origin': 'Die Ader zeichnete Ihre Ausweichmanöver auf.',

  'ability.slipstream.effect':
    '+{sprintBoost}% Bewegungsgeschwindigkeit für {sprintTime} s. Läuft über tiefes Wasser und ignoriert die Bremswirkung von Lachen und Eisdecken. Kein Schutz vor Schaden.',

  'ability.vent.label': 'NOTENTLÜFTUNG',

  'ability.vent.hint': 'Kühlen Sie die Waffe und schaffen Sie Raum, um wieder zu feuern.',

  'ability.vent.origin': 'Die Ader zeichnete den Einsatz Ihrer Entlüftungszellen auf.',

  'ability.vent.effect':
    'Setzt die Hitze auf null, entriegelt eine überhitzte Waffe und zerstreut Feuer, Gas und Sporen im Umkreis von {radius} m. Heilt nicht und senkt nicht die globale Kontamination.',

  'ability.cooldown': 'Abklingzeit · {seconds} s',

  'ability.cooldown.after': 'Abklingzeit · {seconds} s nach dem Strahl',

  'ability.unlock.fire': '{count} Verbrennungsvorgänge in diesem Sektor. Erforderlich: {required}.',

  'ability.unlock.current': '{count} Stromvorgänge in diesem Sektor. Erforderlich: {required}.',

  'ability.unlock.blast':
    '{count} ausgelöste Detonationen in diesem Sektor. Erforderlich: {required}.',

  'ability.unlock.kinetic':
    '{count} Einschläge oder Zerstreuungen mit dem Impuls in diesem Sektor. Erforderlich: {required}.',

  'ability.unlock.evasion': '{count} Ausweichmanöver in diesem Sektor. Erforderlich: {required}.',

  'ability.unlock.purge':
    '{count} verbrauchte Entlüftungszellen in diesem Sektor. Erforderlich: {required}.',

  'ability.unlock.first':
    'Garantierte Vorführung beim ersten Abstieg. Keine vorherigen Aktionen erforderlich.',

  'ability.choice.title': 'EIN ECHO STIMMEN',

  'ability.choice.subtitle':
    'Der Schacht schwingt mit dem, was Sie in diesem Sektor getan haben. Ein Echo zu stimmen tauscht Ihre primäre Fähigkeit; wer ohne Wahl absteigt, behält die aktuelle.',

  'ability.choice.why': 'WARUM FREIGESCHALTET',

  'ability.choice.select': '[ {key} ] STIMMEN',

  'ability.choice.keep': '{ability} behalten',

  'ability.choice.current': 'AUSGERÜSTET · {ability}',

  'ability.choice.shared': 'Register von P{slot} · gemeinsame Wahl des Teams',

  'ability.choice.live': 'Die Welt läuft weiter. Vom Schacht entfernen, um zu schließen.',

  'ability.choice.sector': 'RESONANZ / SEKTOR {sector}',

  'resonance.evasion': 'AUSWEICHEN',

  'resonance.purge': 'ENTLÜFTUNG',

  // ---------------------------------------------------------------------
  // Fähigkeiten und Resonanz
  // ---------------------------------------------------------------------
  'ability.pulse.label': 'KINETISCHER IMPULS',
  'ability.pulse.hint':
    'Stößt zurück und zerstreut Wolken. Das ist der Ausweg, wenn etwas schon an Ihnen klebt.',
  'ability.pulse.origin': 'Standardausrüstung der Prospektion.',
  'ability.flamethrower.label': 'THERMOATEM',
  'ability.flamethrower.hint':
    'Fegen Sie einen Korridor, ohne leeren Boden in Brand zu setzen. Brennbares Material brennt weiterhin.',
  'ability.flamethrower.origin': 'Die Ader hörte Sie trocknen und verbrennen, was Sie fanden.',
  'ability.seeker.label': 'SUCHERDROHNE',
  'ability.seeker.hint':
    'Ein Quadrokopter, eine Ladung: Sie jagt und stürzt sich, kurvt langsam. Loslassen, sobald sich das Ziel auf eine Richtung festgelegt hat.',
  'ability.seeker.origin': 'Die Ader hörte Sie detonieren, was Sie fanden.',
  'ability.arc.label': 'LEITFÄHIGER BOGEN',
  'ability.arc.hint':
    'Springt zwischen nahen Körpern und braucht keine Lache. Eine gedrängte Gruppe ist das Ziel.',
  'ability.arc.origin': 'Die Ader hörte Sie elektrifizieren, was Sie fanden.',
  'ability.offer.use': 'BENUTZEN — {ability}',

  'resonance.fire': 'VERBRENNUNG',
  'resonance.current': 'STROM',
  'resonance.blast': 'DETONATION',
  'resonance.kinetic': 'EINSCHLAG',

  // ---------------------------------------------------------------------
  // Echos der Ader (Blackbox)
  // ---------------------------------------------------------------------
  'echo.prompt': 'BENUTZEN — BLACKBOX KOPPELN',
  'leyline.node.route': 'BENUTZEN — VERZWEIGUNG ROUTEN',
  'leyline.source.launch': 'BENUTZEN — SCHALTKREIS AUSLÖSEN',
  'leyline.source.again': 'BENUTZEN — ERNEUT AUSLÖSEN',
  'leyline.node.unroute': 'BENUTZEN — ROUTING AUFHEBEN',
  'echo.designation': 'EINHEIT {serial}',
  'echo.carcass': 'HÜLLE {condition}',
  'echo.aggregate': '{count} EINHEITEN IN DIESER KAMMER VERLOREN — VORHERRSCHENDE URSACHE UNTEN',
  'echo.condition.scorched': 'VERKOHLT',
  'echo.condition.arced': 'DURCHSCHLAGEN',
  'echo.condition.ruptured': 'GEBORSTEN',
  'echo.condition.crushed': 'ZERQUETSCHT',
  'echo.condition.dissolved': 'ZERFRESSEN',
  'echo.condition.overgrown': 'BESIEDELT',
  'echo.condition.intact': 'UNVERSEHRT',
  'echo.tape': 'BAND {time} s',
  'echo.tape.rewind': 'WIRD ZURÜCKGESPULT',

  // ---------------------------------------------------------------------
  // Befehlsleiste (Desktop)
  //
  // KURZE Labels: jedes muss unter eine Tastenkappe passen, die Leiste
  // schrumpft mit dem Fenster. Verb im Infinitiv, wie ein Betriebshandbuch.
  // ---------------------------------------------------------------------
  'controls.move': 'BEWEGEN',
  'controls.fire': 'FEUERN',
  'controls.dodge': 'AUSWEICHEN',
  'controls.ability': 'FÄHIGKEIT',
  'controls.purge': 'ENTLÜFTUNG',
  'controls.interact': 'INTERAGIEREN',
  'controls.menu': 'MENÜ',

  // ---------------------------------------------------------------------
  // Einweisung der Bedienperson (das Willkommensdokument)
  // ---------------------------------------------------------------------
  'menu.induction': 'Einweisung',
  'aurix.doc.induction': 'AD-IND-0001 · Pflichtlektüre',
  'induction.title': 'EINWEISUNG DER BEDIENPERSON',
  'induction.preamble':
    'Willkommen im Prospector-Programm. Dieses Dokument ersetzt die Präsenzschulung, die aus logistischen Gründen eingestellt wurde. Lesen Sie es. Aurix wiederholt keine Anweisung im Feld.',
  'induction.asset.code': '§1 · ASSET',
  'induction.asset.title': 'SIE STEIGEN NICHT AB',
  'induction.asset.body':
    'Ein Prospector-Chassis steigt ab, von Ihnen ferngesteuert. Das Chassis ist Verbrauchsmaterial, und die Firma verbucht seinen Verlust als erwartete Kosten. Der VERTRAG ist kein Verbrauchsgut: Jede verlorene Einheit kehrt als Eintrag zurück, und der Eintrag autorisiert die nächste zu einem tieferen Abstieg.',
  'induction.contract.code': '§2 · VERTRAG',
  'induction.contract.title': 'ABSTEIGEN. BERGEN. HERAUSHOLEN.',
  'induction.contract.body':
    'Jeder Sektor hat einen Schacht zum nächsten. Wo ein Kern liegt, nehmen Sie ihn. Die Ladung wird erst bei der BERGUNG freigegeben, zurück am Sektoreingang — Erz noch im Chassis ist verlorenes Erz. Absteigen ist freiwillig; zurückzukehren ist, was sich auszahlt.',
  'induction.vein.code': '§3 · UMGEBUNG',
  'induction.vein.title': 'DIE ADER REAGIERT',
  'induction.vein.body':
    'Nichts dort ist Kulisse. Brüchiges Gestein gibt dem Schuss nach, Feuer geht zu Fuß durch alles Trockene, Strom durchquert jede Lache, und Säure zersetzt, was sie berührt — Ihr Chassis eingeschlossen. Aurix führt keine Dokumentation darüber, was geschieht, wenn zwei davon aufeinandertreffen. Vorsicht wird empfohlen. Es wird festgehalten, dass Vorsicht selten Kerne birgt.',
  'induction.heat.code': '§4 · BEWAFFNUNG',
  'induction.heat.title': 'DER LAUF HAT EIN LIMIT',
  'induction.heat.body':
    'Die Waffe erhitzt sich mit jedem Schuss und blockiert bei Sättigung. Der schmale Balken unter der Lebensanzeige ist die Hitze, und die Markierung darauf ist der Punkt, an dem der akustische Warnton einsetzt. Ein festgehaltener Abzug ist die häufigste Ursache für Einheitenverlust in diesem Programm.',
  'induction.echo.code': '§5 · SCHACHT',
  'induction.echo.title': 'DIE ADER HÖRT ZU',
  'induction.echo.body':
    'Schächte bieten Fähigkeiten an, und das Angebot ist kein Losentscheid: Es antwortet auf das, was Sie bisher getan haben. Was Sie verbrannt, elektrifiziert oder gesprengt haben, kehrt als Ausrüstung zurück. Eine ausgerüstete Fähigkeit hat eine Abklingzeit — die Befehlsleiste am unteren Rand zeigt an, wann sie zurückkehrt.',
  'induction.archive.code': '§6 · ARCHIV',
  'induction.archive.title': 'DIE MATRIX LESEN',
  'induction.archive.body':
    'Jede geborgene Einheit speist die GENERATIONSMATRIX. Dort liegen die Aurix-Akten — was die Firma über jedes Asset weiß, dem Sie dort unten begegnet sind, freigegeben, sobald Sie ihm begegnen — sowie die Hardware-Protokolle, die die nächste Generation autorisieren, tiefer abzusteigen, mehr auszuhalten und besser zu zielen. Was Sie ungelesen lassen, widerfährt Ihnen weiterhin.',
  'induction.controls.title': 'BEFEHLSSCHEMA · TISCHTERMINAL',
  'induction.controls.note':
    'Auf einem Touchgerät ist das Schema anders: Der linke Stick bewegt, der rechte zielt und feuert, und die Tasten darüber wiederholen diese Liste.',
  'induction.begin': 'ABSTIEG AUTORISIEREN',
  'induction.training': 'TRAININGSEINSATZ',

  // ---------------------------------------------------------------------
  // Trainingseinsatz (die Übung des ersten Abstiegs)
  // ---------------------------------------------------------------------
  'menu.training': 'Trainingseinsatz',
  'aurix.doc.training': 'FORMULAR AD-TRN-01 · Einweisungsübung',
  // DER EINSATZ HAT ZWEI SEKTOREN, und die Nummerierung der Übungen läuft
  // durch beide hindurch: Die spielende Person sieht nicht „Sektor 1“ und
  // „Sektor 2“, sondern eine Liste, die auf der anderen Seite des Schachts
  // weitergeht. Derselbe Kniff wie im Rundschreiben — die Firma nummeriert
  // Verfahren, keine Orte.
  'training.step.move': 'Übung 1 — BEWEGEN: W A S D. Durch die Galerie vorrücken.',
  'training.step.move.touch': 'Übung 1 — BEWEGEN: linker Stick. Durch die Galerie vorrücken.',
  'training.step.mine':
    'Übung 2 — ABBAUEN: Die Ader in den Wänden ist Ladung. Darauf feuern, bis drei Splitter abgehen.',
  'training.step.mine.touch':
    'Übung 2 — ABBAUEN: Die Ader in den Wänden ist Ladung. Mit dem rechten Stick darauf zielen, bis drei Splitter abgehen.',
  'training.step.clear':
    'Übung 3 — FEUER: die linke Maustaste halten und mit dem Cursor zielen. Beide Exemplare neutralisieren.',
  'training.step.clear.touch':
    'Übung 3 — FEUER: der rechte Stick zielt und feuert. Beide Exemplare neutralisieren.',
  'training.step.dash':
    'Übung 4 — AUSWEICHEN: LEERTASTE. Einen Ausweichsprung zwischen den Pfeilern ausführen.',
  'training.step.dash.touch':
    'Übung 4 — AUSWEICHEN: Ausweichtaste. Einen Ausweichsprung zwischen den Pfeilern ausführen.',
  'training.step.terminal':
    'Übung 5 — TERMINAL: sich dem Scan-Terminal nähern und mit E aktivieren. Es durchsucht den Sektor nach dem Tresor — und verrät Sie dabei.',
  'training.step.terminal.touch':
    'Übung 5 — TERMINAL: sich dem Scan-Terminal nähern und mit der Interaktionstaste aktivieren. Es durchsucht den Sektor nach dem Tresor — und verrät Sie dabei.',
  'training.step.hold':
    'Übung 6 — HALTEN: der Alarm hat Verstärkung gerufen. Der Scan stoppt nicht; die Bucht halten, bis er endet.',
  'training.step.hold.touch':
    'Übung 6 — HALTEN: der Alarm hat Verstärkung gerufen. Der Scan stoppt nicht; die Bucht halten, bis er endet.',
  'training.step.cache':
    'Übung 7 — LOKALISATOR: der Tresor ist aufgedeckt. Der Ring oben am Bildschirm zeigt seine Richtung auf dem Bildschirm und die Entfernung — der Markierung folgen und den Tresor mit E öffnen.',
  'training.step.cache.touch':
    'Übung 7 — LOKALISATOR: der Tresor ist aufgedeckt. Der Ring oben am Bildschirm zeigt seine Richtung auf dem Bildschirm und die Entfernung — der Markierung folgen und den Tresor mit der Interaktionstaste öffnen.',
  'training.step.module':
    'Übung 8 — MODUL: der Tresor zahlte in Hardware aus. Eine der beiden Karten wählen — das Modul gilt für diesen Abstieg.',
  'training.step.module.touch':
    'Übung 8 — MODUL: der Tresor zahlte in Hardware aus. Eine der beiden Karten antippen — das Modul gilt für diesen Abstieg.',
  'training.step.echo':
    'Übung 9 — DAS ECHO: der Schacht schwingt mit dem, was Sie hier getan haben. Nähern Sie sich und stimmen Sie ein Echo — es ERSETZT Ihre Fähigkeit. Wer ohne Wahl absteigt, behält die aktuelle.',
  'training.step.echo.touch':
    'Übung 9 — DAS ECHO: der Schacht schwingt mit dem, was Sie hier getan haben. Nähern Sie sich und stimmen Sie ein Echo — es ERSETZT Ihre Fähigkeit. Wer ohne Wahl absteigt, behält die aktuelle.',
  'training.step.descend':
    'Übung 10 — ABSTEIGEN: am Schacht mit E interagieren. Die Kontamination lässt beim Abstieg nach; der Rückweg führt hier entlang.',
  'training.step.descend.touch':
    'Übung 10 — ABSTEIGEN: am Schacht mit der Interaktionstaste interagieren. Die Kontamination lässt beim Abstieg nach; der Rückweg führt hier entlang.',
  'training.step.ability':
    'Übung 11 — FÄHIGKEIT: Q löst das ausgerüstete Echo aus. Es hat eine Abklingzeit — die Befehlsleiste unten zeigt an, wann es zurückkehrt.',
  'training.step.ability.touch':
    'Übung 11 — FÄHIGKEIT: die Fähigkeitstaste löst das ausgerüstete Echo aus. Es hat eine Abklingzeit — der Ring auf der Taste zeigt an, wann es zurückkehrt.',
  'training.step.breach':
    'Übung 12 — DURCHBRUCH: das helle Gestein voraus ist brüchig und gibt dem Schuss nach. Nicht jede Wand ist eine Wand — einen Weg freischießen.',
  'training.step.breach.touch':
    'Übung 12 — DURCHBRUCH: das helle Gestein voraus ist brüchig und gibt dem Schuss nach. Nicht jede Wand ist eine Wand — einen Weg freischießen.',
  'training.step.core': 'Übung 13 — DER KERN: sich dem Sockel nähern und mit E interagieren.',
  'training.step.core.touch':
    'Übung 13 — DER KERN: sich dem Sockel nähern und die Interaktionstaste benutzen.',
  'training.step.ascend':
    'Übung 14 — AUFSTEIGEN: mit dem Kern in der Hand hat sich der Schacht versiegelt. Der Ausgang liegt dort, wo Sie eingestiegen sind — zum Eingang dieses Sektors zurückkehren und mit E interagieren.',
  'training.step.ascend.touch':
    'Übung 14 — AUFSTEIGEN: mit dem Kern in der Hand hat sich der Schacht versiegelt. Der Ausgang liegt dort, wo Sie eingestiegen sind — zum Eingang dieses Sektors zurückkehren und die Interaktionstaste benutzen.',
  'training.step.extract':
    'Letzte Übung — BERGUNG: zur Einstiegsplattform zurückkehren und mit E interagieren. Ladung zählt nur außerhalb der Ader.',
  'training.step.extract.touch':
    'Letzte Übung — BERGUNG: zur Einstiegsplattform zurückkehren und die Interaktionstaste benutzen. Ladung zählt nur außerhalb der Ader.',
  'training.done.move': '✓ Fortbewegung erfasst',
  'training.done.mine': '✓ Splitter in der Ladung',
  'training.done.clear': '✓ Neutralisierung erfasst',
  'training.done.dash': '✓ Ausweichmanöver erfasst',
  'training.done.hold': '✓ Scan abgeschlossen — Tresor geortet',
  'training.done.module': '✓ Hardware angebracht',
  'training.done.echo': '✓ Echo gestimmt',
  'training.done.ability': '✓ Echo ausgelöst',
  'training.done.breach': '✓ Durchgang geöffnet',
  'training.done.ascend': '✓ Sektor bezwungen — es fehlt nur die Plattform',
  'training.tip.heat':
    'Der Lauf ist gesättigt. Den Abzug loslassen und die Hitze abfallen lassen — Tempo ist Teil der Bewaffnung.',
  'training.tip.purge':
    'Der Tresor gab auch eine ENTLÜFTUNGSZELLE aus. F verbraucht eine: setzt die Hitze auf null, löst den blockierten Lauf und zerstreut Feuer, Gas und Sporen um Sie herum. Sie steigen mit wenigen davon ab.',
  'training.tip.contamination':
    'Der KONTAMINATIONS-Balken oben steigt von selbst mit der Zeit in der Ader. Absteigen lindert; aufsteigen kostet. Wenn er sättigt, beißt die Luft — und die einzige Antwort ist, bereits auf dem Weg nach draußen zu sein.',
  'training.tip.archive':
    'ENTDECKUNG ERFASST. Was Ihnen widerfährt, wird zur Akte: das REGISTER hält die Tatsache fest, die AURIX-AKTEN erklären, was die Firma darüber weiß. Beide liegen im Terminal, am Ende der Übung.',
  'training.complete.title': 'ÜBUNG FREIGEGEBEN',
  'training.complete.body':
    'Trainingsprotokoll archiviert. Keine Ladung wurde angerechnet — Training zahlt sich nicht aus. Die Ader dort unten schon.',
  'training.complete.archive.title': 'WEITERFÜHRENDE LEKTÜRE',
  'training.complete.archive.body':
    'Jedes Asset, dem Sie begegnen, und jede Reaktion, die Sie auslösen, eröffnet eine Akte. Das REGISTER listet, was Ihnen bereits widerfahren ist; darin führt „Dokumente ansehen“ zu den AURIX-AKTEN, wo die Firma aufbewahrt, was sie weiß — und was sie lieber nicht aufgeschrieben hätte. Ein ungelesenes Dokument widerfährt Ihnen weiterhin.',
  'training.complete.archive': 'DIE AKTEN ÖFFNEN',
  'training.complete.descend': 'ABSTIEG AUTORISIEREN',
  'training.complete.terminal': 'ZURÜCK ZUM TERMINAL',
  'training.incomplete.title': 'ÜBUNG NICHT FREIGEGEBEN',
  'training.incomplete.body':
    'Bergung mit leerer Ladung. Der Übungsvertrag verlangt den Kern auf der Plattform — die Firma erfasst den Ausstieg, gibt ihn aber nicht frei. Vorgang wiederholen.',
  'training.incomplete.retry': 'ÜBUNG WIEDERHOLEN',
  'training.restart.sector': 'EINHEIT VERLOREN — Ersatzchassis am Anfang dieses Sektors.',
  'training.restart.return':
    'EINHEIT VERLOREN — Ersatzchassis am Schacht, mit Kern. Der Rückweg besteht weiter.',

  // ---------------------------------------------------------------------
  // Freigeschaltete Akte (der Hinweis, nicht das Panel)
  // ---------------------------------------------------------------------
  'lore.toast.unlocked': 'AKTE FREIGEGEBEN',
  'lore.toast.debut': 'ERSTE AKTE',
  'lore.toast.open': 'Dokument öffnen',
} as const;

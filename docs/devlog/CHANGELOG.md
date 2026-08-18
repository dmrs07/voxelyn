# Voxelyn Survival — changelog

What changed between the builds published on itch.io, in the voice the player reads.

Written in English on purpose, unlike most docs here: this is the one file whose
audience is the person downloading the game, not the person writing it. It is
also the source for the itch.io devlog post of each build.

Different from `entries/`, which tells how the work was done, one post per PR.
Here only what **changes the game** gets in. A PR that touches documentation, the
devlog pipeline, or tooling does not appear — if the player cannot feel it, it is
not a changelog entry.

Each section is a build. The header carries the date, the commit the zip was cut
from, and the simulation and protocol versions, because those are what decide
whether an older client can still talk to the server.

---

## Build 2026-08-17 — `81e744c`

`SIMULATION` 40 → 41 · `PROTOCOL` 24 → 25 · `CONTENT` 24 (unchanged)

> **Online co-op:** the protocol changed. Tabs left open since the previous build
> have to reload before joining a room — the old client stops with a version
> mismatch notice instead of silently desyncing.

### Contamination stopped being decoration

The contamination meter climbed to 100% and, on arrival, did nothing. The last
scheduled wave lived at 85%, so filling the bar left you in the **safest** state
of the run: every consequence it had was already behind you.

The top of the bar is a deadline now.

- **Saturation (100%): the air charges you.** One hit per second, escalating for
  as long as you stay. Standing still at full health: about a quarter of your HP
  in the first ten seconds, dead near twenty. Enough to run for the extraction.
  Not enough to stay, and nowhere near enough to fight.
- **The late surge no longer ends.** Past 85%, enemy waves return every 35s
  instead of never. The most contaminated stretch of a sector used to be the
  emptiest one.
- **Descending is the relief.** Carryover drops contamination below the
  threshold and the saturation clocks reset with it — going deeper is the only
  thing that clears the air.
- **The environmental sealing you buy works against it.** Saturation counts as
  environmental damage, so the upgrade you paid for protects you from the air and
  not just from smoke.
- **Death by saturation has its own screen.** "You stepped into a cloud" and "you
  stayed too long" are different lessons.
- **Downed co-op players do not pay twice.** Anyone down is already on the
  bleedout clock; the rescue window stays intact.

**HUD:** the unlabelled three-pixel strip became a real readout — it thickens
with the danger, walks acid → fire → blood, shows the percentage from the first
threshold onward, and at saturation swaps the number for the instruction
`AIR SATURATED — GET OUT`, pulsing in time with the damage.

### The leylines became an optional puzzle

The energy lines in the walls did nothing without the `conductive` module — one
of two options in a tier-2 vault. Without it, a run was indistinguishable from
one with no leylines at all. They are now the **sector's circuit**.

- **The wellspring.** The network junction nearest the entrance accepts `USE` and
  launches a cascade through the whole network. No item, no unlock, available in
  the first minute of any run.
- **Closing the circuit** means lighting **every** segment in a single cascade —
  which requires opening each junction, from the entrance to the deep band.
- **The short.** A segment with 6 or more crystal or ore cells touching it bleeds
  the charge and refuses to light. The fix is the game's central verb: break the
  crystal, spend the vein. The Prismatic Cathedral is almost always the problem;
  the basalt of sector one almost never is.
- **The prize: subverting the stratum.** Closing the circuit **switches off the
  property that gives the stratum its identity** until your next descent. The
  Aquifer's sheet stops conducting; the Crypt's ice stops melting; the Cathedral's
  crystal goes dull and the Archcantor loses its ammunition; the Rift's vents lock
  shut; the Furnace's embers give heat dissipation back; loose silica turns to
  glass and the White Devourer loses the floor it climbs.
- **And it cuts both ways.** You do not gain a power, you switch off a rule — and
  the rule was serving both of you. No conductive sheet means you also lose
  electrifying pools; no crystal means you lose your free source of `current`.
- **The `conductive` module stopped being a gate and became a shortcut.** An
  `energy` shot still lights whichever segment it hits, which is how you reach a
  stray branch — at the cost of one charge per segment.

**Honest warnings:** roughly 19% of sectors have no circuit at all (the network
came out too short), and sector one is basalt — a circuit with no obstacle and no
prize, deliberately, because that is where the language gets taught. The Ferric
stratum has no leylines and will not get them: there, the connected wall already
**is** the wiring.

### Nothing else changed

The other two PRs in this window (#146, #147) touched only the devlog pipeline
and documentation. Not a line of simulation, render, or content.

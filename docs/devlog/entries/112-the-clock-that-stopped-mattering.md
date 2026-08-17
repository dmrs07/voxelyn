# 112 - The clock that stopped mattering

**2026-08-17** · branch `claude/voxelyn-itch-promotion-sc0vex`

Somebody asked me a question about the game's marketing copy this week and it took the
whole mechanic down with it. The question was four words long:

> I never saw a canary.

I had been describing contamination, in public, as the thing that makes the descent
urgent. Cages of canaries strung through the mine, all going silent on the same tick when
the number crosses the line. It is a good bit. It is in the code. It is even wired to the
authoritative value rather than a visual approximation, which I was quite pleased about.

It is also almost never on screen. `canary_cage` lives in the Aurix occupation kit, so it
only exists in sectors the mining company itself occupied — guaranteed only on the
industrial lineage, and otherwise sitting behind a 15% intrusion roll. Even in a sector
that has them, the cage competes with crates and struts for a capped decoration budget.
Most runs never spawn one. I had built a marketing pitch on a prop with a 15% attendance
record.

So I went to look at the mechanic the prop was supposedly advertising, expecting to find
it fine and the readout lacking. It was not fine.

## Saturation was the safest state in the game

Here is what contamination did, in full, before this week.

It rose on a timer, faster the deeper you were and twice as fast once you had a Core. At
0.35, 0.6 and 0.85 it spawned a small wave of enemies — two, then three, then four,
one-shot each. It made sulfur vents breathe faster. It killed the canaries nobody saw. And
at 1.0 it hit `Math.min(1, ...)` and stopped.

Stopped. Not "plateaued at a high difficulty" — stopped. The last authored threshold was
0.85, so once you crossed it, the ladder was spent and nothing else was scheduled, ever.
The clock kept turning and the world had nothing left to do about it.

Read that back as a player experience. The most contaminated stretch of the run, the part
the fiction insists is lethal, was the emptiest part of the run. Nine extra enemies across
an entire descent, in a game where you fight dozens, and then permanent silence. Maxing
out the danger meter put you in the single safest state the simulation could produce,
because every consequence it had was already behind you.

That is not a difficulty curve. That is a progress bar that fills up and then congratulates
you by leaving.

And the readout matched. Contamination rendered as a three-pixel strip across the top of
the screen, no number, no label, in a palette colour it shares with other things. Perfectly
legible if you already knew what it was. Invisible if you did not, which is everyone.

I had written a whole store page about a deadline that did not exist, illustrated with a
bird nobody meets.

## Three regimes instead of one and a half

The fix follows a rule this codebase repeats everywhere, and I did not want to be the one
who broke it: **no mechanic invents a new system.** The signature bestiary operates levers
its stratum already has. The bosses do too. Contamination gets the same discipline — it
now uses `damageEntity`, which already carries every environmental hazard in the game, and
the same wave spawner the ladder was already calling.

`stepContamination` now has three regimes, in order of severity.

**The ladder** is unchanged. 0.35, 0.6, 0.85, one wave each, one time each.

**The late surge** is new and small. Past the last rung, waves start repeating every 35
seconds instead of never. The interval is deliberately long — this is a charge for
loitering, not a siege. It exists purely so that crossing 0.85 stops being the moment
pressure ends.

**Saturation** is the real change. At 1.0 the air stops warning you and starts charging.
One hit per second, escalating, until you leave, descend, or die.

It is one pulse per second rather than a per-tick drain on purpose. Saturation needs to be
*read*, not merely suffered — a beat you can hear and count while you run is a beat you
can make decisions against. A silent 0.1-per-tick bleed removes exactly the same amount of
health and teaches nothing.

## The number I actually care about

The tuning question was never "how much damage". It was: does this delete the escape
hatch?

Because abandoning a contract at any depth has always been a legitimate way to play, and
devlog 063 already committed to protecting that when the Core became a halfway point
instead of a finish line. A saturation that kills instantly would quietly delete the run
for the exit, which is the interesting part.

So the curve is gentle early and cruel late. Measured against a stationary player at full
health, air that never clears:

| Time saturated | HP remaining |
| --- | --- |
| 5 s | 92 |
| 10 s | 74 |
| 15 s | 47 |
| 20 s | 12 |
| 21.1 s | dead |

Ten seconds costs about a quarter of your health. That is enough to hurt, and nowhere near
enough to kill somebody who moved when the screen told them to. Twenty-one seconds of
standing still is death. You can run. You cannot stay, and you certainly cannot fight.

Two details worth the words. The escalation is measured from *when* the air saturated, not
by counting pulses, so a swallowed tick or a paused frame never hands back a discount — the
air does not forget how long you were in it. And the announcement tick deliberately does no
damage: you get one full pulse to read the screen and pick a direction before you start
paying for standing in it.

## The parts that were easy to get wrong

**Descending has to be relief.** Carryover already drops contamination to 60% on a new
sector, which puts you under the threshold every time — so the saturation clocks reset with
it. Not resetting them would have had a fresh sector inheriting the escalation of air it
does not have. Going deeper is now the one reliable way to clear saturation, which is a
pleasing thing for a game about descending to be true.

**Downed players do not pay.** In co-op a downed teammate is already on the bleedout clock,
and stacking a second timer would turn every late knockdown into a death with no rescue
window — the exact opposite of what saturation should teach, which is to run together.

**It counts as environmental damage.** This one nearly slipped past. There is a purchasable
upgrade that scales environmental damage down, and `isEnvironmentalCause` gates it by a
closed list of causes. Saturation is the purest case in that list — there is no cloud to
step out of, the "ground" charging you for presence is the entire sector — but a new cause
is not on a closed list until somebody puts it there. Left out, the sealing you bought
would have worked against smoke and not against air.

**It gets its own death cause.** It would have been half a line cheaper to reuse `gas`.
But the death screen has exactly one job, and these are two different lessons: `gas` means
"you stepped in a cloud" and teaches you to dodge; saturation means "you stayed too long"
and teaches you to leave. Two deaths sharing one sentence would have deleted the only thing
the death screen does.

## And the readout

The three-pixel strip now grows with the danger — three pixels, then five past the last
rung, then six and pulsing at saturation — and walks acid → fire → blood on the way up. The
percentage appears from the first threshold onward, and only from there: below it the number
changes no decision you can make, and a HUD that shouts constantly trains you not to look.
At saturation the label stops being a number and becomes an instruction.

The pulse is driven by the simulation tick rather than wall clock, so the flash and the hit
are the same event rather than two things that happen to be near each other.

The canaries are all still there, doing what they always did. They are just no longer the
only witness to a number that can now kill you, and I have stopped telling people they are
the headline feature of a game most of them will play without ever meeting one.

## What this cost

Twelve tests, one new file, and they are mostly about the promises rather than the numbers:
that saturating costs, that the bill grows, that it kills the player who ignores it, that
ten seconds still leaves you alive, that descending clears it, that downed players are
exempt, that the surge keeps coming, and that none of it broke determinism. The tuning
constants can move. What those tests hold still is the shape.

646 sim tests and 946 client tests pass. The only number I would still like to argue about
is 35 seconds, and the only way to settle it is to have somebody who is not me get caught
at 1.0 with the exit two rooms away.

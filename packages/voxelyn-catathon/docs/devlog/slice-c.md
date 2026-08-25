# CATATHON Devlog — Slice C: The Reason To Come Back

*Two commits (sim, then client) · 64 tests · the slice where a run became
an edition, and an edition became a career.*

## The shape of the problem

Slices A and B gave us a run worth playing and runs worth varying. What was
missing is the oldest roguelite question: **why do I press "play again"?**
The design brief's answer was a list — career progression, gear, contextual
events, achievements, a daily seed — and its trap was equally old: every
one of those systems loves to leak into the simulation and ruin the purity
that makes replays and tests possible.

So the founding decision of Slice C was a boundary line. **Everything that
persists between runs lives in the client** (a `career.ts` module over
`localStorage`); **everything that happens inside a run lives in the sim**,
pure as ever. The sim's only new output is a number: the **prize**, in
bottle caps, computed deterministically at the finale. The career reads it,
does its accounting, and the replay identity never changed:
`(seed, hired team, commands)` — now with gear as part of the hire.

## Three ways in

The title screen now offers three doors:

- **Career** — your wallet persists. Each edition's prize funds the next
  one's recruitment. There's a floor at the base budget: accumulating is
  *upward* of the minimum, never below it, because an unwinnable run isn't
  a roguelite, it's a debt spiral with cats.
- **Quick run** — fixed budget, nothing persists but achievements.
- **Daily** — the seed is derived from the UTC date, so everyone on Earth
  gets the same six candidates, the same project, the same booth. Comparing
  scores becomes a conversation. (`dailySeed('2026-08-25')` is a pure
  function; the test suite proves it changes with the date.)

## Gear with opinions

The recruiter's email grew a tiny shop: **three items per edition** out of
a catalog of six, paid from the same wallet as the contracts — so a senior
hire and a mechanical keyboard genuinely compete. Four passives fold
straight into the booth's modifier block at creation time (the sim never
asks "do I own the cushion?" mid-tick). The two consumables are the fun
ones, because their trade-off is written on the object:

- **Catnip** (2 doses): instant morale, minus some stress — and a 40%
  chance of immediate zoomies. It arms like the treat button: the next tap
  on a cat doses them. Arming one disarms the other; one hand, one mode.
- **Laser pointer** (1 use): calms the *entire* team… and interrupts the
  entire team, because it's a laser and they are cats. Everyone drops what
  they're doing and chases the dot for 2.5 seconds. Using it while four
  cats are mid-feature is a decision you'll feel.

## The pavilion interrupts

Two **social events** per run, scheduled from the seed with the same
pure-jitter pattern as the hairballs (replays never diverge). A modal opens
with a visible countdown bar and two choices whose consequences are written
on the buttons: a feline influencer with a rolling camera (pitch hype vs.
everyone's stress), a rival recruiter circling your star (prize money vs.
team morale), a free workshop in the hall (+8% permanent for your most
rested cat, who spends fifteen seconds away chasing knowledge). Option B
is always the safe one — and it's the automatic default when the window
expires. The game never blackmails you into watching; it just pays
attention back to those who pay attention.

The competent test bot ignores every event and still reaches the podium —
that's by design, and it's asserted. The defaults must be survivable.

## Achievements, computed honestly

Eight, each checkable mechanically from the final state — an achievement
that needs interpretation is decoration. *Zero Bugs, Allegedly. Ship It*
(a feature shipped in the last minute of the 48h). *Scope Is a Social
Construct* (cut four tasks and still reach the podium). *No Touchy* (win
without a single pet — the pet-session counter lives in the hashed state).
*One Orange Brain Cell* (an all-cowboy team, which recruitment makes
possible and inadvisable). *Standing Ovation*, *Demo Gods*, *Grand Prize*.
They persist across all modes and show up as chips on the result screen.

## What the gates caught this time

1. The catnip button shipped reusing the treat's fish icon — and the
   **distinct-icons smoke gate** (a law since the Iliad's illegible `»`/`≫`
   buttons) rejected the build before any human saw two fish. Catnip got a
   leaf; the laser got a beam.
2. The consumables appeared in the action bar with **×0** — author
   `display: inline-flex` defeating the `hidden` attribute, the *exact*
   trap that hid the entire HUD in this game's first smoke run. Vaccinated
   for every soft button now (`.soft-btn[hidden] { display: none }`), with
   a ghost-button gate counting visible buttons against owned doses.

Both are the same lesson from two directions: pixels lie, so the smoke
test looks at what a player would actually see.

## Numbers

- 55 → **64 tests**: the shop is deterministic per seed; catnip spends
  doses and runs out; the laser proves its own trade-off (everyone calmer,
  everyone zooming); the social window opens on schedule and expires into
  the safe choice; the workshop boost lands on the most rested; the prize
  adds negotiated bonuses; the daily seed changes with the day.
- The smoke run now: recruits, **buys gear**, decides a social event with
  a finger tap (verifying +8% in the sim state), sees the prize on the
  result screen, and finds the career persisted in `localStorage` —
  wallet floored, run counted.

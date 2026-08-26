# CATATHON Devlog — Slice E: The Season, or Nothing Is Hidden Anymore

*Sim first, then client · 120 tests · the slice where the journey became
visible.*

## The diagnosis

The brief for this slice started from an uncomfortable truth: the game did
not lack systems. Career, wallet, reputation, a persistent rival, alumni,
gear, social events, a daily seed and eight achievements were all live —
and none of it added up to a visible journey. You finished a run and could
not see what you had built, what you had unlocked, or what the next
challenge was. The direction was named in one line: **turn a repeatable
hackathon into a season of hackathons** — Catathon Circuit + Stretch
Sprint, held up by a Career Hub.

## Stretch Sprint: the end of dead time

The old failure mode: a good team finishes the core early and the last
stretch of the run is joyless micromanagement. The fix is not a bonus bar
to keep cats busy — it is a *decision*.

When every core task is shipped or cut (and at least one shipped — cutting
everything is not an MVP), the sim fires `mvp-ready` and the Sprint panel
opens with two doors:

- **Freeze the build.** The run jumps straight to the pitch. You bank
  stability and an early-delivery score bonus, linear in the time you left
  on the clock — the panel shows the *current* value, melting in real
  time, so stopping has a visible price and a visible reward.
- **Take the open opportunity.** Three offers per run, rolled from the
  seed in escalating risk tiers (safe / medium / wild): obsessive polish,
  viral demo, sponsored feature, heroic refactor, absurd scale, feline
  easter egg. Accepting creates a *real task* on the board — same desks,
  same cats, same fatigue — with the benefit and the risk written on the
  card, gear-shop style. Shipping one raises a score multiplier and opens
  the next, riskier door.

Freezing after accepting is honest push-your-luck: untouched stretch tasks
are cut for free (stopping is a respected decision), but a started one
becomes a loose end. The judges saw you reach.

Every piece is deterministic — offers from the seed, risks through the
run's own RNG, all of it in the hash. A replay reopens exactly the same
doors.

## Catathon Circuit: difficulty you sign up for

The career is now a five-stage season: Neighborhood → Regional → Themed
Convention → National → Global Catathon. You qualify by **reputation**,
not by winning everything — the screen literally tells you "4 reputation
short of the Global".

Each stage declares its identity *before recruitment*: paws (1–5), task
cost scale, prize multiplier, and how seriously the rival takes this
stage (their skill gets a per-stage bonus, so the Global final is against
the rival at their peak). A hard run is now an assumed challenge with a
proportional check, never inconsistency dressed as variety. The sim only
learns what the demo needs to know — stage id and prize scale — and both
enter the hash.

The season closes when you podium at the Global *with the rival beaten*.
The career remembers it forever.

## The Career Hub: revealing what already existed

The highest-return delivery of the slice is the one with no new mechanics:
a persistent screen that shows the ladder (done / current / locked, with
gates), runs, personal best, reputation, wallet, the rival's scoreboard
and stolen roster, the alumni with their faces, the last twelve runs, and
the full achievement gallery — earned ones with dates, open ones with
readable conditions, secret ones in silence. Achievements stopped being
disposable chips on the result screen.

The result screen itself now closes the loop: stage name, early-delivery
points, stretch multiplier, new personal best, "QUALIFIED: the Regional
invite just arrived", and the season banner. Three new achievements ride
the new arc: Shipped and Asleep, Feline Overclock, and a secret egg.

## What we deliberately did not do

No permanent +10% anywhere. The circuit unlocks *stages*, reputation
unlocks *sponsors* (as before), and the Sprint multiplies only what you
risk inside a single run — horizontal progression, so easy runs never get
easier. The daily stays clean: same seed, no career buffs, and the Hub
points at it daily as the fair fight.

## Addendum: the kickoff cards

A follow-up landed right after: the project's initial decisions now appear
as **cards on screen**, one track at a time — backend, then frontend, then
design, then DevOps — each with its options and the trade-offs written on
them, gear-shop style. Frontend gained a decision of its own (it was the
only track without one), and every decision now has **two possible option
sets** rolled from the seed: one edition asks "backend architecture?",
another asks "where does the data live?" — same mechanical vocabulary,
different conversation. The old switch of effects became a single table
(`CHOICE_EFFECTS`), and a test guards that no card can ever offer an
option without an effect.

The card is a shortcut, never a cage: "decide later" defers to the board
(the deciding-at-the-whiteboard scene is untouched), the board remains a
live fallback, and the touch smoke now proves both paths with one finger.

## Numbers

- 12 new sim tests (offers, MVP gate, freeze economics, multiplier
  exactness, circuit ladder and pricing, hash coverage) and 5 client
  tests (history, records, achievement dates, qualification, the season,
  and legacy-save migration).
- Old careers load untouched: every new field defaults.
- 120 tests green; the touch smoke still plays the whole game with one
  finger.

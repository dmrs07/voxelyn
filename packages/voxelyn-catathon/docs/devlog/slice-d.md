# CATATHON Devlog — Slice D: Depth, or The Dogs Next Door

*Two commits (sim, then client) · 86 tests · the slice where the game
started remembering you.*

## The sparsest brief

Slice D arrived as a list of nouns: *cat compatibility. Hidden traits.
Junior evolution. Reputation. Sponsors. Special categories. Persistent
rivals. Events with consequences across hackathons.* No mechanics, no
numbers — just the design brief's master rule to keep us honest: every run
rolls a possible team, a problematic project and an imperfect space, and
you win by **knowing your cats**, cutting scope, managing chaos, and
turning the finale into a small feline spectacle.

"Knowing your cats" was the thread we pulled. Every system in this slice is
some form of the game knowing *you* back.

## Chemistry you can see before you can name

**Compatibility** became a pure function: any two cats have a vibe of −1,
0 or +1, computed from personality and traits. The orange cowboys resonate
with each other (one brain cell, shared). The cowboy shipping untested code
drives the perfectionist up the wall — and the silent judge *sees* every
dirty ship. Two zen cats calm each other without knowing why.

The mechanical hook is spatial: the vibe only acts between cats working at
**neighboring desks** (a radius in scene pixels), so the booth layout you
drew in the recruitment email suddenly matters twice. The Central Island
packs desks close and hums with chemistry; the Cubicles isolate everyone
from everything, friction included. Seating your team is now a puzzle.

And here is where **hidden-trait depth** landed, almost for free: the vibe
reads the hidden trait *from the first tick*. Your two hires hiss at each
other across the desks and the feed says so — but the card can't tell you
*why* until the mid-run reveal, because the resume hasn't confessed yet.
You see the behavior before you know its name. (We almost shipped vibe
hints on the recruitment cards, then realized they would leak the hidden
trait through arithmetic. The card shows the chemistry map only after the
reveal; before that, you get hisses and purrs in the feed, like a person
watching actual cats.)

## Juniors now learn by doing

The old junior grew by clock: a linear ramp over the run, working or not,
which on reflection was a horoscope, not a mechanic. Slice D made learning
**accrual**: `learned` rises only while working — and 1.6× faster with a
senior or specialist at the neighboring desk. Mentorship is spatial, like
everything else in the booth.

Cross the threshold and the feed announces the graduation, the **prize pays
for it** (the brief's §7 explicitly lists junior development as prize
criteria — we finally honored it, along with the debt bite: remaining tech
debt now gnaws the check), and the career remembers: that junior returns in
a future edition as a **mid-level candidate at a loyalty discount**, same
name, same coat, same traits — including the hidden one you now know. An
alumnus is valuable precisely because they've stopped being a gamble.

## Contracts with fine print

**Sponsors** only call once your **reputation** earns it — placement
builds rep, crashing burns it. Each contract is written on the card:
what they pay now, what objective they'll check at the demo (mechanically:
zero bugs, eight ships, 80% crowd, real innovation), what they pay if you
deliver — and the string attached. TunaCloud puts their API in your demo
path (it may die on stage). PurrData's audit makes every bug pricier to
fix. LitterBox Ventures makes someone present in the mascot suit, so the
crowd starts colder. Miss the objective and the payout vanishes *and* word
gets around: reputation drops. Signing is optional. Reading is advised.

Each edition also announces a **special category** — Golden Whisker, Iron
Litterbox, Crowd Purr — a second trophy with a mechanical predicate,
orthogonal to placement. It reshapes runs: a Crowd Purr edition makes the
pitch phase worth over-investing in.

## The Golden Retrievers

The rival had to be dogs. **Woofstack** (or Team Fetch, or The Debug
Doghouse — seeded per career) occupies the next booth forever. Their score
each edition is a pure function of the seed and their confidence; beating
you makes them stronger, being beaten shakes them slightly. The calibration
is a house law now, tested like everything: **the idle bot loses even to
the dogs; the competent bot beats them on every tested seed.** They deploy
at 9am sharp. Who does that?

The deepest cut is the **poach echo**: the Slice C social event where a
rival recruiter circles your star and you take the money? The star now
actually *leaves*. Next edition, the recruiter's email lists them on the
rival's roster, the dogs play better, and the alumnus you were counting on
is gone. One fifteen-second decision, consequences across hackathons — the
brief's last bullet, closed.

## What the gates caught this time

1. The **harmony test refuted itself**: the cat working beside a declared
   friend ended up *more* stressed than the control working alone. Not a
   sim bug — an unfair experiment: seating two cats burns more setup ticks
   than seating one, so the "together" cat had simply lived longer before
   measurement. The test now normalizes stress after seating and compares
   pure rates. The assertion was honest; the laboratory wasn't.
2. The recruitment card almost leaked hidden traits through the vibe map
   (see above) — caught at design time by the game's own rule: the reveal
   is a *moment*, and nothing on screen may spend it early.

## Numbers

- 66 → **86 tests**: vibe symmetry and range, friction stressing faster
  and harmony slower (played, with a fair lab), mentored juniors learning
  1.6× (played), growth announced and paid, every sponsor string proven
  (audit bug cost, branding gauge, demo-api risk), objectives paying and
  failing, special categories deterministic and paying only when the
  predicate closes, the debt bite with a floor at zero, the rival's band
  bounds over 200 seeds, and the two bots dueling the dogs — plus EN/PT
  parity gates for every new catalog.
- The prize is now a **ledger** (`prizeParts`): placement, zero-bugs,
  deals, sponsor, trophy, juniors, debt — the result screen can be honest
  because the sim itemizes.
- The smoke run's rival duel, verbatim from the log: *"Woofstack scored 78
  vs your 25. they are UNBEARABLE about it."* The smoke bot is not a
  competent player. The dogs are calibrated. Everything is working.

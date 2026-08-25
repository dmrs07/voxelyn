# CATATHON Devlog — Slice A: The Run With Decisions

*Two commits (sim, then client) · 41 tests · the slice where the game learned to say no to your finger.*

## Where this game came from

CATATHON started as five words in a chat: *"the world's biggest hackathon,
featuring dev fluffy cats."* That's it. That was the brief.

But we had something most five-word briefs don't get: an engine with
opinions. This repo already carried **Voxelyn** — a small voxel/2D engine —
and two sibling games built on its house discipline: a survival roguelike
and a full 24-book adaptation of the *Iliad*. Both taught expensive lessons
(integer ticks, seeded RNG as pure functions, authoritative state hashes,
"no DOM in the simulation" enforced by test, touch as the primary citizen).
CATATHON inherited every one of those scars on day one, for free.

The founding design decision — written into a design contract *before any
code* — was that the heart of the game is **task orchestration plus cat
psychology**, and that every cute thing must be mechanical. A cat is a
discipline + a personality + a feline quirk, and all three have gameplay
teeth. The perfectionist finishes a feature and *refuses to let it merge*
until you pet him ("ship it"). The orange cowboy ships without testing.
Stress doesn't fill a bar for decoration: a stressed cat **sits on the
keyboard**, and that's where bugs come from. Managing mood and managing
technical debt are literally the same verb. That's the joke, and the joke
is the mechanic.

## What Slice A is

The first vertical slice shipped and got played — a whole 48-hour run on a
real phone, 12/12 features. The playtest brief that came back was blunt:
the game had a good scene and a shallow loop. Slice A is the answer, and
its rule was: **fix the current run before making runs variable.**

### 1. Killing the petting exploit

Reading the sim with playtest eyes found the real villain: petting restored
**energy**. Hold your finger on a cat and you'd replaced food, sleep and
planning with one gesture. The whole management game collapsed into a
thumb.

The fix wasn't nerfing a number — it was giving the gesture *structure*:

- **Morale** became the fourth meter. It rises with well-timed petting,
  your own ship (+0.10) and the team's (+0.04); it falls when a cat works
  exhausted or gets evicted from its desk. And it drives **work speed**
  (0.85×–1.1×), because no meter in this house is allowed to be
  decoration.
- **Petting got memory** (`petStreak` / `petLastTick`, both hashed): the
  second consecutive session yields half; the third **overstimulates** —
  stress goes *up* and the feed tells you so. Roughly 40 seconds of
  restraint resets the streak.
- Personalities answer differently (the cowboy is needy: 1.2×/1.3×; the
  calm one is fine, thanks: 0.6×/0.7×). The perfectionist's "ship it"
  still works on any streak — that's communication, not care.

The player now learns each cat's rhythm instead of rubbing the screen.

### 2. Tasks with decisions

"Place a cat and watch a bar fill" is not a game. Three root tasks gained
a `choice` field, and a task with an open choice **does not progress** —
the cat sits down, the board blinks *DECISION open*, and the game charges
you for an answer. Feline monolith (fast now, debt later), microservices
(pricey now, the backend pays you back), sponsor serverless (blazing —
and their API might die *mid-demo*, which is a real crash-probability
term). Design-system-first discounts every later screen. A full pipeline
buys stability points the judges can see.

Technically each option is one entry in a switch: cost multipliers applied
once at decision time, plus scoring tags (`debt`, `innovation`, `uxCare`,
`stability`, `sponsorRisk`) that the finale reads. Cheap to write, and it
reshapes the run.

### 3. The pitch became playable

The demo crash used to be a dice roll at the end — decisive and
unwatchable. It's now a **phase**: thirty seconds on stage, a crowd gauge
decaying on its own, and one stage ability per cat (4s cooldown; repeating
the same trick yields half — crowds have memory; the cowboy's
cursor-chasing is the biggest hit *and* can flip the slide). The crash
roll turned into a **crisis window**: the demo freezes mid-pitch, and any
ability used within three seconds converts disaster into *heroic improv*
(+gauge, the crowd loves a recovery). Ignored, the demo genuinely crashes.

### 4. Five-dimension scoring

Engineering, stability, experience, innovation, pitch — plus the crowd as
a popular vote. Debt bites stability; choices pay where they promised; the
result screen shows *what cost you the podium*, because the post-game
lesson is the whole post-game.

## Craft notes

- **Tuning is proven by playing, never by inspecting constants** — a
  lesson bought in the Iliad's Book II. Two bots gate every balance
  change: the idle bot must lose (now it loses *on stage too* — the crowd
  cools, the crisis goes unanswered), and a competent bot — assign
  specialists, pet the risky, answer emergencies by triage — must reach
  the podium across seeds.
- The UI obeyed the playtest line by line: the cat card used to cover **a
  quarter of the playfield**, exactly over the selected cat's own station.
  It became a compact dock at the bottom edge; the team got portrait
  buttons with state rings; three stacked log lines became one strip with
  the history behind a tap; the bug chip became a *button* (an alert that
  leads nowhere is decoration).
- Small honest bugs the gates caught during the slice: a test that
  rewound the pet-memory clock into negative numbers (the sentinel
  ignored it — the test now *plays* the time forward); the project panel
  sitting open on top of the stage; result dimensions rendering unstyled.
  All three were caught by tests or by looking at actual screenshots
  before any human did.

**Numbers:** 33 → 41 tests. The state hash grew to cover morale, pet
memory, decided costs and the entire pitch state — because everything
that determines the future belongs in the hash.

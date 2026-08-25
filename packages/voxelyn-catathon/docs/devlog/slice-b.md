# CATATHON Devlog — Slice B: Every Run Is Another Run

*Three commits (generator, client, i18n) · 55 tests · the slice where the
game stopped having a cast and started having auditions.*

## The idea, and why a generator

Slice A fixed the loop; Slice B makes it a **roguelite**. The design brief
put it in one sentence that became our north star: *every run draws a
possible team, a problematic project, and an imperfect space — you win by
knowing your cats, cutting scope, managing chaos, and turning the final
pitch into a small feline spectacle.*

The four founding cats — Whiskers the perfectionist Siamese, Cheeto the
orange cowboy, Cushion the calm Maine Coon, Tuxedo the silent judge — were
never meant to be the whole game. They were the *archetypes*: four
personalities with real mechanics. Slice B keeps them as the face of the
title screen and the permanent cast of the test suite (`CLASSIC_TEAM`),
and opens the doors behind them.

## Creative decisions worth writing down

**Recruitment is an email.** Not a menu — an inbox. "Re: Candidates for
CATATHON", a recruiter's note that names this edition's project, the
judges' announced lens and your booth, and six candidate badges attached.
Each shows breed, tier, specialty, *two* traits, a `???`, one resume line
("eight years of experience knocking objects off tables") and a price in
three physical currencies: **bottle caps, toy balls, goldfish**. You lock
in three or four, inside a budget. It's diegetic, it's funny, and it's a
real decision — not an obvious sum.

**The hidden trait acts before it's revealed.** That was the one rule we
refused to soften: the `???` isn't a locked tooltip, it's a live mechanic
from tick zero. You *observe* the behavior — why does this cat keep
falling asleep at the desk? — and only at 30% of the run does the feed put
a name on it. Recruitment uncertainty you can feel, not read.

**Tiers change how you play, not just a multiplier.** Juniors start slow
and *learn during the run* (+0.18 speed by the end) but ship dirty;
seniors fix bugs 1.4× and ship twice as clean; the specialist flies on
their own track and sinks everywhere else. Eight specializations were in
the wishlist; we shipped five (four tracks + the freestyler who does 0.75
of everything) and **deferred tech lead, PO and AI engineer by name** —
they deserve their own mechanics (review, prioritization), not a stat
line. Cutting scope is literally this game's theme; the backlog practices
what the game preaches.

**Curated over free-form.** Three project graph *shapes* (all proven
acyclic by test, across forty seeds) instead of random DAGs; six booth
layouts with opinions (Open Booth boosts team morale and distraction;
Server Corner fixes emergencies 1.3×; Quiet Zone trades social morale for
focus) instead of world-gen soup. Every project also carries an announced
judge emphasis (1.25× on one dimension) and one **hidden risk** — the
sponsor's integration dies mid-run, hype cools the crowd faster, or
sensitive data makes every bug cost more.

## Using Voxelyn for this

The engine's role is deliberately narrow and deliberately deep. From
`@voxelyn/core` we use `Surface2D`, `packRGBA` and the canvas2d presenter —
the whole pavilion is drawn pixel-by-pixel into one 480×270 surface, in
the house's axonometric-box style. The **reuse matrix** (written before
any code, per the design contract) records the honest decision: game
coordinates stay 2D screen-space instead of the engine's isometric
projection, because a god-hand touch game lives or dies by finger
precision, and every projected pixel would cost an inverse transform on
every touch.

The more valuable inheritance was cultural: the RNG is xorshift32 as a
*pure function over serialized state* (the engine's RNG class hides its
state in a private field — unusable for hashing and saves, a lesson
already paid in the Iliad); the FNV-1a hash format is shared across the
whole monorepo so divergence tooling works everywhere; and the "no DOM in
the sim" rule is enforced by an actual test. When the team became
generated, the renderer just started reading coat colors and patterns off
the cat data — tabby stripes, siamese mask, tuxedo chest, and the sphynx,
who gets no fluff fringe at all, only skin folds and dignity.

## The technical spine

The generator (`gen.ts`) is a pure function of the seed, with a salted
`Dice` per subsystem so team, project and layout never fight over draws.
The replay identity grew one term and became the whole feature:

```
replay = (seed, hired team, commands)
```

Candidates, project and layout derive from the seed; the *team* is the
player's decision, so it enters as an argument. Same seed + same hires +
same touches = the same run, recruitment included.

Generalizing the sim from four named cats to N generated ones was the real
surgery: `CatId` became a string, slot coordinates moved into state (each
layout carries its own), speed composes specialization × tier × traits ×
morale, and the pitch keys abilities by *personality* instead of by name.

## What the gates caught (the honest part)

1. **The audio was keyed by the classic cats' names.** Voice profiles and
   typing rhythms looked up `PROFILES[cat.id]` — with a generated team
   that's `undefined.base`, thrown *inside the game loop*, which killed
   requestAnimationFrame entirely. The smoke test caught a cat frozen
   mid-drag, hanging from a hand that no longer ticked. The fix was the
   sound direction's original intent all along: timbre comes from
   personality.
2. **Four expensive tiers could make the only full-coverage team
   unaffordable.** The generator now deterministically downgrades the
   priciest coverage candidate until the quartet fits the budget — and
   that constraint is a test.
3. **The pitch bot spent all four abilities and had nobody left for the
   crisis** (4s cooldowns vs. a 3s window). It learned to hold one cat in
   reserve while a crisis is still possible — which is, verbatim, a
   gameplay tip discovered by a test.
4. Code review found the bug chip **unclickable** — `pointer-events: none`
   inherited from the info bar. An alert that leads nowhere is decoration;
   it's a button now, with its own smoke gate.

## i18n, done the honest way

The world's biggest hackathon should speak English by default — with
Portuguese one tap away on the title screen. The interesting call was
*where* each string lives. Interface text (chips, buttons, events,
screens) sits in a typed client dictionary, where the compiler itself
enforces EN/PT structural parity. But task labels, resumes, briefings and
decision texts live *in simulation state* — so they are **generated in a
locale, not translated after the fact**: `rollCandidates`, `rollProject`
and `createHackathon` all take a locale. Even the pixel-font marquee is
bilingual ("5H30 LEFT" / "FALTA 5H30" — the 3×5 font had to learn W and
Y for it). A parity test guards the sim-side catalogs, since
`Record<string, …>` enforces nothing by itself.

**Numbers:** 41 → 55 tests. The generator is tested *by playing*:
determinism per seed, track coverage in the first four candidates, budget
always playable, forty seeds of acyclic graphs, and a fully generated run
crossing from recruitment to the judges without an exception.

## Deferred, by name (→ Slices C/D)

Career progression and persistent currencies · purchasable gear · social
and ethical events · daily seed · achievements · the specialist's
mechanical demands (own workstation, catnip) · cat-to-cat chemistry ·
persistent rivals.

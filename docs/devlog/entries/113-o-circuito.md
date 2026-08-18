# 113 - The Circuit

**2026-08-17** · commit `81e744c` · PR #149

The most useful thing anyone said about this game last week was said about a
feature I had already shipped three times:

> The leylines are boring and serve no fundamental role. They just go unnoticed
> if you don't have some kind of energy source.

That was me, playtesting my own game, which is the only kind of feedback you
can't dismiss as a skill issue.

## Five facts, none of them a matter of taste

The complaint was vague. The code was not. I went looking for evidence and found
five things, and once they were written down in a row the verdict wrote itself.

**One verb, behind an optional item.** Only `cls === 'energy'` interacted with a
line, and `energy` only exists if the `conductive` module is active and charged —
one of two options in a tier-2 vault. Without it, `stepLeylines` returns at the
first `if`, and the entire run is indistinguishable from one with no leylines in
it at all.

**The electricity the game already makes couldn't reach them.** Breaking crystal,
electrifying a pool, the Leviathan's Deluge, the Conductive Arc — none of them
armed a segment. The leyline was the only conductor in the game that did not
conduct the game's own electricity.

**The role I'd declared "primary" was already taken.** Orientation is the entire
Survey branch: objective beacon, salvage trace, ore scanner, route memory, return
vector. And the leyline's route follows the BFS field from entrance to hall to
deep region — which is the direction the player already walks, by construction.

**Zero coupling.** `pathing.ts`, `entities.ts`, `bosses.ts` and `abilities.ts`
contain not one reference to a leyline. A system nothing else reads cannot be
fundamental. That's a property of the codebase, not an opinion about the design.

**Even with the module it was rarely the right play.** 26 flat damage, 0.8s
telegraph, 10s refractory, and it only hits someone pressed against the wall —
against four shots per second from the normal gun.

The conclusion I had to accept: the primary role was *wrong*, not
under-tuned. Three previous passes had made leylines more numerous, more
guaranteed, and more luminous. None of that fixes a system whose only verb is
optional.

## The decision

The leyline stops being a conductor that waits for an item and becomes **the
sector's circuit**. A single cascade, launched at the wellspring, has to light
*every* segment in the network. Closing it is an optional, sector-scale
objective, and the difficulty is made of whatever the stratum is made of.

The prize is small, always the same shape, and lasts until you descend: **the
property that gives the stratum its identity stops applying.**

That kills the gate in one move. The wellspring — the network junction nearest
the entrance — fires on interact. Someone who has never seen a tier-2 vault has
the whole system available in the first minute of any run.

## The part where measurement killed my design

The original proposal had a **collector**: carry the current from the wellspring
to a node in the deep band, routing the junctions along the way under a budget
`K`. Nice and puzzle-like. I wrote the spec before I wrote the query.

Then I measured 637 sectors with networks — seeds 1–200 across sectors 1–7:

| | |
| --- | --- |
| Sectors where a circuit is possible | 81.2% |
| Circuits needing **1** junction routed | **71.6%** |
| 2 junctions | 27.7% |
| 3 junctions | 0.8% |

A median of *one* junction between the endpoints, across all seven strata. And
structurally it was worse than the table looks: the relay arms every dormant
neighbour, so a cascade floods the routed subgraph anyway. Even at three
junctions there was no route to choose — only "route everything."

So `K` had no correct value. Smaller than the path makes the circuit impossible;
larger makes it irrelevant. There is no number in between, because the generator
doesn't produce a graph with choices in it.

Requiring the *whole network* solves both at once, using the same shallow graph.
And it costs me the word "puzzle": the difficulty is **logistical and
territorial**, not combinatorial. Anyone hoping for a routing brain-teaser will
find a long, exposed walk instead. Saying that out loud is better than pretending
the generator hands me a graph it does not.

## The short, and the number that set it

A segment with **6 or more distinct crystal or ore cells touching it** bleeds the
charge and refuses to light. The cascade stops there, and a `leyline_short` event
names the segment so the obstacle doesn't read as the mechanic being broken.

Six is measured, not chosen for feel. With a threshold of 1 — "any conductive
neighbour" — the rule stopped being an obstacle and became a tax:

| Threshold | Segments shorted | Networks 100% clean |
| --- | --- | --- |
| 1 cell | 73–89% | **0%** |
| 6 cells | 9–39% | 61–74% |

And at 6 the distribution says the right thing about the world:

| Stratum | Segments shorted | Networks with ≥1 short |
| --- | --- | --- |
| Prismatic Cathedral | 39% | 96% |
| Glacial Crypt | 27% | 62% |
| Black Aquifer | 20% | 57% |
| Sulfur Rift | 17% | 43% |
| Abyssal Furnace | 14% | 43% |
| Basalt | 9% | 27% |
| Silica Sinkholes | 9% | 26% |

The Cathedral — the stratum *made of* crystal — is almost always the problem.
The basalt of sector one almost never is, which makes the first circuit of a run
a free lesson in the language.

The fix is the game's central verb: break the crystal, spend the vein. The rule
reads the grid on every question, so the segment conducts again on the next tick
with no new state to synchronise.

**Liquid deliberately doesn't short.** The proposal said water should. But the
Aquifer's water is *static* and the game has no verb that removes it — shorting
on pools would make that circuit impossible rather than hard.

## The symmetry I'm most pleased with

The reward turns off the stratum's identity property until you descend. And the
thing standing in your way is *the same property*.

The Cathedral's crystal is the short and it's the prize. The Furnace's embers are
the obstacle and the prize. The puzzle and the reward are one sentence read in
two directions.

It also cuts both ways, which is what keeps a small reward honest without a timid
multiplier. Turn off the Aquifer's conductive sheet and you lose electrifying
pools — one of the best plays in the game. Dull the Cathedral's crystal and you
lose your free source of `current`. You don't gain a power. You switch off a
rule, and the rule was serving both of you.

Exactly one row is asymmetric on purpose: the Furnace's embers are pressure that
only ever existed against the player, so there the price sits in the cost of
closing rather than in the prize.

## What I'm not pretending

Three things this design does not solve, written down before playtest finds them:

**About 19% of sectors have no circuit at all.** The wellspring simply isn't
there, and nothing on screen says so — a player can hunt for a puzzle that does
not exist. That's the same discoverability bug that already caught me once with
the briefing, wearing a new hat. It's the strongest candidate for the next pass.

**Sector one is trivial by design.** Basalt has nothing to subvert, so the first
circuit teaches the grammar and pays nothing. Deliberate. If it reads as
anticlimax, that's playtest.

**The Ferric stratum has no circuit and never will by this route.** It's the
stratum with the most Miners and the most electrical identity of all — the wall
that conducts — and it's the only one that never sees a circuit. A scan of 4000
seeds found 3294 ferric sectors and exactly zero leylines. The first version of
this spec listed a ferric obstacle and a ferric prize, and the code actually
shipped the prize: dead code, now removed. The answer isn't to give leylines to
ferric; it's to give the ferric vein its own verb, in another system. Logged as
design debt rather than quietly dropped.

## Cost

Simulation 40→41, protocol 24→25, content unchanged. The new state — closed
circuit, reached segments, the subversion flag — goes in the authoritative hash
and on the wire, exactly like `routed` already did.

And a small piece of hygiene the review earned: `descend` and `ascend` were
building the leyline network with identical code side by side. With the circuit
adding four more fields to reset, that copy stopped being cheap, so it became
`resetLeylineNetwork`. What you write twice diverges the third time — the same
lesson PR #144 taught in a different shape.

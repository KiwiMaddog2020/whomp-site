/** THE WHOMP WIKI, the derived half.
 *
 *  Every magnitude on every page in here is READ OUT OF the game repo's
 *  generated artifacts at build time: data/game-data.json owns canonical
 *  catalogs and relations, while data/tier-rankings.json owns simulation
 *  measurements. Nothing factual is retyped here. That is not a style
 *  preference, it is the only version of a wiki that survives balance moving:
 *  a page that copies a weapon's damage is a cache with no invalidation, and it
 *  is wrong the first time somebody tunes a number and does not think to come
 *  here.
 *
 *  THE AUTHORED HALF IS SMALL AND IT IS ABOUT MEANING, NEVER MAGNITUDE.
 *  This file is allowed to explain what "pierce line" or "clip" MEANS, because
 *  the data layer ships an enum and a reader needs a sentence. It is not allowed
 *  to say how much damage anything does, how fast it fires, or where it spawns.
 *  Every glossary line below was checked against the runtime code that consumes
 *  the field. If you cannot cite one, do not write the line: leave the bare enum
 *  on the page and let the reader see an honest "spitter" rather than a
 *  confident wrong sentence.
 *
 *  WHAT IS DELIBERATELY NOT ON THESE PAGES, and why. Every one of these was
 *  checked in the runtime code and then dropped, which is the whole difference
 *  between a wiki and a spec dump:
 *
 *    DPS.  src/sim/weapons.ts multiplies damage by the player's might and crit
 *          and divides cadence by their attack speed, and half the patterns do
 *          not have "damage times shots per second" semantics at all (the beam
 *          ramps, chain secondaries take a flat 80%, the shotgun has near and
 *          far multipliers, the aura is a damage-over-time). The registry header
 *          carries a DPS figure as an AUTHORING TARGET; nothing evaluates it.
 *          A single DPS column would be a confident wrong number on 33 cards.
 *
 *    FINAL ENEMY SPEED.  The data layer now publishes both the authored base and
 *          the profile-gated live-run base produced by bandedEnemySpeed(), so
 *          those are safe to show. Its own speed policy says the latter still
 *          precedes timed and per-instance scaling, so the page labels it as a
 *          base and never promotes it to a final chase speed.
 *
 *    MINIBOSS AND BOSS HEALTH AND DAMAGE.  src/sim/bosses.ts REPLACES these at
 *          spawn from its own table; the registry's numbers for those tiers are
 *          documentation. So the stat block renders for basic and special only,
 *          and the boss cards say who owns their numbers instead.
 *
 *    CORE COMBAT NUMBERS.  Every clip size, reload, cooldown and damage
 *          multiplier for the eight core weapons is a module-private const in
 *          src/sim/weapons.ts. Not exported, not in the data layer, therefore
 *          not on the page. meterPips is the one exception and only because the
 *          suite pins it against the private constant.
 *
 *    CORE EVOLUTIONS.  coreWeapons.ts carries an `evolutionName` per core and
 *          the game's own picker advertises it, but nothing implements it: no
 *          milestone counter, no trigger, no evolved core state. Publishing it
 *          would promise a feature that does not exist, so it is omitted. This
 *          is reported to the director rather than decided here.
 *
 *  ADDING A GUIDE (this is the extension point, use it):
 *    1. add an entry to rosterSpecs() below
 *    2. write its `card(e)`
 *    3. that is all
 *  The page chrome, the filter bar, the sort control, the comparison meters,
 *  the search entries, the hub card, the categorized navigation, the coverage
 *  contract and the generator's cross-link check are all driven off that one
 *  object. A new public data domain fails generation until a guide classifies
 *  and renders it. The deploy scripts stage from the manifest the generator
 *  writes, so adding a route never requires another filename list.
 */

// ---------------------------------------------------------------- small helpers
const mmss = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Trim a float to something a reader can hold in their head without lying
 *  about it: 9.6 stays 9.6, 0.8181818 becomes 0.82. Never rounds a non-zero
 *  value down to a flat zero. */
const num = (n, places = 2) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '?';
  if (Number.isInteger(v)) return String(v);
  const r = Number(v.toFixed(places));
  return String(r === 0 ? Number(v.toPrecision(1)) : r);
};

const pct = (x) => `${x >= 0 ? '+' : ''}${num(x * 100, 1)}%`;

/** Title Case a camelCase enum for display, so a value that gains a new member
 *  in src/data still renders readably instead of falling through to blank.
 *
 *  LABEL holds display-only overrides for the values camelCase splitting
 *  mangles: `randomAoE` becomes "Random ao e" under the general rule, which is
 *  the sort of small ugliness that makes a page look unmaintained. Safe to
 *  hand-write, unlike a hand-written list of FACTS, because a value missing from
 *  here falls through to the general rule and renders slightly worse rather than
 *  wrongly. Nothing in it can go stale into a lie. */
const LABEL = {
  randomAoE: 'Random AoE',
};
const humanize = (s) => LABEL[s] || String(s)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .toLowerCase()
  .replace(/^./, (c) => c.toUpperCase());

/** The data layer's relation values are not consistently shaped: enemies carry
 *  `splitsFrom` as an array of ids but `splitsInto` as a bare id string. A
 *  consumer that assumes either one crashes on the other, so every relation read
 *  goes through this. Worth flattening upstream in bin/data-layer.mjs; until it
 *  is, this is where the asymmetry stops. */
const arr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

const list = (items) => {
  const a = items.filter(Boolean);
  if (a.length === 0) return '';
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
};

// ---------------------------------------------------------------- the glossaries
/* AUTHORED, and every entry is a claim about the game, so every one was checked
 * against the code that consumes the field. These exist because the data layer
 * ships enums: `pattern: "pierceLine"` is exact and useless to a reader, and the
 * honest fix is a sentence, not an invented number.
 *
 * AN UNKNOWN KEY IS NOT AN ERROR. If src/data grows a new pattern tomorrow the
 * card shows the humanized enum with no sentence under it, which is true and
 * slightly thin, rather than captioned with a neighbour's description. The
 * generator counts the gaps and prints them, so a new enum shows up in the build
 * output the day it lands instead of a year later.
 *
 * PATTERN IS NOT ENOUGH ON ITS OWN, and this is the subtle one. src/sim/weapons.ts
 * switches on `pattern` and then IMMEDIATELY re-branches on a params flag, and in
 * the shipped roster the generic arm is dead for most patterns. The worst case is
 * Lighthouse: its pattern is "beam" but it carries params.faultline, so it
 * dispatches to a ground rupture and is not a beam at all. So each pattern here
 * keeps a `_` default plus overrides KEYED BY THE SAME PARAMS FLAG THE RUNTIME
 * BRANCHES ON. That flag is in the data layer, so the gloss follows the code's own
 * decision rather than a hand-written list of weapon ids, which is the thing that
 * goes stale. */
const PATTERN_NOTE = {
  pierceLine: {
    _: 'Fires a bolt in a straight line that keeps going through everything it hits.',
    energyBolt: 'Leads its target and fires a small volley in a straight line, punching through a limited number of enemies per shot.',
    railgun: 'Charges, then fires an instant line down the whole length of its range. The charge is the cost and the lockout after it is the risk.',
    spectral: 'Fires arrows in bursts that pierce, and leaves damage on the ground along the path they took.',
  },
  orbit: {
    _: 'Bodies circle you continuously and hurt whatever they sweep through. Nothing to aim and no downtime.',
  },
  homing: { _: 'Shots pick a target as they leave you and steer toward it.' },
  boomerang: { _: 'Thrown out, then it comes back, and it can hit on both legs of the trip.' },
  meteor: { _: 'Paints a shadow on the ground, then drops a strike into it a moment later. You are hitting a place, not a target.' },
  chain: {
    _: 'Hits one enemy at full damage, then jumps to the nearest one it has not hit yet, each jump landing a flat share of the first.',
    daggers: 'Strikes the nearest few enemies to YOU at full damage each. It does not hop between them, so it does not care how they are spaced.',
  },
  cone: {
    _: 'Sprays a wedge in front of you and hits everything caught inside it at once.',
    iceShards: 'Throws a converging volley of shards that also slows what they hit.',
    flame: 'Holds a sustained cone in front of you with a smoothed aim, so it keeps burning as you turn.',
  },
  aura: {
    _: 'A field around you that ticks damage into whatever is standing in it. Always on, never aimed.',
    toxic: 'Poisons what it touches instead of hitting it once, so the damage keeps arriving after the enemy has left the field.',
  },
  ricochet: { _: 'A disc thrown at a lead, then bouncing on to a budget of further targets that grows with level.' },
  beam: {
    _: 'Holds persistent locks on targets and ramps its damage the longer a lock survives, with splash around where it lands.',
    faultline: 'Ruptures the ground in a line rather than firing a beam, throwing up pillars along it.',
  },
  burstNearest: {
    _: 'Fires a burst at whatever is closest, so it answers the thing about to touch you.',
    shotgun: 'A pellet volley that hits much harder up close than far away. The spread is the range limit.',
  },
  blackHole: { _: 'Drops a well that drags enemies inward and ticks damage into them while it lasts.' },
  pathEcho: { _: 'A lashing chain of nodes that trails the path you walked, heaviest at the front and tapering to the tail.' },
  meleeArc: {
    _: 'Sweeps an arc around you at close range. Nothing to lead, and nothing to lose at distance because there is no distance.',
    scytheSweep: 'Sweeps a wide arc around you facing the way you are moving, leaving only a gap directly behind.',
  },
  petUnits: {
    _: 'Sends out units that roam on their own and fight whatever they find.',
    sentry: 'Plants a sentry that holds a position and zaps what comes near it, for as long as it lives.',
    squirrel: 'Sends out a pack that chases, pounces, and comes back to you.',
  },
  randomAoE: {
    _: 'Drops area hits at spots around you rather than at anything you picked.',
    thunder: 'Calls strikes down out of the sky, instantly, at points near you.',
    starField: 'Fills the area around you with falling stars, out to a radius that grows as it levels.',
    pulseMine: 'Drops mines behind you that arm, wait, and go off when something comes close enough.',
  },
};

/** ENEMY BEHAVIOR, how it moves and what it wants.
 *  Checked against the behaviour table in src/sim/behaviors.ts.
 *  NOTE: nine of these only actually run on tier `special`; on any other tier
 *  the runtime substitutes a plain chaser, and boss and miniboss movement is
 *  owned by the boss director entirely. So the card only shows this sentence for
 *  the tiers where it is true. */
const BEHAVIOR_NOTE = {
  chaser: 'Walks straight at you and tries to touch you. The baseline threat.',
  fast: 'Comes at you on a curve rather than a line, flanking wider the further out it starts.',
  tank: 'Slow and heavy, and it pushes through the crowd instead of spreading around it.',
  swarm: 'Clumps together as it comes. Individually trivial, and it does not arrive individually.',
  exploder: 'Closes on you, lights a fuse you can see, and detonates. The damage is on the death, not the touch.',
  spitter: 'Backs off to its own preferred distance, swells up as a tell, then lobs a glob at you. Distance is not safety.',
  charger: 'Winds up with a line drawn on the ground, locks that direction, then commits to a fast straight rush. Readable, and it does not steer once it has gone.',
  splitter: 'Walks at you like anything else. The trick is what happens when it dies.',
  wraith: 'Stalks faded, shimmers as it locks onto you, lunges, then is left exposed while it recovers.',
  sniper: 'Holds a long distance and spends over a second aiming a line you can see before it fires.',
  strafer: 'Circles at range instead of closing, keeping its spacing rather than yours, and fires in bursts.',
  diver: 'Circles above, flares to lock its line, then commits to a straight run through you. It locks at the flare, so a step sideways beats it.',
  bomber: 'Hovers high and never closes, drawing a ring on the ground before it drops something onto that spot.',
  jumper: 'Crouches, flashes, then arcs over the ground between you. It gets past the line you thought was holding.',
};

/** CORE WEAPON CADENCE, the rhythm the core makes you play to. Each of the eight
 *  cadences is claimed by exactly one core, so this doubles as the core's own
 *  description. Checked against the per-archetype timing constants in
 *  src/sim/weapons.ts. Deliberately no numbers: those constants are private to
 *  that file and are not in the data layer, so the wiki does not know them. */
const CADENCE_NOTE = {
  clip: 'A couple of shells, then a reload you have to survive. The empty clip is the whole design.',
  charge: 'Hold to draw, release to fire. A partial draw still goes off, just weaker, so the question is always whether you had time for the full one.',
  cooldown: 'One shot, a flat wait, then another. The shell takes time to land, so you are aiming at where they will be.',
  heat: 'Keeps firing while you hold it and builds heat while it does. Overheat and it locks you out until it cools.',
  windup: 'Commits to a windup before the sweep lands, and chains into a second swing if you keep it going. Once it starts you cannot take it back.',
  lock: 'Builds a lock only while you keep a target inside the cone, and loses it if you switch. Then it spends the lock.',
  spin: 'Spins up to a gate rather than a scale. Releasing early gives you nothing at all, so there is no partial credit.',
  drain: 'Attach and hold. It pays out at the release, so letting go early forfeits what you had built.',
};

/** CORE WEAPON FEEL, the designer's own one-word name for the skill the core asks
 *  of you. Carried over verbatim from src/data/coreWeapons.ts rather than
 *  reworded, because the word IS the design intent. */
const FEEL_NOTE = {
  spacing: 'knowing exactly how far away you are',
  leading: 'firing where they are going to be, not where they are',
  placement: 'choosing the spot before the moment',
  painting: 'holding on target and staying on it',
  commitment: 'deciding early and not flinching',
  patience: 'waiting for the shot instead of taking the one on offer',
  conviction: 'backing your read all the way through',
  nerve: 'standing in it one beat longer than feels wise',
};

// ---------------------------------------------------------------- CSS
const WIKI_CSS = `
.wtopbar{max-width:1180px;margin:0 auto;padding:0 24px}
.wtopbar-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 0 0}
.wshell{max-width:1180px;margin:0 auto;padding:28px 24px 96px;display:flex;gap:36px;align-items:flex-start}
.wside{width:220px;max-height:calc(100vh - 40px);overflow-y:auto;flex:none;position:sticky;top:20px;display:flex;flex-direction:column;gap:2px;padding-right:5px}
.wside a{display:block;padding:9px 12px;border-radius:8px;color:var(--body);text-decoration:none;font-size:.92rem}
.wside a:hover{background:rgba(255,243,207,.05);color:var(--cream)}
.wside a.is-here{color:var(--cream);background:rgba(255,243,207,.06);font-weight:700}
.wside a[aria-current="page"]{box-shadow:inset 3px 0 0 var(--cyan)}
.wside-h{padding:14px 12px 6px;color:var(--gold);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.wside .stat{padding:9px 12px;color:var(--dim);font-size:.78rem}
.wmain{flex:1;min-width:0}

/* THE PROVENANCE BANNER. The one thing that makes this different from a wiki is
   that it cannot go stale, and a reader has no way to know that unless the page
   says so. Said once per page, quietly, near the top. */
.wprov{border:var(--edge);border-left:3px solid var(--cyan);border-radius:10px;padding:12px 16px;
  background:rgba(36,240,255,.04);color:var(--dim);font-size:.84rem;margin:0 0 18px;line-height:1.55}
.wprov b{color:var(--cream);font-weight:700}
/* THE OMISSIONS BOX. What the page will not tell you and why. A wiki that just
   leaves a column out reads as incomplete; one that says "this number exists and
   here is why publishing it would be a lie" reads as trustworthy. */
.womit{border:var(--edge);border-left:3px solid var(--gold);border-radius:10px;padding:12px 16px;
  background:rgba(255,207,63,.035);color:var(--dim);font-size:.83rem;margin:0 0 24px;line-height:1.55}
.womit b{color:var(--gold);font-weight:700}

.wbar{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;margin-bottom:16px}
.wfacet{display:flex;flex-direction:column;gap:6px}
.wfacet-h{color:var(--dim);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.wfacet-row{display:flex;flex-wrap:wrap;gap:6px}
.wf{padding:6px 13px;border-radius:999px;border:var(--edge);background:none;color:var(--dim);cursor:pointer;
  font-size:.79rem;font-family:var(--font)}
.wf:hover{color:var(--cream)}
.wf.is-active{color:var(--cream);border-color:var(--cyan);background:rgba(36,240,255,.08)}
.wsort{padding:7px 12px;border-radius:8px;border:var(--edge);background:var(--lift);color:var(--cream);
  font-family:var(--font);font-size:.82rem}
.wcount{color:var(--dim);font-size:.82rem;margin:0 0 18px;font-variant-numeric:tabular-nums}
.wempty{border:var(--edge);border-radius:12px;padding:18px;margin:0 0 24px;color:var(--dim);background:rgba(255,243,207,.025)}
.wempty b{display:block;color:var(--cream);margin-bottom:8px}
.wempty button{font:inherit;color:var(--cyan);background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}

.wgroup{margin-bottom:34px}
.wgroup-h{display:flex;align-items:baseline;gap:10px;margin:0 0 4px}
.wgroup-h h3{margin:0;font-size:1.15rem;color:var(--cream)}
.wgroup-n{color:var(--dim);font-size:.8rem;font-variant-numeric:tabular-nums}
.wgroup-note{color:var(--dim);font-size:.86rem;margin:0 0 14px;max-width:74ch}
.wgroup[data-empty="1"]{display:none}

.wgrid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.wcard{border:var(--edge);border-radius:14px;padding:16px 18px;background:rgba(255,243,207,.025);
  display:flex;flex-direction:column;gap:10px;scroll-margin-top:24px}
.wcard[data-hidden="1"]{display:none}
.wcard:target{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(36,240,255,.14)}
.wcard-h{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wcard-h h4{margin:0;font-size:1.06rem;color:var(--cream);font-weight:800}
.wcard-accent{width:30px;height:4px;border-radius:2px;flex:none}
.wdesc{margin:0;font-size:.9rem;color:var(--body)}
.wgloss{margin:0;font-size:.88rem;color:var(--dim)}
.wnote{margin:0;font-size:.88rem;color:var(--body);border-left:2px solid var(--violet);padding-left:12px}
.wequation{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:9px;background:rgba(36,240,255,.04);font-size:.9rem}
.wequation a{color:var(--cyan);text-decoration:none;border-bottom:1px solid rgba(36,240,255,.3)}
.wequation b{color:var(--gold)}
.wswatch{display:inline-block;width:13px;height:13px;border-radius:50%;border:1px solid rgba(255,255,255,.25);vertical-align:-2px;margin-right:5px}

.wtags{display:flex;flex-wrap:wrap;gap:6px}
.wtag{font-size:.7rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;
  border-radius:6px;border:var(--edge);color:var(--dim)}
.wtag.ink-cyan{color:var(--cyan);border-color:rgba(36,240,255,.35)}
.wtag.ink-pink{color:var(--pink);border-color:rgba(255,47,126,.35)}
.wtag.ink-gold{color:var(--gold);border-color:rgba(255,207,63,.35)}
.wtag.ink-violet{color:var(--violet);border-color:rgba(177,75,255,.35)}

.wfacts{display:flex;flex-direction:column;gap:6px;margin:0}
.wfact{display:flex;gap:10px;font-size:.85rem;align-items:baseline}
.wfact-k{flex:none;width:96px;color:var(--dim);font-size:.68rem;letter-spacing:.05em;text-transform:uppercase}
.wfact-v{flex:1;min-width:0;overflow-wrap:break-word;color:var(--body)}
.wfact-v b{color:var(--cream);font-weight:700;font-variant-numeric:tabular-nums}
.wfact-v a{color:var(--cyan);text-decoration:none;border-bottom:1px solid rgba(36,240,255,.3)}
.wfact-v a:hover{border-bottom-color:var(--cyan)}
.wfact-v .wsub{color:var(--dim);font-size:.92em}

.wraw{border-top:var(--edge);padding-top:8px;color:var(--dim);font-size:.78rem}
.wraw summary{cursor:pointer;color:var(--cyan);font-weight:700;list-style-position:outside;margin-left:15px}
.wraw summary span{color:var(--dim);font-weight:400;margin-left:5px;font-variant-numeric:tabular-nums}
.wraw dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:5px 12px;margin:10px 0 0}
.wraw dl div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,243,207,.05);padding:3px 0}
.wraw dt,.wraw dd{margin:0;overflow-wrap:anywhere}
.wraw dd{color:var(--body);text-align:right;font-variant-numeric:tabular-nums}
.wschedule ol{margin:10px 0 0;padding-left:22px;display:flex;flex-direction:column;gap:5px}
.wschedule li{padding-left:3px;color:var(--body)}
.wschedule li a{color:var(--cyan);text-decoration:none}
.wschedule li span{color:var(--dim);margin-left:6px}
.wschedule li code{float:right;margin-left:8px}

.wfeature{border:var(--edge);border-radius:14px;padding:20px;margin:0 0 24px;background:linear-gradient(135deg,rgba(36,240,255,.05),rgba(177,75,255,.035));color:var(--body)}
.wfeature h3{margin:2px 0 8px;color:var(--cream);font-size:1.2rem}
.wfeature p{margin:7px 0;color:var(--dim);font-size:.86rem}
.wfeature .eyebrow{color:var(--gold);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.wmethod-grid,.wbuild-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:14px 0}
.wmethod-grid>div,.wbuild-grid>article{border:var(--edge);border-radius:10px;padding:12px;background:rgba(6,4,14,.34)}
.wmethod-grid b,.wmethod-grid span,.wmethod-grid code{display:block}
.wmethod-grid span{color:var(--body);font-size:.82rem;margin:5px 0}
.wbuild-grid h4{margin:10px 0 5px;font-size:.9rem;line-height:1.5}
.wbuild-grid h4 a,.wbuild-grid li a{color:var(--cyan);text-decoration:none}
.wbuild-grid ol{margin:8px 0 0;padding-left:18px;color:var(--dim);font-size:.78rem}

/* COMPARISON METERS. The bar is relative to the biggest value in THIS roster and
   the real number is always printed beside it, so the bar is a sorting aid and
   never the claim. Said out loud in the provenance banner. */
.wmeters{display:flex;flex-direction:column;gap:4px}
.wmeter{display:flex;align-items:center;gap:8px;font-size:.78rem}
.wmeter-k{flex:none;width:96px;color:var(--dim);letter-spacing:.05em;text-transform:uppercase;font-size:.68rem}
.wmeter-t{flex:1;min-width:40px;height:6px;border-radius:3px;background:rgba(255,243,207,.07);overflow:hidden}
.wmeter-t i{display:block;height:100%;border-radius:3px;background:var(--sweep)}
.wmeter-v{flex:none;min-width:66px;text-align:right;color:var(--cream);font-variant-numeric:tabular-nums;font-weight:700}
.wmeter-u{color:var(--dim);font-weight:400}

.whub{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));margin-bottom:12px}
.whubcard{border:var(--edge);border-radius:14px;padding:20px 22px;background:rgba(255,243,207,.025);
  text-decoration:none;display:block;transition:border-color .12s ease,transform .12s ease}
.whubcard:hover{border-color:var(--cyan);transform:translateY(-2px)}
.whubcard h3{margin:0 0 4px;color:var(--cream);font-size:1.2rem}
.whubcard .n{color:var(--gold);font-weight:800;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase}
.whubcard p{margin:6px 0 0;color:var(--dim);font-size:.88rem}
.whubsection{margin:0 0 34px;scroll-margin-top:24px}
.whubsection-h{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
.whubsection-h h3{margin:0;color:var(--cream);font-size:1.08rem}
.whubsection-h span{color:var(--dim);font-size:.75rem}
@media (max-width:760px){
  .wshell{flex-direction:column;gap:18px}
  .wside{width:100%;max-height:none;position:static;overflow:visible;padding:0}
  .wgrid{grid-template-columns:1fr}
  .wfact-k,.wmeter-k{width:84px}
  .wraw dl{grid-template-columns:1fr}
  .wschedule li code{float:none;display:block;width:max-content;margin:2px 0 0}
  .wfeature{padding:16px}
  .wtopbar,.wshell{padding-left:16px;padding-right:16px}
}
@media (max-width:420px){
  .wcard{padding:14px}
  .wfact{flex-direction:column;gap:2px}
  .wfact-k{width:auto}
  .wmeter{display:grid;grid-template-columns:80px 1fr auto}
}
@media (prefers-reduced-motion:reduce){.whubcard{transition:none}}
.wf:focus-visible,.wsort:focus-visible,.wside a:focus-visible,.wraw summary:focus-visible,.wempty button:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
`;

// ---------------------------------------------------------------- card pieces
const tag = (text, ink) => `<span class="wtag${ink ? ` ink-${ink}` : ''}">${text}</span>`;
const fact = (k, v) => (v ? `<div class="wfact"><span class="wfact-k">${k}</span><span class="wfact-v">${v}</span></div>` : '');
const meter = (k, value, max, unit) => {
  const w = max > 0 ? Math.max(2, Math.round((Number(value) / max) * 100)) : 0;
  return `<div class="wmeter"><span class="wmeter-k">${k}</span>` +
    `<span class="wmeter-t"><i style="width:${w}%"></i></span>` +
    `<span class="wmeter-v">${num(value)}${unit ? `<span class="wmeter-u"> ${unit}</span>` : ''}</span></div>`;
};

/** Cross-page link to another wiki card. Every one of these is verified to
 *  resolve by the generator's own link check before anything is written, so a
 *  rename in src/data that breaks a relation fails the build rather than
 *  shipping a dead anchor nobody finds until a reader does. */
const cardLink = (page, id, text) => `<a href="wiki-${page}.html#e-${id}">${text}</a>`;

/** Pick the gloss the RUNTIME would pick: pattern first, then the params flag
 *  the dispatcher re-branches on. See the long comment on PATTERN_NOTE. */
const patternGloss = (entry) => {
  const table = PATTERN_NOTE[entry.pattern];
  if (!table) return '';
  for (const key of Object.keys(entry.params || {})) {
    if (key !== '_' && table[key]) return table[key];
  }
  return table._ || '';
};

// ================================================================ THE ROSTERS
export function rosterSpecs(D, esc, T = null) {
  const W = D.domains.weapons;
  const C = D.domains.coreWeapons;
  const E = D.domains.enemies;
  const R = D.domains.relics;
  const L = D.domains.levels;
  const P = D.domains.passives;
  const CH = D.domains.characters;
  const IN = D.domains.innates;
  const SG = D.domains.signatures;
  const EX = D.domains.expeditions;
  const A = D.domains.achievements;
  const RM = D.domains.runModes;
  const SC = D.domains.shipCores;
  const SF = D.domains.shipFragments;
  const LG = D.domains.legendaries;
  const UL = D.domains.ultimates;
  const EV = D.domains.evolutions;
  const BL = D.domains.shrineBlessings;
  const UT = D.domains.utilities;
  const WR = D.domains.wearables;
  const Q = D.domains.quests;
  const SH = D.domains.shop;
  const WE = D.domains.worldEvents;
  const AE = D.domains.ambientEvents;
  const SS = D.domains.shipSystems;
  const CO = D.domains.cosmetics;
  const JA = D.domains.jumpAugments;

  const levelName = (id) => L.entries[id]?.name || EX.entries[id]?.name || humanize(id);
  const charName = (id) => CH.entries[id]?.name || humanize(id);
  const passiveName = (id) => P.entries[id]?.name || humanize(id);
  const weaponName = (id) => W.entries[id]?.name || humanize(id);
  const coreName = (id) => C.entries[id]?.name || humanize(id);
  const enemyName = (id) => E.entries[id]?.name || humanize(id);
  const questName = (id) => Q.entries[id]?.title || humanize(id);

  const maxOf = (entries, of) => entries.reduce((m, e) => Math.max(m, Number(of(e)) || 0), 0);
  const ordered = (domain, map = (e) => e) => (domain.order || Object.keys(domain.entries))
    .map((id) => ({ id, entry: domain.entries[id] }))
    .filter(({ entry }) => entry !== undefined && entry !== null)
    .map(({ id, entry }) => map(entry, id));
  const colorHex = (value) => {
    if (typeof value === 'string') return value.startsWith('#') ? value : `#${value}`;
    if (!Number.isFinite(Number(value))) return '';
    return `#${(Number(value) >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
  };
  const bool = (value) => value ? 'Yes' : 'No';
  const cooldown = (value) => value > 0 ? `${num(value / 1000, 1)} seconds` : '';
  const sourceValue = (value) => value && typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);
  const sourceParams = (params, label = 'Source parameters') => {
    const rows = Object.entries(params || {});
    if (!rows.length) return '';
    return `<details class="wraw"><summary>${esc(label)} <span>${rows.length}</span></summary><dl>${rows
      .map(([key, value]) => `<div><dt><code>${esc(key)}</code></dt><dd>${esc(sourceValue(value))}</dd></div>`)
      .join('')}</dl></details>`;
  };
  const compactObject = (obj, format = (key, value) => `${humanize(key)} ${num(value)}`) => Object
    .entries(obj || {})
    .map(([key, value]) => format(key, value))
    .join(', ');
  const inverseUnlocks = new Map();
  for (const achievement of Object.values(A.entries)) {
    for (const [kind, id] of Object.entries(achievement.unlocks || {})) {
      const key = `${kind}:${id}`;
      if (!inverseUnlocks.has(key)) inverseUnlocks.set(key, []);
      inverseUnlocks.get(key).push(achievement);
    }
  }

  /* THE CLOCK, and this is the one a wiki gets wrong.
   *
   * Every `fromSec` on a spawn row and every `atSec` on a boss slot is measured
   * on the game's PACE clock, not on the clock the player is watching. The pace
   * clock runs faster than real time, so a boss slot written as 1800 is not
   * thirty minutes of play. Printing those numbers as minutes would put a wrong
   * time on all 53 bestiary cards, and it is the kind of wrong that looks right.
   *
   * The conversion is DERIVED, not assumed: paceScale is a field on every run
   * mode in the data layer. Two guards sit on it, because a conversion that
   * silently stops being valid is worse than no conversion:
   *
   *   1. every mode must agree on paceScale. If a mode ever diverges, the real
   *      time is mode-dependent, one number cannot state it, and this refuses.
   *   2. the linear relation only holds until the run banks, at
   *      bankAtElapsedSec. Past that the pace clock stops tracking, so any value
   *      beyond the bank is not converted.
   *
   * When either guard trips, `playClock` returns null and the caller prints the
   * raw pace figure with its clock named, rather than a confident wrong minute.
   * The generator reports which branch it took in the build output. */
  const modes = Object.values(D.domains.runModes.entries);
  const scales = [...new Set(modes.map((m) => m.paceScale).filter((s) => Number.isFinite(s) && s > 0))];
  const PACE = scales.length === 1 ? scales[0] : null;
  const BANK_PACE = PACE && modes.length
    ? Math.min(...modes.map((m) => (Number(m.bankAtElapsedSec) || 0) * m.paceScale))
    : 0;
  const playClock = (paceSec) => (PACE && paceSec <= BANK_PACE ? mmss(paceSec / PACE) : null);
  const clockNote = PACE
    ? `The game schedules on a clock that runs faster than the one you are watching, so these are converted: a slot written as ${mmss(600)} in the level tables lands about <b>${mmss(600 / PACE)}</b> into a real run. The conversion comes from the run mode’s own pace scale, and it holds up to the ${mmss(BANK_PACE / PACE)} mark where the pacing banks.`
    : 'The run modes no longer agree on their pace scale, so the times below are the game’s raw schedule figures and are deliberately not converted into minutes of play.';

  /* THE UNLOCK INVERSION, derived here rather than assumed. `unlockedFromStart`
   * covers only 10 of the 25 base weapons; the other 15 are gated behind an
   * achievement, and the edge is stored on the ACHIEVEMENT (`unlocks.weapon`),
   * not on the weapon. Same inversion the data layer does for spawn tables, done
   * here because the artifact does not ship this one yet. Worth handing upstream:
   * refs.unlockedBy belongs in bin/data-layer.mjs, next to refs.donorForCores. */
  const unlockedBy = new Map();
  for (const a of Object.values(A.entries)) {
    const wid = a.unlocks?.weapon;
    if (wid) {
      if (!unlockedBy.has(wid)) unlockedBy.set(wid, []);
      unlockedBy.get(wid).push(a);
    }
  }

  /* THE EVOLUTION RECIPE comes from the `evolutions` domain, which carries all
   * three parts of every row (base, tome, evolved) for all eight.
   *
   * NOT from refs.evolutionPassive on the weapon, which looks like the obvious
   * source and is not: it is present on exactly one of the eight base weapons in
   * the current artifact. Reading it would have silently dropped the tome from
   * seven of the eight cards, which is the sort of hole nobody spots because the
   * sentence still reads fine without it. Worth fixing upstream; the domain that
   * owns the recipe is complete, so this reads that instead. */
  const evoByBase = new Map();
  const evoByEvolved = new Map();
  for (const row of Object.values(D.domains.evolutions.entries)) {
    if (row.baseId) evoByBase.set(row.baseId, row);
    if (row.evolvedId) evoByEvolved.set(row.evolvedId, row);
  }

  // ---- weapons ------------------------------------------------------------
  const weaponEntries = W.order.map((id) => W.entries[id]).filter(Boolean);
  const evolvedWeaponCount = weaponEntries.filter((entry) => entry.evolved).length;
  const freshBaseWeaponCount = weaponEntries.filter((entry) => !entry.evolved && entry.unlockedFromStart).length;
  const wMax = {
    damage: maxOf(weaponEntries, (e) => e.baseDamage),
    range: maxOf(weaponEntries, (e) => e.range),
    speed: maxOf(weaponEntries, (e) => e.projectileSpeed),
  };

  /* CADENCE. A weapon with fireRateMs 0 is tick-driven and its real interval is
   * tickRateMs; src/sim/weapons.ts falls back to exactly that. Six weapons are on
   * that path, and printing "0 ms between shots" for them would be absurd as well
   * as wrong, so the card reads the same fallback the runtime does. */
  const cadenceMs = (e) => (e.fireRateMs > 0 ? e.fireRateMs : (e.tickRateMs ?? 250));
  const isTicker = (e) => !(e.fireRateMs > 0);

  /* DAMAGE AT MAX LEVEL. Fully determined by the data: src/sim/weapons.ts scales
   * LINEARLY when params.linearDamageScale is set and COMPOUNDS when it is not,
   * and that flag is in the artifact, so the branch here is the runtime's own
   * branch rather than an assumption about which one it uses. Deliberately no
   * player stats in it: might, crit and attack speed all multiply on top and are
   * not properties of the weapon. */
  const damageAtMax = (e) => {
    const n = (e.maxLevel || 1) - 1;
    if (n <= 0 || !e.perLevel?.damagePct) return null;
    const linear = !!e.params?.linearDamageScale;
    return e.baseDamage * (linear ? 1 + n * e.perLevel.damagePct : Math.pow(1 + e.perLevel.damagePct, n));
  };
  /* Cadence compounds unconditionally and is floored at 16 ms by the runtime. */
  const cadenceAtMax = (e) => {
    const n = (e.maxLevel || 1) - 1;
    const f = e.perLevel?.fireRateFactor;
    if (n <= 0 || !f || f === 1) return null;
    return Math.max(16, cadenceMs(e) * Math.pow(f, n));
  };

  /* HOW YOU GET IT is the first question a player asks about a weapon, so it
   * leads the card. Three real routes and every branch is a data relation.
   *
   * NOT USED: refs.inOfferPool. It reads like "this can be offered to you" and it
   * is not, it means exactly `evolved !== true`, so 15 achievement-locked weapons
   * carry it while being unreachable on a fresh save. Using it here would tell a
   * new player that Void Railgun is in their level-up pool. */
  const weaponAcquire = (e) => {
    const r = W.refs[e.id] || {};
    if (r.evolvesFrom) {
      const tome = evoByEvolved.get(e.id)?.passiveId;
      const base = W.entries[r.evolvesFrom];
      return `Take ${cardLink('weapons', r.evolvesFrom, esc(weaponName(r.evolvesFrom)))} to level <b>${base?.maxLevel ?? '?'}</b>${tome ? ` while holding ${cardLink('tomes', tome, esc(passiveName(tome)))}` : ''}, then open a boss chest.`;
    }
    const starts = r.startingCharacters?.length
      ? `${list(r.startingCharacters.map((id) => cardLink('characters', id, esc(charName(id)))))} start${r.startingCharacters.length === 1 ? 's' : ''} with it. `
      : '';
    if (e.unlockedFromStart) return `${starts}In the level-up pool from the first run.`;
    const quests = r.unlockedByQuests || [];
    if (quests.length) {
      return `${starts}Unlocked by ${list(quests.map((id) => cardLink('quests', id, esc(questName(id)))))}, then it joins the level-up pool.`;
    }
    const ach = unlockedBy.get(e.id) || [];
    if (ach.length) {
      return `${starts}Unlocked by ${list(ach.map((row) => cardLink('achievements', row.id, esc(row.name))))}${ach.length === 1 ? ` (${esc(ach[0].desc)})` : ''}, then it joins the level-up pool.`;
    }
    return starts || '';
  };

  const weaponsRoster = {
    section: 'Buildcraft',
    slug: 'weapons',
    domain: 'weapons',
    title: 'Weapons',
    tagline: 'The half of your build that fires itself.',
    lede: `Weapons fire on their own. You are offered them as you level, you level them up, and ${evolvedWeaponCount} of them are terminal forms reached with the right tome and a boss chest. The weapon you aim by hand is the core weapon, and it has its own page.`,
    omissions: 'There is no damage-per-second column here, and that is deliberate. The game does not compute one: your might and crit multiply the damage, your attack speed divides the interval, and half of these do not have "damage times shots per second" semantics in the first place. A beam ramps the longer it holds, chain jumps land a flat share of the first hit, the shotgun pays more up close. A single number would be wrong on most of these cards, so the page gives you the base figures and the growth rule and lets you compare like with like. <b>Element is a look, not a rule</b>: it picks the effect tint and nothing in the game reads it for damage, resistance or status.',
    entries: weaponEntries,
    groups: [
      {
        key: 'base',
        title: 'Base weapons',
        note: `What the level-up offer draws from, plus the ones a character brings with them. ${freshBaseWeaponCount} are available on a fresh save; the rest are behind an achievement, and each card says which.`,
        has: (e) => !e.evolved,
      },
      {
        key: 'evolved',
        title: 'Evolutions',
        note: 'Terminal forms, never offered directly. Each one is the payoff for maxing a specific weapon, holding its paired tome, and opening a boss chest. Turning it down is not permanent, the offer comes back at the next one.',
        has: (e) => !!e.evolved,
      },
    ],
    facets: [
      { key: 'element', label: 'Element', of: (e) => e.element },
      { key: 'pattern', label: 'How it fires', of: (e) => e.pattern },
      { key: 'access', label: 'Availability', of: (e) => (e.evolved ? 'evolution' : e.unlockedFromStart ? 'start' : 'achievement'), name: (v) => ({ start: 'From the start', achievement: 'Achievement', evolution: 'Evolution' }[v] || v) },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => weaponEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'damage', label: 'Base damage', of: (e) => e.baseDamage, desc: true },
      { key: 'range', label: 'Range', of: (e) => e.range, desc: true },
      { key: 'cadence', label: 'Fire interval', of: (e) => cadenceMs(e) },
    ],
    searchText: (e) => `${e.desc} ${e.element} ${e.pattern} weapon ${e.evolved ? 'evolution' : ''}`,
    card: (e) => {
      const r = W.refs[e.id] || {};
      const dMax = damageAtMax(e);
      const cMax = cadenceAtMax(e);
      const linear = !!e.params?.linearDamageScale;
      const grow = e.perLevel?.damagePct
        ? `<b>${pct(e.perLevel.damagePct)}</b> damage per level${linear ? '' : ', compounding'}`
        : '';
      return `
        <div class="wtags">
          ${e.evolved ? tag('Evolution', 'gold') : ''}
          ${tag(esc(humanize(e.element)), 'violet')}
          ${tag(esc(humanize(e.pattern)), 'cyan')}
        </div>
        <p class="wdesc">${esc(e.desc)}</p>
        ${patternGloss(e) ? `<p class="wgloss">${patternGloss(e)}</p>` : ''}
        <div class="wfacts">
          ${fact('How you get it', weaponAcquire(e))}
          ${fact('Cadence', isTicker(e)
    ? `ticks every <b>${num(cadenceMs(e))}</b> ms`
    : `<b>${num(e.fireRateMs)}</b> ms between shots${cMax ? ` <span class="wsub">, ${num(cMax)} at level ${e.maxLevel}</span>` : ''}`)}
          ${e.projectileCount > 1 ? fact('Projectiles', `<b>${e.projectileCount}</b> ${esc(humanize(e.shape)).toLowerCase()}s per shot, before level bonuses`) : fact('Shape', esc(humanize(e.shape)))}
          ${e.maxLevel > 1
    ? fact('Levels', `<b>${e.maxLevel}</b> max${grow ? `, ${grow}` : ''}${dMax ? ` <span class="wsub">, ${num(dMax)} damage at ${e.maxLevel}</span>` : ''}`)
    : fact('Levels', 'Arrives finished, it does not level.')}
          ${r.evolvesInto ? fact('Becomes', `${cardLink('weapons', r.evolvesInto, esc(weaponName(r.evolvesInto)))}${evoByBase.get(e.id)?.passiveId ? `, once you hold ${cardLink('tomes', evoByBase.get(e.id).passiveId, esc(passiveName(evoByBase.get(e.id).passiveId)))} and open a boss chest` : ''}`) : ''}
          ${r.donorForCores?.length ? fact('Core weapon', `${list(r.donorForCores.map((c) => cardLink('cores', c, esc(coreName(c)))))} is built on it`) : ''}
        </div>
        <div class="wmeters">
          ${meter('Base damage', e.baseDamage, wMax.damage)}
          ${e.range ? meter('Range', e.range, wMax.range, 'm') : ''}
          ${e.projectileSpeed ? meter('Shot speed', e.projectileSpeed, wMax.speed, 'm/s') : ''}
        </div>`;
    },
  };

  // ---- core weapons -------------------------------------------------------
  const coreEntries = C.selectOrder.map((id) => C.entries[id]).filter(Boolean);
  const forgivenessUnit = (key) => key.endsWith('Rad') ? 'rad' : key.endsWith('M') ? 'm' : 'unitless';
  const forgivenessDetails = (profile) => `<details class="wraw"><summary>Aim &amp; forgiveness <span>${Object.keys(profile).length} runtime fields</span></summary><dl>${Object.entries(profile)
    .map(([key, value]) => `<div><dt><code>${esc(key)}</code></dt><dd>${num(value, 4)} ${forgivenessUnit(key)}</dd></div>`)
    .join('')}</dl></details>`;
  const aimPolicyFeature = `
    <section class="wfeature" aria-labelledby="aim-policy">
      <div><span class="eyebrow">Global core mechanic</span><h3 id="aim-policy">Aim-assist policy</h3></div>
      <div class="wmethod-grid">
        ${(C.aimPolicy.assistLevels || []).map((level) => `<div><b>${esc(humanize(level))}</b><span>Assist scale</span><code>${num(C.aimPolicy.assistScale[level], 4)}</code></div>`).join('')}
        <div><b>${esc(humanize(C.aimPolicy.defaultAssist))}</b><span>Default assist level</span><code>${esc(C.aimPolicy.defaultAssist)}</code></div>
        <div><b>${esc(humanize(C.aimPolicy.duelAssist))}</b><span>Duel normalization</span><code>${esc(C.aimPolicy.duelAssist)}</code></div>
        <div><b>${num(C.aimPolicy.minimumRangeM)} m</b><span>Minimum acquisition range</span><code>minimumRangeM</code></div>
        <div><b>${list(C.aimPolicy.minimumRangeExempt.map((id) => cardLink('cores', id, esc(coreName(id)))))}</b><span>Range-floor exemption</span><code>minimumRangeExempt</code></div>
      </div>
      <p>These are targeting-assistance and forgiveness parameters. They are not damage values, weapon-strength scores or measured rankings.</p>
      ${sourceParams(C.aimPolicy.provenance, 'Aim-policy provenance')}
    </section>`;
  const coresRoster = {
    section: 'Buildcraft',
    slug: 'cores',
    domain: 'coreWeapons',
    title: 'Core weapons',
    tagline: 'The one you aim yourself.',
    lede: `A core weapon is the weapon under your hand, and picking one is the only decision that shapes a whole run before it starts. All ${C.count} are available on a fresh save, you take exactly one, and the draft can never offer you another. The technical targeting profile on each card is the complete runtime forgiveness row, not a rating.`,
    omissions: `No damage figures on this page, on purpose. Every clip size, reload, cooldown and damage multiplier for these ${C.count} lives outside the shared artifact, so this page will not retype private constants. The reserved evolution labels in the registry are not a playable mechanic and are not presented as available or upcoming content. <b>Aim and forgiveness values describe targeting generosity only</b>; they do not imply damage strength. The pip count is shown because the game suite pins it against the real clip size.`,
    featureHtml: aimPolicyFeature,
    entries: coreEntries,
    groups: [{ key: 'all', title: 'Core selection', note: 'In the source picker’s selectOrder. This is display order, not a ladder.', has: () => true }],
    facets: [
      { key: 'cadence', label: 'Rhythm', of: (e) => e.cadence },
      { key: 'feel', label: 'Asks you for', of: (e) => e.feel },
      { key: 'meter', label: 'Meter', of: (e) => e.meter },
    ],
    sorts: [
      { key: 'roster', label: 'Selection order', of: (e) => coreEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.desc} ${e.feel} ${e.cadence} core weapon ship core aimed`,
    /* The core's own colour, straight out of the registry, as the card's accent.
       The game already uses this exact value for this core in the picker, the aura
       and the telegraph, so reusing it is free recognition and it cannot drift. */
    accent: (e) => `#${(Number(e.color) >>> 0).toString(16).padStart(6, '0')}`,
    card: (e) => {
      const r = C.refs[e.id] || {};
      return `
        <div class="wtags">${tag(esc(humanize(e.cadence)), 'cyan')}${tag(esc(humanize(e.feel)), 'pink')}</div>
        <p class="wdesc">${esc(e.desc)}</p>
        ${CADENCE_NOTE[e.cadence] ? `<p class="wgloss">${CADENCE_NOTE[e.cadence]}</p>` : ''}
        <div class="wfacts">
          ${FEEL_NOTE[e.feel] ? fact('Asks you for', `<b>${esc(humanize(e.feel))}</b>, ${FEEL_NOTE[e.feel]}.`) : ''}
          ${fact('Meter', e.meter === 'discrete'
    ? `<b>${e.meterPips}</b> ${e.meterPips === 1 ? 'pip' : 'pips'} marked ${esc(e.cadenceLabel)}, spent one at a time`
    : `a continuous ${esc(e.cadenceLabel)} fill rather than countable shots`)}
          ${r.donorWeapon ? fact('Built on', `${cardLink('weapons', r.donorWeapon, esc(weaponName(r.donorWeapon)))}, which is where its damage is anchored`) : ''}
        </div>
        ${forgivenessDetails(r.forgiveness)}`;
    },
  };

  const powerCeilingEntries = Object.entries(D.powerCeiling.config).map(([id, value]) => ({
    id,
    name: id,
    value,
    system: id.startsWith('attackSpeed') ? 'attack speed' : 'crit product',
  }));
  const powerCeilingFeature = `
    <section class="wfeature" aria-labelledby="power-ceiling-semantics">
      <div><span class="eyebrow">Global system mechanic</span><h3 id="power-ceiling-semantics">Permanent-power soft knees</h3></div>
      ${(D.powerCeiling.semantics || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      ${sourceParams({ source: D.powerCeiling.source }, 'Power-ceiling provenance')}
    </section>`;
  const powerCeilingRoster = {
    section: 'Buildcraft',
    slug: 'power-ceilings',
    domain: null,
    sourceKind: 'source mechanic',
    title: 'Power soft knees',
    tagline: `${powerCeilingEntries.length} exported permanent-power dials, without an invented build result.`,
    lede: 'The root powerCeiling contract exposes its knee and factor fields. This guide prints the exact field names and values alongside the artifact’s own semantics.',
    omissions: '<b>No effective-power number is computed here.</b> The contract does not include a build’s permanent attack-speed bonus or crit product, and temporary buffs apply after these curves.',
    featureHtml: powerCeilingFeature,
    sourceLabel: D.powerCeiling.source,
    countLabel: `${powerCeilingEntries.length} source dials`,
    entries: powerCeilingEntries,
    groups: [{ key: 'all', title: 'Exported configuration', note: 'Every field in powerCeiling.config, in source order.', has: () => true }],
    facets: [{ key: 'system', label: 'System', of: (e) => e.system }],
    sorts: [
      { key: 'roster', label: 'Source order', of: (e) => powerCeilingEntries.indexOf(e) },
      { key: 'name', label: 'Field name', of: (e) => e.name, text: true },
      { key: 'value', label: 'Source value', of: (e) => e.value, desc: true },
    ],
    searchText: (e) => `${e.id} ${e.system} permanent power soft knee factor source mechanic`,
    card: (e) => `
      <div class="wtags">${tag(esc(humanize(e.system)), 'cyan')}${tag('Unitless source dial', 'violet')}</div>
      <div class="wfacts">
        ${fact('Field', `<code>${esc(e.id)}</code>`)}
        ${fact('Source value', `<b>${num(e.value, 4)}</b>`)}
      </div>`,
  };

  // ---- enemies ------------------------------------------------------------
  const enemyEntries = E.order.map((id) => E.entries[id]).filter(Boolean);
  /* Meters are only shown for the tiers whose registry numbers are the numbers
     the game actually uses, so the max is taken over those tiers too. A boss's
     registry hp would otherwise stretch every other bar flat AND be wrong. */
  const statTiers = new Set(['basic', 'special']);
  const statEntries = enemyEntries.filter((e) => statTiers.has(e.tier));
  const eMax = {
    hp: maxOf(statEntries, (e) => e.hp),
    damage: maxOf(statEntries, (e) => e.damage),
    xp: maxOf(statEntries, (e) => e.xp),
    speed: maxOf(enemyEntries, (e) => E.refs[e.id]?.speedProfile?.liveRunBaseMps),
  };

  const speedPolicyFeature = `
    <section class="wfeature" aria-labelledby="enemy-speed-policy">
      <div><span class="eyebrow">Canonical speed policy</span><h3 id="enemy-speed-policy">Authored base and live-run base</h3></div>
      <p>${(E.speedPolicy.semantics || []).map((line) => esc(line)).join(' ')}</p>
      <div class="wmethod-grid">
        ${(E.speedPolicy.bands || []).map((band) => `<div>
          <b>${band.unbounded ? 'Remaining speeds' : `Below ${num(band.maxExclusiveMps)} ${esc(E.speedPolicy.unit)}`}</b>
          <span>Live-run multiplier</span><code>&times; ${num(band.multiplier)}</code>
        </div>`).join('')}
      </div>
      ${sourceParams(E.speedPolicy.provenance, 'Speed provenance')}
    </section>`;

  /* WHERE YOU MEET IT. The question a bestiary exists to answer, and it is
   * answerable nowhere in src/data: the edge is on the LEVEL's spawn table, not
   * on the enemy. The data layer inverts it once; this reads the inversion.
   *
   * A kind can carry several rows for one level at different `fromSec`, and the
   * later ones are ADDITIVE weight, not a taper or an override. The earliest is
   * the only one this page claims, because "when do I first see this" depends
   * only on the smallest fromSec and is true whatever the later rows do. */
  /* Levels read in the game's own order, not alphabetically by internal id, and
     GROUPED BY WHEN the kind unlocks there. Blob is in all fourteen from the
     first second; listing fourteen names is a wall a reader skips, while "every
     campaign level, from the start" is the same fact and is actually read. The
     collapse only fires when the set genuinely covers every campaign level, so
     it can never overstate. */
  const levelRank = (id) => {
    const i = (L.order || []).indexOf(id);
    return i >= 0 ? i : 500 + (EX.order || []).indexOf(id);
  };
  const campaignAll = new Set(L.campaignLevelIds || []);

  const enemyWhere = (e) => {
    const rows = (E.refs[e.id] || {}).spawnsIn || [];
    if (!rows.length) return '';
    const first = new Map();
    for (const row of rows) {
      const prev = first.get(row.levelId);
      if (prev === undefined || row.fromSec < prev) first.set(row.levelId, row.fromSec);
    }
    const byTime = new Map();
    for (const [lvl, sec] of first) {
      if (!byTime.has(sec)) byTime.set(sec, []);
      byTime.get(sec).push(lvl);
    }
    return [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sec, levels]) => {
        const play = sec > 0 ? (playClock(sec) || `${sec} on the pace clock`) : null;
        const when = play ? ` <span class="wsub">from ${play}</span>` : ' <span class="wsub">from the start</span>';
        const camp = levels.filter((l) => campaignAll.has(l));
        const rest = levels.filter((l) => !campaignAll.has(l));
        const names = campaignAll.size > 0 && camp.length === campaignAll.size
          ? list(['every campaign level', ...rest.map((l) => cardLink(EX.entries[l] ? 'expeditions' : 'worlds', l, esc(levelName(l))))])
          : list(levels.sort((a, b) => levelRank(a) - levelRank(b)).map((l) => cardLink(EX.entries[l] ? 'expeditions' : 'worlds', l, esc(levelName(l)))));
        return `${names}${when}`;
      })
      .join('; ');
  };

  const enemyBoss = (e) => {
    const boss = (E.refs[e.id] || {}).bossIn || [];
    if (!boss.length) return '';
    const byTime = new Map();
    for (const b of boss) {
      if (!byTime.has(b.atSec)) byTime.set(b.atSec, []);
      byTime.get(b.atSec).push(b.levelId);
    }
    return [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([at, levels]) => {
        const play = playClock(at);
        return `<b>${play ? play : `${at} on the pace clock`}</b> into ${list(levels.map((id) => cardLink(EX.entries[id] ? 'expeditions' : 'worlds', id, esc(levelName(id)))))}`;
      })
      .join('; ');
  };

  const bestiaryRoster = {
    section: 'World',
    slug: 'bestiary',
    domain: 'enemies',
    title: 'Bestiary',
    tagline: 'Everything that wants to touch you.',
    lede: 'Every kind in the game, what it does, and where it turns up. Health, contact damage and XP are the values a kind starts a run with, before elapsed time, the level’s own multipliers and the opening grace period all scale them up, so read them against each other rather than as what you will meet at minute twelve.',
    omissions: `<b>Every time on this page is minutes of real play.</b> ${clockNote} <b>Live-run speed is a base, not a final chase speed.</b> The canonical policy says timed and per-instance multipliers still apply after the value shown here. <b>Boss and miniboss health and damage are UNMEASURED.</b> Runtime authority is private, multi-stage and mode-dependent, so the registry values for those two tiers are not published as encounter stats.`,
    featureHtml: speedPolicyFeature,
    entries: enemyEntries,
    groups: [
      { key: 'basic', title: 'Basic', note: 'The bulk of a run, and the only tier that can be promoted to an elite. Individually not the problem; the count is the problem.', has: (e) => e.tier === 'basic' },
      { key: 'special', title: 'Special', note: 'Kinds that change how a fight works rather than adding to its size. This is also the only tier where the listed behaviour actually runs, which is why the rest of this page is quieter about movement.', has: (e) => e.tier === 'special' },
      { key: 'miniboss', title: 'Minibosses', note: 'Not rolled from a spawn table. They arrive on a rotation, on the clock, and the boss director owns their numbers and their movement.', has: (e) => e.tier === 'miniboss' },
      { key: 'boss', title: 'Bosses', note: 'The run’s punctuation, scheduled per level rather than rolled. Their movement is directed rather than run off the behaviour below.', has: (e) => e.tier === 'boss' },
    ],
    facets: [
      { key: 'tier', label: 'Tier', of: (e) => e.tier },
      { key: 'behavior', label: 'Behaviour', of: (e) => e.behavior },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => enemyEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'hp', label: 'Published health', of: (e) => statTiers.has(e.tier) ? e.hp : undefined, desc: true },
      { key: 'damage', label: 'Published contact damage', of: (e) => statTiers.has(e.tier) ? e.damage : undefined, desc: true },
      { key: 'xp', label: 'Published XP', of: (e) => statTiers.has(e.tier) ? e.xp : undefined, desc: true },
      { key: 'speed', label: 'Live-run base speed', of: (e) => E.refs[e.id]?.speedProfile?.liveRunBaseMps, desc: true },
    ],
    searchText: (e) => `${e.tier} ${e.behavior} enemy monster`,
    card: (e) => {
      const r = E.refs[e.id] || {};
      const where = enemyWhere(e);
      const boss = enemyBoss(e);
      const showStats = statTiers.has(e.tier);
      const showBehaviour = showStats && BEHAVIOR_NOTE[e.behavior];
      const speed = r.speedProfile;
      return `
        <div class="wtags">
          ${tag(esc(humanize(e.tier)), e.tier === 'boss' ? 'pink' : e.tier === 'miniboss' ? 'gold' : e.tier === 'special' ? 'violet' : '')}
          ${tag(esc(humanize(e.behavior)), 'cyan')}
          ${speed?.liveRunBandApplied ? tag(`Speed &times;${num(speed.liveRunMultiplier)}`, 'gold') : tag('Base speed unchanged', '')}
          ${e.flying ? tag('Flying', 'cyan') : ''}
        </div>
        ${showBehaviour ? `<p class="wgloss">${BEHAVIOR_NOTE[e.behavior]}</p>` : ''}
        <div class="wfacts">
          ${boss ? fact('Arrives', boss) : ''}
          ${where ? fact('Found in', where) : ''}
          ${!where && !boss ? fact('Found in', 'No level rolls this kind from its spawn table. It reaches a run some other way.') : ''}
          ${arr(r.splitsFrom).length ? fact('Comes from', `killing ${list(arr(r.splitsFrom).map((s) => cardLink('bestiary', s, esc(enemyName(s)))))}`) : ''}
          ${arr(r.splitsInto).length ? fact('Leaves behind', `${e.onDeath?.split?.count > 1 ? `<b>${e.onDeath.split.count}</b> ` : ''}${list(arr(r.splitsInto).map((s) => cardLink('bestiary', s, esc(enemyName(s) + (e.onDeath?.split?.count > 1 ? 's' : '')))))} when it dies`) : ''}
          ${e.flying ? fact('Flying', 'Ignores the ground: pits and walls do not route it. It is still hit by everything a walker is.') : ''}
          ${speed ? fact('Speed profile', `<b>${num(speed.liveRunBaseMps)} ${esc(E.speedPolicy.unit)}</b> live-run base${speed.liveRunBandApplied ? `, from authored ${num(speed.authoredBaseMps)} ${esc(E.speedPolicy.unit)} at &times;${num(speed.liveRunMultiplier)}` : ', unchanged by the live-run band'}`) : ''}
          ${!showStats ? fact('Combat stats', '<b>UNMEASURED</b>: contextual health and damage are set through private, multi-stage runtime authority.') : ''}
        </div>
        <div class="wmeters">
          ${showStats ? meter('Health', e.hp, eMax.hp) : ''}
          ${showStats ? meter('Contact', e.damage, eMax.damage) : ''}
          ${showStats ? meter('XP', e.xp, eMax.xp) : ''}
          ${speed ? meter('Profile speed', speed.liveRunBaseMps, eMax.speed, E.speedPolicy.unit) : ''}
        </div>`;
    },
  };

  // ---- relics -------------------------------------------------------------
  const relicEntries = ordered(R);
  const relicsRoster = {
    section: 'Buildcraft',
    slug: 'relics',
    domain: 'relics',
    title: 'Relics',
    tagline: 'Stackable finds, with every trade written down.',
    lede: 'Relics are stackable run pickups. Their cards carry the game description, rarity, stack ceiling, source stat payload and whether the arena draft includes them.',
    omissions: 'There is no relic tier letter here. The measurement artifact explicitly does not cover relics because a relic needs a reference build and chest-economy model before its delta means anything. The roster is complete; the ranking is honestly unmeasured.',
    entries: relicEntries,
    groups: ['common', 'rare', 'epic', 'legendary'].map((rarity) => ({
      key: rarity,
      title: humanize(rarity),
      note: R.baseWeights?.[rarity] !== undefined ? `Base rarity weight ${R.baseWeights[rarity]}.` : '',
      has: (e) => e.rarity === rarity,
    })),
    facets: [
      { key: 'rarity', label: 'Rarity', of: (e) => e.rarity },
      { key: 'effect', label: 'Effect source', of: (e) => e.event ? 'runtime event' : 'stat payload' },
      { key: 'arena', label: 'Arena draft', of: (e) => R.refs[e.id]?.inArenaPool ? 'included' : 'not included' },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => relicEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'stacks', label: 'Max stacks', of: (e) => e.maxStacks, desc: true },
    ],
    searchText: (e) => `${e.desc} ${e.flavor} ${e.rarity} relic ${Object.keys(e.stats || {}).join(' ')}`,
    card: (e) => `
      <div class="wtags">${tag(esc(humanize(e.rarity)), e.rarity === 'legendary' ? 'gold' : e.rarity === 'epic' ? 'pink' : e.rarity === 'rare' ? 'violet' : '')}${e.event ? tag('Runtime effect', 'cyan') : tag('Stat effect', 'cyan')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      ${e.flavor ? `<p class="wgloss">${esc(e.flavor)}</p>` : ''}
      <div class="wfacts">
        ${fact('Stack ceiling', `<b>${e.maxStacks}</b>`)}
        ${fact('Arena draft', R.refs[e.id]?.inArenaPool ? 'Included' : 'Not included')}
      </div>
      ${sourceParams(e.stats, 'Canonical stat payload')}`,
  };

  // ---- tomes --------------------------------------------------------------
  const passiveEntries = ordered(P);
  const evolutionsByPassive = new Map();
  for (const row of Object.values(EV.entries)) {
    if (!evolutionsByPassive.has(row.passiveId)) evolutionsByPassive.set(row.passiveId, []);
    evolutionsByPassive.get(row.passiveId).push(row);
  }
  const tomesRoster = {
    section: 'Buildcraft',
    slug: 'tomes',
    domain: 'passives',
    title: 'Tomes',
    tagline: 'The stat half of your build.',
    lede: 'Tomes level a named player stat. Every card shows the registry description, exact per-level payload, maximum level, unlock route and any weapon evolution recipe that requires it.',
    omissions: 'There is no tome tier letter here. The measurement artifact says a tome is a delta against a reference build, and that reference has not been chosen or measured. A made-up order would turn complete source data into an unsupported claim.',
    entries: passiveEntries,
    groups: [
      { key: 'start', title: 'Available from the start', note: 'In the tome pool on a fresh save.', has: (e) => e.unlockedFromStart },
      { key: 'earned', title: 'Achievement unlocks', note: 'Each card links to the achievement that adds it.', has: (e) => !e.unlockedFromStart },
    ],
    facets: [
      { key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'achievement' },
      { key: 'stat', label: 'Stat', of: (e) => e.stat },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => passiveEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'levels', label: 'Max level', of: (e) => e.maxLevel, desc: true },
    ],
    searchText: (e) => `${e.desc} ${e.stat} tome passive ${e.unlockedFromStart ? 'start' : 'achievement'}`,
    card: (e) => {
      const unlocks = inverseUnlocks.get(`passive:${e.id}`) || [];
      const recipes = evolutionsByPassive.get(e.id) || [];
      return `
        <div class="wtags">${tag(esc(humanize(e.stat)), 'cyan')}${tag(e.unlockedFromStart ? 'From the start' : 'Achievement', e.unlockedFromStart ? '' : 'gold')}</div>
        <p class="wdesc">${esc(e.desc)}</p>
        <div class="wfacts">
          ${fact('Levels', `<b>${e.maxLevel}</b> max, source payload <b>${num(e.perLevel)}</b> per level${e.shieldRegenPerLevel !== undefined ? `, shield regen <b>${num(e.shieldRegenPerLevel)}</b> per level` : ''}`)}
          ${unlocks.length ? fact('Unlocked by', list(unlocks.map((row) => cardLink('achievements', row.id, esc(row.name))))) : fact('Availability', 'In the tome pool from the first run.')}
          ${recipes.length ? fact('Evolution key', list(recipes.map((row) => `${cardLink('weapons', row.baseId, esc(weaponName(row.baseId)))} into ${cardLink('weapons', row.evolvedId, esc(weaponName(row.evolvedId)))}`))) : ''}
        </div>`;
    },
  };

  // ---- legendary upgrades -------------------------------------------------
  const legendaryEntries = ordered(LG);
  const legendariesRoster = {
    section: 'Buildcraft',
    slug: 'legendaries',
    domain: 'legendaries',
    title: 'Legendary upgrades',
    tagline: 'Run-defining effects with their real payload attached.',
    lede: `The legendary registry contains ${legendaryEntries.length} upgrades. The shared artifact also sets the run cap to ${LG.cap}; each card reproduces the canonical description, effect line and parameter payload.`,
    entries: legendaryEntries,
    groups: [{ key: 'all', title: 'Legendary pool', note: `A run can hold up to ${LG.cap}.`, has: () => true }],
    facets: [{ key: 'shape', label: 'Parameter shape', of: (e) => Object.keys(e.params || {}).length > 1 ? 'multi-part' : 'single-part' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => legendaryEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.desc} ${e.effect} legendary ${Object.keys(e.params || {}).join(' ')}`,
    accent: (e) => colorHex(e.color),
    card: (e) => `
      <div class="wtags">${tag('Legendary', 'gold')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <p class="wgloss">${esc(e.effect)}</p>
      ${sourceParams(e.params)}`,
  };

  // ---- shrine blessings ---------------------------------------------------
  const blessingEntries = ordered(BL);
  const blessingsRoster = {
    section: 'Buildcraft',
    slug: 'blessings',
    domain: 'shrineBlessings',
    title: 'Shrine blessings',
    tagline: `${blessingEntries.length} shrine outcomes, exactly as authored.`,
    lede: 'Blessings are the shrine offer pool. Each card carries the source description, target stat, exact value, glyph and color used by the game.',
    entries: blessingEntries,
    groups: [{ key: 'all', title: 'Blessing pool', note: 'All authored shrine outcomes.', has: () => true }],
    facets: [{ key: 'stat', label: 'Stat', of: (e) => e.stat }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => blessingEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'value', label: 'Source value', of: (e) => e.value, desc: true },
    ],
    searchText: (e) => `${e.desc} ${e.stat} blessing shrine ${e.glyph}`,
    accent: (e) => colorHex(e.color),
    card: (e) => `
      <div class="wtags">${tag(esc(humanize(e.stat)), 'cyan')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">${fact('Source value', `<b>${num(e.value)}</b> applied to <code>${esc(e.stat)}</code>`)}${fact('Glyph', `<b>${esc(e.glyph)}</b>`)}</div>`,
  };

  // ---- utility abilities --------------------------------------------------
  const utilityEntries = ordered(UT);
  const utilitiesRoster = {
    section: 'Buildcraft',
    slug: 'utilities',
    domain: 'utilities',
    title: 'Utility abilities',
    tagline: 'Your F-slot options, costs and cooldowns.',
    lede: 'The utility registry defines the complete selectable F-slot pool. Every current entry is implemented; cards show targeting, availability, gold cost, cooldown and the exact source parameters.',
    entries: utilityEntries,
    groups: [
      { key: 'starter', title: 'Starter utility', note: 'Selected by the starter id in the shared artifact.', has: (e) => e.id === UT.starterId },
      { key: 'forge', title: 'Unlockable utilities', note: 'The remaining implemented utility choices.', has: (e) => e.id !== UT.starterId },
    ],
    facets: [
      { key: 'targeting', label: 'Targeting', of: (e) => e.targeted ? 'targeted' : 'immediate' },
      { key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'unlockable' },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => utilityEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'cooldown', label: 'Cooldown', of: (e) => e.cooldownMs },
      { key: 'cost', label: 'Gold cost', of: (e) => e.costGold },
    ],
    searchText: (e) => `${e.desc} utility ability f slot ${e.targeted ? 'targeted' : 'immediate'} ${Object.keys(e.params || {}).join(' ')}`,
    accent: (e) => colorHex(e.color),
    card: (e) => `
      <div class="wtags">${tag(e.implemented ? 'Implemented' : 'Not implemented', e.implemented ? 'cyan' : 'pink')}${tag(e.targeted ? 'Targeted' : 'Immediate', 'violet')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${fact('Cooldown', `<b>${cooldown(e.cooldownMs)}</b>`)}
        ${fact('Availability', e.unlockedFromStart ? 'From the start' : `<b>${e.costGold}</b> gold`)}
        ${fact('Glyph', `<b>${esc(e.glyph)}</b>`)}
      </div>
      ${sourceParams(e.params)}`,
  };

  // ---- boss ultimate ------------------------------------------------------
  const ultimateEntries = ordered(UL);
  const ultimatesRoster = {
    section: 'Buildcraft',
    slug: 'ultimates',
    domain: 'ultimates',
    title: 'Boss ultimates',
    tagline: 'The stealable Q-slot registry.',
    lede: 'This page reflects the complete ultimate registry, including the canonical description, cooldown and source parameter payload.',
    entries: ultimateEntries,
    groups: [{ key: 'all', title: 'Ultimate registry', note: 'Every registered boss ultimate.', has: () => true }],
    facets: [],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => ultimateEntries.indexOf(e) }],
    searchText: (e) => `${e.desc} ultimate boss q slot ${Object.keys(e.params || {}).join(' ')}`,
    card: (e) => `
      <div class="wtags">${tag('Ultimate', 'pink')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">${fact('Cooldown', `<b>${cooldown(e.cooldownMs)}</b>`)}</div>
      ${sourceParams(e.params)}`,
  };

  // ---- evolution recipes --------------------------------------------------
  const evolutionEntries = ordered(EV, (row) => ({
    ...row,
    id: row.evolvedId,
    name: `${weaponName(row.baseId)} to ${weaponName(row.evolvedId)}`,
  }));
  const evolutionsRoster = {
    section: 'Buildcraft',
    slug: 'evolutions',
    domain: 'evolutions',
    title: 'Evolution recipes',
    tagline: 'Every base weapon, tome and terminal form.',
    lede: 'Each recipe is one complete three-way relation from the game data: max the base weapon, hold the named tome, then take the evolved result from a boss chest.',
    entries: evolutionEntries,
    groups: [{ key: 'all', title: 'Recipes', note: 'The complete evolution registry.', has: () => true }],
    facets: [],
    sorts: [
      { key: 'roster', label: 'Registry order', of: (e) => evolutionEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${weaponName(e.baseId)} ${weaponName(e.evolvedId)} ${passiveName(e.passiveId)} weapon tome evolution recipe`,
    card: (e) => `
      <div class="wtags">${tag('Recipe', 'gold')}</div>
      <div class="wequation" aria-label="${esc(`${weaponName(e.baseId)} plus ${passiveName(e.passiveId)} becomes ${weaponName(e.evolvedId)}`)}">
        ${cardLink('weapons', e.baseId, esc(weaponName(e.baseId)))} <b>+</b>
        ${cardLink('tomes', e.passiveId, esc(passiveName(e.passiveId)))} <b>=</b>
        ${cardLink('weapons', e.evolvedId, esc(weaponName(e.evolvedId)))}
      </div>`,
  };

  // ---- jump augments ------------------------------------------------------
  const jumpEntries = ordered(JA);
  const jumpAugmentsRoster = {
    section: 'Buildcraft',
    slug: 'jump-augments',
    domain: 'jumpAugments',
    title: 'Jump augments',
    tagline: 'Chest-only movement upgrades.',
    lede: 'The jump augment registry is small and complete. Each card carries the canonical description, target stat, per-level payload and any level ceiling defined by the source.',
    entries: jumpEntries,
    groups: [{ key: 'all', title: 'Augments', note: 'Every registered jump augment.', has: () => true }],
    facets: [{ key: 'stat', label: 'Stat', of: (e) => e.stat }],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => jumpEntries.indexOf(e) }],
    searchText: (e) => `${e.desc} ${e.stat} jump movement augment`,
    accent: (e) => colorHex(e.color),
    card: (e) => `
      <div class="wtags">${tag(esc(humanize(e.stat)), 'cyan')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">${fact('Source payload', `<b>${num(e.perLevel)}</b> per level${e.maxLevel ? `, <b>${e.maxLevel}</b> levels max` : ''}`)}</div>`,
  };

  // ---- characters ---------------------------------------------------------
  const characterEntries = ordered(CH);
  const charactersRoster = {
    section: 'Heroes',
    slug: 'characters',
    domain: 'characters',
    title: 'Characters',
    tagline: 'Base stats, starting kit and movement identity.',
    lede: 'Each character card composes the canonical character, starting-weapon, innate and signature registries. Base health, speed and might are printed as stored, with no normalized score hiding the trade.',
    entries: characterEntries,
    groups: [
      { key: 'start', title: 'Character roster', note: 'The complete selectable roster in source order.', has: () => true },
    ],
    facets: [
      { key: 'weapon', label: 'Starting weapon', of: (e) => e.startWeaponId, name: weaponName },
      { key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'unlockable' },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => characterEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'health', label: 'Base health', of: (e) => e.baseStats?.maxHp, desc: true },
      { key: 'speed', label: 'Base speed', of: (e) => e.baseStats?.speed, desc: true },
      { key: 'might', label: 'Base might', of: (e) => e.baseStats?.might, desc: true },
    ],
    searchText: (e) => `${e.desc} character hero ${weaponName(e.startWeaponId)} ${IN.entries[e.innateId]?.name || ''} ${SG.entries[e.signatureId]?.name || ''}`,
    card: (e) => `
      <div class="wtags">${tag(e.unlockedFromStart ? 'From the start' : 'Unlockable', e.unlockedFromStart ? 'cyan' : 'gold')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${fact('Starting weapon', cardLink('weapons', e.startWeaponId, esc(weaponName(e.startWeaponId))))}
        ${fact('Innate', cardLink('innates', e.innateId, esc(IN.entries[e.innateId]?.name || humanize(e.innateId))))}
        ${fact('Signature', cardLink('signatures', e.signatureId, esc(SG.entries[e.signatureId]?.name || humanize(e.signatureId))))}
        ${fact('Base stats', `<b>${num(e.baseStats?.maxHp)}</b> health, <b>${num(e.baseStats?.speed)}</b> speed, <b>${num(e.baseStats?.might)}</b> might`)}
      </div>`,
  };

  // ---- innates ------------------------------------------------------------
  const innateEntries = ordered(IN);
  const innatesRoster = {
    section: 'Heroes',
    slug: 'innates',
    domain: 'innates',
    title: 'Innates',
    tagline: 'The passive rule each character brings.',
    lede: 'Innates are character-bound passive rules. The character-select sentence is canonical copy; base, growth and cap are read from the same registry row.',
    entries: innateEntries,
    groups: [{ key: 'all', title: 'Innate roster', note: 'One source entry per character-bound innate.', has: () => true }],
    facets: [
      { key: 'effect', label: 'Effect', of: (e) => e.effect },
      { key: 'value', label: 'Value kind', of: (e) => e.valueKind },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => innateEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.characterSelectCopy} ${e.effect} ${e.valueKind} innate passive ${(IN.refs[e.id]?.characters || []).map(charName).join(' ')}`,
    card: (e) => {
      const format = (value) => e.valueKind === 'fraction' ? pct(Number(value)) : num(value);
      return `
        <div class="wtags">${tag(esc(humanize(e.effect)), 'cyan')}${tag(esc(humanize(e.valueKind)), 'violet')}</div>
        <p class="wdesc">${esc(e.characterSelectCopy)}</p>
        <div class="wfacts">
          ${fact('Character', list((IN.refs[e.id]?.characters || []).map((id) => cardLink('characters', id, esc(charName(id))))))}
          ${fact('Source curve', `<b>${format(e.base)}</b> base, <b>${format(e.growth)}</b> growth per level, <b>${format(e.cap)}</b> cap`)}
        </div>
        ${e.context ? sourceParams(e.context, 'Context parameters') : ''}`;
    },
  };

  // ---- signatures ---------------------------------------------------------
  const signatureEntries = ordered(SG);
  const signaturesRoster = {
    section: 'Heroes',
    slug: 'signatures',
    domain: 'signatures',
    title: 'Signatures',
    tagline: 'The R-slot move that defines each character.',
    lede: 'Every signature card shows the canonical action sentence, cooldown, bound character and full source parameter payload.',
    entries: signatureEntries,
    groups: [{ key: 'all', title: 'Signature roster', note: 'One registered signature per character.', has: () => true }],
    facets: [{ key: 'cooldown', label: 'Cooldown band', of: (e) => e.cooldownMs <= 8000 ? '8 seconds or less' : e.cooldownMs <= 15000 ? '9 to 15 seconds' : 'over 15 seconds' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => signatureEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'cooldown', label: 'Cooldown', of: (e) => e.cooldownMs },
    ],
    searchText: (e) => `${e.desc} signature r slot ${(SG.refs[e.id]?.characters || []).map(charName).join(' ')} ${Object.keys(e.params || {}).join(' ')}`,
    card: (e) => `
      <div class="wtags">${tag('Signature', 'pink')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${fact('Character', list((SG.refs[e.id]?.characters || []).map((id) => cardLink('characters', id, esc(charName(id))))))}
        ${fact('Cooldown', `<b>${cooldown(e.cooldownMs)}</b>`)}
      </div>
      ${sourceParams(e.params)}`,
  };

  // ---- worlds and expeditions --------------------------------------------
  const scheduleTime = (paceSec) => paceSec > 0
    ? (playClock(paceSec) ? `${playClock(paceSec)} into a real run` : `${paceSec} on the pace clock`)
    : 'from the start';
  const spawnDetails = (e) => `<details class="wraw wschedule"><summary>Spawn schedule <span>${e.spawnTable?.length || 0}</span></summary><ol>${(e.spawnTable || [])
    .map((row) => `<li>${cardLink('bestiary', row.kindId, esc(enemyName(row.kindId)))} <span>${esc(scheduleTime(row.fromSec))}</span><code>weight ${num(row.weight)}</code></li>`)
    .join('')}</ol></details>`;
  const bossDetails = (e) => `<details class="wraw wschedule"><summary>Boss schedule <span>${e.bosses?.length || 0}</span></summary><ol>${(e.bosses || [])
    .map((row) => `<li>${cardLink('bestiary', row.kindId, esc(enemyName(row.kindId)))} <span>${esc(scheduleTime(row.atSec))}</span>${row.signature ? '<code>signature slot</code>' : ''}</li>`)
    .join('')}</ol></details>`;
  const worldCard = (e, refs) => {
    const surfaceNames = Object.entries(e.surfaces || {}).filter(([, enabled]) => enabled).map(([key]) => humanize(key));
    const unlockedById = refs?.unlockedBy;
    const trigger = e.unlockTrigger ? compactObject(e.unlockTrigger, (key, value) => `${humanize(key)} ${value}`) : '';
    return `
      <div class="wtags">${surfaceNames.map((name) => tag(esc(name), 'cyan')).join('')}${e.unlockedFromStart ? tag('From the start', 'gold') : ''}</div>
      <p class="wdesc">${esc(e.tagline)}</p>
      <div class="wfacts">
        ${fact('Availability', e.unlockedFromStart ? 'From the start' : unlockedById ? `Unlocked after ${cardLink('worlds', unlockedById, esc(levelName(unlockedById)))}` : trigger ? esc(trigger) : 'The registry carries no simple predecessor')}
        ${refs?.unlocksName ? fact('Unlocks next', cardLink('worlds', e.unlocks, esc(refs.unlocksName))) : ''}
        ${refs?.shipCore ? fact('Ship core', cardLink('ship-cores', refs.shipCore, esc(refs.shipCoreName))) : ''}
        ${refs?.worldEvents?.length ? fact('Rare events', list(refs.worldEvents.map((id) => cardLink('world-events', id, esc(humanize(id)))))) : ''}
        ${refs?.ambientEvents?.length ? fact('Ambient events', list(refs.ambientEvents.map((row) => cardLink('ambient-events', e.id, esc(humanize(row.event)))))) : ''}
        ${fact('World fixtures', `<b>${e.shrineCount}</b> shrines, <b>${e.launchPads}</b> launch pads`)}
      </div>
      ${sourceParams(e.tuning, 'World tuning multipliers')}
      ${spawnDetails(e)}
      ${bossDetails(e)}`;
  };

  const worldEntries = ordered(L);
  const worldsRoster = {
    section: 'World',
    slug: 'worlds',
    domain: 'levels',
    title: 'Campaign worlds',
    tagline: 'The arenas, unlock chain and encounter schedules.',
    lede: 'Every campaign world card joins its authored identity to the exact tuning, surfaces, fixtures, unlock relation, spawn schedule, boss schedule and recovered ship core in the shared artifact.',
    omissions: `<b>Schedule times are converted only while the shared pace scale is valid.</b> ${clockNote}`,
    entries: worldEntries,
    groups: [
      { key: 'campaign', title: 'Campaign route', note: 'World ids named by the canonical campaign list.', has: (e) => (L.campaignLevelIds || []).includes(e.id) },
      { key: 'additional', title: 'Additional campaign worlds', note: 'Registered campaign worlds outside the primary campaign id list.', has: (e) => !(L.campaignLevelIds || []).includes(e.id) },
    ],
    facets: [
      { key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'unlockable' },
      { key: 'water', label: 'Water surface', of: (e) => e.surfaces?.water ? 'present' : 'absent' },
      { key: 'oil', label: 'Oil surface', of: (e) => e.surfaces?.oil ? 'present' : 'absent' },
    ],
    sorts: [
      { key: 'roster', label: 'World order', of: (e) => worldEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'hp', label: 'Health multiplier', of: (e) => e.tuning?.hpMult, desc: true },
      { key: 'pressure', label: 'Spawn-rate multiplier', of: (e) => e.tuning?.spawnRateMult, desc: true },
    ],
    searchText: (e) => `${e.tagline} campaign world level ${e.paletteId} ${e.terrainId || ''} ${(L.refs[e.id]?.enemyNames || []).join(' ')} ${(L.refs[e.id]?.bossNames || []).join(' ')}`,
    accent: (e) => colorHex(e.cardAccent),
    card: (e) => worldCard(e, L.refs[e.id] || {}),
  };

  const expeditionEntries = ordered(EX);
  const expeditionsRoster = {
    section: 'World',
    slug: 'expeditions',
    domain: 'expeditions',
    title: 'Expeditions',
    tagline: 'Standalone arenas with complete encounter schedules.',
    lede: 'Expeditions use the same canonical level shape as campaign worlds but sit in their own source domain. Every spawn, boss, fixture, surface and tuning multiplier is shown from that domain.',
    omissions: `<b>Schedule times are converted only while the shared pace scale is valid.</b> ${clockNote}`,
    entries: expeditionEntries,
    groups: [{ key: 'all', title: 'Expedition roster', note: 'Every registered expedition.', has: () => true }],
    facets: [{ key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'unlockable' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => expeditionEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.tagline} expedition arena ${e.paletteId} ${(EX.refs[e.id]?.enemyKinds || []).map(enemyName).join(' ')}`,
    card: (e) => worldCard(e, EX.refs[e.id] || {}),
  };

  // ---- run modes ----------------------------------------------------------
  const modeEntries = ordered(RM, (e) => ({ ...e, name: humanize(e.id) }));
  const runModesRoster = {
    section: 'World',
    slug: 'modes',
    domain: 'runModes',
    title: 'Run modes',
    tagline: 'The pacing and movement profiles a run actually reads.',
    lede: 'Run modes are complete configuration profiles. The player-facing timing summary is derived from their pace clock and bank; the full profile remains available as source parameters on each card.',
    entries: modeEntries,
    groups: [{ key: 'all', title: 'Mode profiles', note: 'Every registered run-mode profile.', has: () => true }],
    facets: [
      { key: 'flyers', label: 'Flying enemies', of: (e) => e.allowFlyers ? 'enabled' : 'disabled' },
      { key: 'ladder', label: 'Tier ladder', of: (e) => e.tierLadderEnabled ? 'enabled' : 'disabled' },
    ],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => modeEntries.indexOf(e) }],
    searchText: (e) => `${e.id} run mode pace endless movement camera flyers events`,
    card: (e) => `
      <div class="wtags">${tag(e.allowFlyers ? 'Flyers enabled' : 'No flyers', 'cyan')}${tag(e.tierLadderEnabled ? 'Tier ladder' : 'No tier ladder', 'violet')}</div>
      <div class="wfacts">
        ${fact('Pace clock', `<b>${num(e.paceScale)}</b> pace seconds per real second`)}
        ${fact('Pacing bank', `<b>${mmss(e.bankAtElapsedSec)}</b> real time`)}
        ${fact('Final horde', `<b>${playClock(e.finalHordeAtPaceSec) || `${e.finalHordeAtPaceSec} pace seconds`}</b>`)}
        ${fact('Victory choice', bool(e.offersVictoryChoice))}
        ${fact('Opening health bonus', pct(e.openingHpBonusPct))}
        ${fact('World events', `<b>${e.earthyWorldEventCount}</b> earthy, <b>${e.otherWorldEventCount}</b> other, ${esc(humanize(e.worldEventSelection))}`)}
      </div>
      ${sourceParams(Object.fromEntries(Object.entries(e).filter(([key]) => !['id', 'name'].includes(key))), 'Complete mode profile')}`,
  };

  // ---- rare and ambient world events -------------------------------------
  const worldEventEntries = ordered(WE, (e) => ({ ...e, name: humanize(e.id) }));
  const worldEventFeature = `
    <section class="wfeature" aria-labelledby="world-event-policy">
      <div><span class="eyebrow">Placement contract</span><h3 id="world-event-policy">Rare-event policy</h3></div>
      <p>The values below are emitted by the same source contract as the event allow-lists.</p>
      ${sourceParams(WE.placementPolicy, 'Placement policy')}
      ${sourceParams(WE.provenance, 'Event provenance')}
    </section>`;
  const worldEventsRoster = {
    section: 'World',
    slug: 'world-events',
    domain: 'worldEvents',
    title: 'Rare world events',
    tagline: 'The discoverable event pool and its exact world allow-lists.',
    lede: 'This catalog publishes only what the canonical rare-event contract supplies: registry id, weight, per-run cap, spacing and validated campaign or expedition availability.',
    featureHtml: worldEventFeature,
    entries: worldEventEntries,
    groups: [{ key: 'all', title: 'Rare-event registry', note: 'Every source-defined rare world event.', has: () => true }],
    facets: [
      { key: 'expedition', label: 'Expedition eligible', of: (e) => WE.refs[e.id]?.expeditions?.length ? 'yes' : 'no' },
      { key: 'worlds', label: 'World coverage', of: (e) => e.allowedWorlds.length === WE.allEventWorlds.length ? 'all listed worlds' : `${e.allowedWorlds.length} listed worlds` },
    ],
    sorts: [
      { key: 'roster', label: 'Registry order', of: (e) => worldEventEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'weight', label: 'Weight', of: (e) => e.weight, desc: true },
    ],
    searchText: (e) => `${e.id} rare world event weight ${(WE.refs[e.id]?.campaignLevels || []).map(levelName).join(' ')} ${(WE.refs[e.id]?.expeditions || []).map(levelName).join(' ')}`,
    card: (e) => {
      const refs = WE.refs[e.id] || {};
      return `
        <div class="wtags">${tag('Rare event', 'gold')}${tag(`${e.allowedWorlds.length} worlds`, 'cyan')}</div>
        <div class="wfacts">
          ${fact('Weight', `<b>${num(e.weight)}</b>`)}
          ${fact('Per-run cap', `<b>${num(e.maxPerRun)}</b>`)}
          ${fact('Minimum spacing', `<b>${num(e.minSpacingM)} m</b>`)}
          ${refs.campaignLevels?.length ? fact('Campaign', list(refs.campaignLevels.map((id) => cardLink('worlds', id, esc(levelName(id)))))) : ''}
          ${refs.expeditions?.length ? fact('Expeditions', list(refs.expeditions.map((id) => cardLink('expeditions', id, esc(levelName(id)))))) : ''}
        </div>`;
    },
  };

  const ambientEntries = ordered(AE, (events, id) => ({ id, name: levelName(id), events }));
  const ambientKindCounts = new Map((AE.eventKinds || []).map((kind) => [kind, 0]));
  for (const entry of ambientEntries) {
    for (const row of entry.events) ambientKindCounts.set(row.event, (ambientKindCounts.get(row.event) || 0) + 1);
  }
  const ambientFeature = `
    <section class="wfeature" aria-labelledby="ambient-source-tuning">
      <div><span class="eyebrow">World-keyed source table</span><h3 id="ambient-source-tuning">Observed event kinds and source tuning blocks</h3></div>
      <div class="wmethod-grid">
        ${(AE.eventKinds || []).map((kind) => `<div><b>${esc(humanize(kind))}</b><span>World-table occurrences</span><code>${ambientKindCounts.get(kind) || 0}</code></div>`).join('')}
      </div>
      <p>The source contract exposes tuning blocks under their own keys. They are printed independently; this page does not invent aliases between a placement event id and a tuning-block id.</p>
      ${Object.entries(AE.config || {}).map(([key, value]) => sourceParams(value, `${humanize(key)} tuning block`)).join('')}
      ${sourceParams({ seedSalt: AE.seedSalt, ...AE.provenance }, 'Ambient provenance')}
    </section>`;
  const ambientEventsRoster = {
    section: 'World',
    slug: 'ambient-events',
    domain: 'ambientEvents',
    title: 'Ambient events',
    tagline: 'The exact event and theme placements registered per world.',
    lede: 'The source is world-keyed, so this guide keeps that shape: one card per campaign world or expedition, with every verbatim event id and theme id listed together.',
    featureHtml: ambientFeature,
    entries: ambientEntries,
    groups: [
      { key: 'campaign', title: 'Campaign worlds', note: 'Rows with a validated campaign-level backlink.', has: (e) => !!AE.refs[e.id]?.campaignLevel },
      { key: 'expedition', title: 'Expeditions', note: 'Rows with a validated expedition backlink.', has: (e) => !!AE.refs[e.id]?.expedition },
    ],
    facets: [{ key: 'event', label: 'Includes event', of: (e) => e.events.map((row) => row.event), multi: true }],
    sorts: [
      { key: 'roster', label: 'Source order', of: (e) => ambientEntries.indexOf(e) },
      { key: 'name', label: 'World name', of: (e) => e.name, text: true },
      { key: 'count', label: 'Event count', of: (e) => e.events.length, desc: true },
    ],
    searchText: (e) => `${e.name} ambient events ${e.events.map((row) => `${row.event} ${row.themeId}`).join(' ')}`,
    card: (e) => {
      const refs = AE.refs[e.id] || {};
      const page = refs.expedition ? 'expeditions' : 'worlds';
      return `
        <div class="wtags">${e.events.map((row) => tag(esc(humanize(row.event)), 'cyan')).join('')}</div>
        <div class="wfacts">
          ${fact('World', cardLink(page, e.id, esc(e.name)))}
          ${fact('Placements', e.events.map((row) => `<code>${esc(row.event)}</code> with theme <code>${esc(row.themeId)}</code>`).join('<br>'))}
        </div>`;
    },
  };

  // ---- ship recovery ------------------------------------------------------
  const shipCoreEntries = ordered(SC);
  const shipCoresRoster = {
    section: 'Progression',
    slug: 'ship-cores',
    domain: 'shipCores',
    title: 'Ship cores',
    tagline: 'Recovered systems, tied back to their worlds.',
    lede: 'Each ship core is a named system with canonical memory text and a world relation derived by the shared data layer.',
    entries: shipCoreEntries,
    groups: [{ key: 'all', title: 'Recovered systems', note: 'Every registered ship core.', has: () => true }],
    facets: [{ key: 'system', label: 'System', of: (e) => e.system }],
    sorts: [
      { key: 'roster', label: 'Recovery order', of: (e) => shipCoreEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.memoryFlavor} ${e.system} ship core ${levelName(e.worldId)}`,
    card: (e) => `
      <div class="wtags">${tag(esc(e.system), 'cyan')}</div>
      <p class="wdesc">${esc(e.memoryFlavor)}</p>
      <div class="wfacts">
        ${fact('Recovered in', cardLink('worlds', e.worldId, esc(SC.refs[e.id]?.levelName || levelName(e.worldId))))}
        ${SC.refs[e.id]?.socket ? fact('Ship socket', cardLink('ship-systems', SC.refs[e.id].socket, esc(SC.refs[e.id].socketLabel))) : ''}
      </div>`,
  };

  const shipFragmentEntries = ordered(SF);
  const shipFragmentsRoster = {
    section: 'Progression',
    slug: 'ship-fragments',
    domain: 'shipFragments',
    title: 'Ship fragments',
    tagline: 'The route pieces scattered beyond the core recoveries.',
    lede: 'Fragments carry a route, system, physical form and memory line in the canonical registry. This page reproduces all four fields without adding a location or reward the source does not state.',
    entries: shipFragmentEntries,
    groups: [{ key: 'all', title: 'Fragment registry', note: 'Every authored ship fragment.', has: () => true }],
    facets: [
      { key: 'route', label: 'Route', of: (e) => e.route },
      { key: 'system', label: 'System', of: (e) => e.system },
    ],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => shipFragmentEntries.indexOf(e) }],
    searchText: (e) => `${e.memoryFlavor} ${e.form} ${e.route} ${e.system} ship fragment`,
    card: (e) => `
      <div class="wtags">${tag(esc(SF.refs[e.id]?.routeLabel || humanize(e.route)), 'violet')}${tag(esc(e.system), 'cyan')}</div>
      <p class="wdesc">${esc(e.memoryFlavor)}</p>
      <div class="wfacts">
        ${fact('Route', esc(SF.refs[e.id]?.routeLabel || humanize(e.route)))}
        ${fact('Form', esc(e.form))}
      </div>`,
  };

  const shipSystemEntries = ordered(SS, (e) => ({ ...e, name: e.label }));
  const rebuildCoreCounts = (SS.rebuildTierByCoreCount || []).map((row) => row.coreCount);
  const rebuildCoreRange = rebuildCoreCounts.length
    ? ` from ${Math.min(...rebuildCoreCounts)} through ${Math.max(...rebuildCoreCounts)}`
    : '';
  const shipSystemFeature = `
    <section class="wfeature" aria-labelledby="ship-rebuild-tiers">
      <div><span class="eyebrow">Canonical topology</span><h3 id="ship-rebuild-tiers">Rebuild tiers and fragment route labels</h3></div>
      <div class="wbuild-grid">
        ${(SS.rebuildTiers || []).map((tier) => `<article>
          <span class="wtag ink-gold">Tier ${num(tier.tier)} at ${num(tier.minCores)} cores</span>
          <h4>${esc(tier.name)}</h4>
          <p>${esc(tier.describe)}</p>
        </article>`).join('')}
      </div>
      ${sourceParams(Object.fromEntries((SS.rebuildTierByCoreCount || []).map((row) => [`${row.coreCount} cores`, `tier ${row.tier}`])), 'Rebuild tier by recovered core count')}
      ${sourceParams(SS.fragmentRouteLabels, 'Fragment route labels')}
      ${sourceParams(SS.provenance, 'Topology provenance')}
    </section>`;
  const shipSystemsRoster = {
    section: 'Progression',
    slug: 'ship-systems',
    domain: 'shipSystems',
    title: 'Ship systems',
    tagline: 'Every socket, its core and the complete rebuild ladder.',
    lede: `The ship topology contract validates exactly one recovered core per socket, marks the heart socket, preserves recovery order and publishes ${SS.rebuildTierCount} rebuild thresholds with a lookup for every source-listed core count${rebuildCoreRange}.`,
    omissions: '<b>Fragments do not occupy these sockets.</b> The canonical contract exposes route labels for fragments but deliberately does not claim a fragment-to-socket relation.',
    featureHtml: shipSystemFeature,
    countLabel: `${SS.count} sockets · ${SS.rebuildTierCount} rebuild tiers`,
    entries: shipSystemEntries,
    groups: [
      { key: 'heart', title: 'Heart socket', note: 'The one socket marked as the ship’s heart by source metadata.', has: (e) => e.heart },
      { key: 'systems', title: 'System sockets', note: 'Every remaining validated core socket.', has: (e) => !e.heart },
    ],
    facets: [{ key: 'heart', label: 'Heart socket', of: (e) => e.heart ? 'yes' : 'no' }],
    sorts: [
      { key: 'roster', label: 'Socket order', of: (e) => shipSystemEntries.indexOf(e) },
      { key: 'name', label: 'Label', of: (e) => e.label, text: true },
    ],
    searchText: (e) => `${e.label} ${e.id} ship system socket ${SS.refs[e.id]?.coreName || ''} ${e.heart ? 'heart' : ''}`,
    card: (e) => `
      <div class="wtags">${tag('Ship socket', 'cyan')}${e.heart ? tag('Heart', 'pink') : ''}</div>
      <div class="wfacts">
        ${fact('Socket id', `<code>${esc(e.id)}</code>`)}
        ${fact('Recovered core', cardLink('ship-cores', e.coreId, esc(SS.refs[e.id]?.coreName || coreName(e.coreId))))}
        ${fact('Recovery order', `<b>${SS.cradleCoreOrder.indexOf(e.coreId) + 1}</b> of ${SS.cradleCoreOrder.length}`)}
      </div>`,
  };

  // ---- achievements -------------------------------------------------------
  const achievementEntries = ordered(A);
  const unlockLink = (kind, id) => {
    if (kind === 'weapon') return cardLink('weapons', id, esc(weaponName(id)));
    if (kind === 'passive') return cardLink('tomes', id, esc(passiveName(id)));
    if (kind === 'sprite') return cardLink('cosmetics', id, esc(CO.entries[id]?.name || humanize(id)));
    if (kind === 'level') return cardLink('worlds', id, esc(levelName(id)));
    return `<code>${esc(kind)}:${esc(id)}</code>`;
  };
  const achievementsRoster = {
    section: 'Progression',
    slug: 'achievements',
    domain: 'achievements',
    title: 'Achievements',
    tagline: 'Every goal and every payload it unlocks.',
    lede: 'The achievement registry is the unlock ladder. Cards show the canonical requirement, measurement kind, optional world condition and every unlock payload with a live link to its destination.',
    entries: achievementEntries,
    groups: [
      { key: 'run', title: 'Single-run goals', note: 'Measured inside one run.', has: (e) => e.kind === 'runStat' },
      { key: 'lifetime', title: 'Lifetime goals', note: 'Measured across the save.', has: (e) => e.kind === 'lifetime' },
      { key: 'event', title: 'Milestones', note: 'Completed by a named event rather than a counter.', has: (e) => e.kind === 'event' },
    ],
    facets: [
      { key: 'kind', label: 'Kind', of: (e) => e.kind },
      { key: 'reward', label: 'Reward', of: (e) => Object.keys(e.unlocks || {})[0] || 'none' },
      { key: 'world', label: 'World-specific', of: (e) => e.levelId ? 'yes' : 'no' },
    ],
    sorts: [
      { key: 'roster', label: 'Ladder order', of: (e) => achievementEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'target', label: 'Target', of: (e) => e.target || 0, desc: true },
    ],
    searchText: (e) => `${e.desc} ${e.kind} ${e.stat || ''} achievement ${(Object.entries(e.unlocks || {}).map(([kind, id]) => `${kind} ${id}`).join(' '))}`,
    card: (e) => `
      <div class="wtags">${tag(esc(humanize(e.kind)), 'cyan')}${e.levelId ? tag(esc(levelName(e.levelId)), 'violet') : ''}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${e.stat ? fact('Counter', `<code>${esc(e.stat)}</code>${e.target !== undefined ? `, target <b>${num(e.target)}</b>` : ''}`) : ''}
        ${e.levelId ? fact('World', cardLink('worlds', e.levelId, esc(levelName(e.levelId)))) : ''}
        ${Object.keys(e.unlocks || {}).length ? fact('Unlocks', list(Object.entries(e.unlocks).map(([kind, id]) => unlockLink(kind, id)))) : fact('Unlock payload', 'None')}
      </div>`,
  };

  // ---- quests, rewards and meta shop -------------------------------------
  const questEntries = ordered(Q, (e) => ({ ...e, name: e.title }));
  const questReward = (e) => {
    const refs = Q.refs[e.id] || {};
    if (refs.rewardWearable) return cardLink('wearables', refs.rewardWearable, esc(WR.entries[refs.rewardWearable]?.name || humanize(refs.rewardWearable)));
    if (refs.rewardWeapon) return cardLink('weapons', refs.rewardWeapon, esc(weaponName(refs.rewardWeapon)));
    if (refs.rewardTitle) {
      const title = Q.titles[refs.rewardTitle];
      return `<b>${esc(title?.name || humanize(refs.rewardTitle))}</b>${title?.blurb ? ` <span class="wsub">${esc(title.blurb)}</span>` : ''}`;
    }
    if (e.reward?.kind === 'gold') return `<b>${num(e.reward.amount)}g</b>${e.reward.blurb ? ` <span class="wsub">${esc(e.reward.blurb)}</span>` : ''}`;
    return `<code>${esc(sourceValue(e.reward))}</code>`;
  };
  const questTitleFeature = `
    <section class="wfeature" aria-labelledby="quest-earned-titles">
      <div><span class="eyebrow">Chain rewards</span><h3 id="quest-earned-titles">Earned titles</h3></div>
      <div class="wbuild-grid">
        ${(Q.titleOrder || []).map((id) => {
          const title = Q.titles[id];
          const refs = Q.titleRefs[id] || {};
          return `<article>
            <span class="wtag ink-violet">${esc(humanize(title.chainId))}</span>
            <h4>${esc(title.name)}</h4>
            <p>${esc(title.blurb)}</p>
            <p>Chain: ${list((refs.earnedByCompletingQuests || []).map((questId) => cardLink('quests', questId, esc(questName(questId)))))}</p>
          </article>`;
        }).join('')}
      </div>
    </section>`;
  const questsRoster = {
    section: 'Progression',
    slug: 'quests',
    domain: 'quests',
    title: 'Quests and rewards',
    tagline: 'Every chain, objective, giver, response and validated reward.',
    lede: 'Quest cards preserve the registry’s authored request and reaction lines, exact objective contract, previous and next links, and reward target. The title gallery is derived from the same chain metadata.',
    featureHtml: questTitleFeature,
    countLabel: `${Q.count} quests · ${Q.chainOrder.length} chains · ${Q.titleOrder.length} titles`,
    entries: questEntries,
    groups: (Q.chainOrder || []).map((chainId) => ({
      key: chainId,
      title: humanize(chainId),
      note: `${Q.chainQuests[chainId].length} source-ordered steps.`,
      has: (e) => e.chainId === chainId,
    })),
    facets: [
      { key: 'giver', label: 'Giver', of: (e) => e.giver, name: (id) => Q.giverNames[id] || humanize(id) },
      { key: 'target', label: 'Objective type', of: (e) => e.target.kind },
      { key: 'reward', label: 'Reward', of: (e) => e.reward.kind },
    ],
    sorts: [
      { key: 'roster', label: 'Registry order', of: (e) => questEntries.indexOf(e) },
      { key: 'chain', label: 'Chain step', of: (e) => Q.chainOrder.indexOf(e.chainId) * 100 + e.step },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.title} ${e.objective} ${(e.ask || []).join(' ')} ${(e.reaction || []).join(' ')} ${Q.refs[e.id]?.giverName || ''} ${e.target.kind} ${e.reward.kind} quest reward`,
    card: (e) => {
      const refs = Q.refs[e.id] || {};
      const chainLength = Q.chainQuests[e.chainId]?.length || 0;
      return `
        <div class="wtags">${tag(`Step ${e.step} of ${chainLength}`, 'cyan')}${tag(esc(refs.giverName), 'violet')}${tag(esc(humanize(e.reward.kind)), 'gold')}</div>
        <p class="wdesc">${esc(e.objective)}</p>
        <div class="wfacts">
          ${fact('Giver', `<b>${esc(refs.giverName)}</b>`)}
          ${fact('Request', (e.ask || []).map((line) => esc(line)).join('<br>'))}
          ${fact('Target', `<code>${esc(e.target.kind)}</code>, count <b>${num(e.target.count)}</b>${e.unit ? ` ${esc(e.unit)}` : ''}`)}
          ${fact('Reward', questReward(e))}
          ${fact('Reaction', (e.reaction || []).map((line) => esc(line)).join('<br>'))}
          ${refs.previousQuest ? fact('Previous', cardLink('quests', refs.previousQuest, esc(questName(refs.previousQuest)))) : ''}
          ${refs.nextQuest ? fact('Next', cardLink('quests', refs.nextQuest, esc(questName(refs.nextQuest)))) : ''}
        </div>
        ${sourceParams(Object.fromEntries(Object.entries(e.target).filter(([key]) => key !== 'kind' && key !== 'count')), 'Additional objective parameters')}`;
    },
  };

  const shopEntries = ordered(SH);
  const shopRankRows = shopEntries.reduce((sum, e) => sum + (SH.refs[e.id]?.ranks?.length || 0), 0);
  const shopFeature = `
    <section class="wfeature" aria-labelledby="shop-gates">
      <div><span class="eyebrow">Canonical purchase ladder</span><h3 id="shop-gates">Gates and all-in cost</h3></div>
      <p><b>${num(SH.grandTotal)}g</b> buys every published rank and both gates. The artifact expands the ${SH.count} upgrade rows into <b>${shopRankRows}</b> exact rank purchases.</p>
      <div class="wbuild-grid">
        ${(SH.gateOrder || []).map((id) => {
          const gate = SH.gates[id];
          return `<article id="gate-${esc(id)}">
            <span class="wtag ink-gold">${num(gate.cost)}g · opens tier ${num(gate.unlocksTier)}</span>
            <h4>${esc(gate.name)}</h4>
            <p>${esc(gate.desc)}</p>
            ${gate.requires ? `<p>Requires <a href="#gate-${esc(gate.requires)}">${esc(SH.gates[gate.requires]?.name || humanize(gate.requires))}</a>.</p>` : ''}
          </article>`;
        }).join('')}
      </div>
      ${sourceParams(SH.provenance, 'Shop provenance')}
    </section>`;
  const shopRoster = {
    section: 'Progression',
    slug: 'shop',
    domain: 'shop',
    title: 'Meta shop',
    tagline: 'Every permanent upgrade, rank price, tier and gate.',
    lede: 'Each source stat stays one card, with its complete canonical rank ladder expanded underneath. Prices, gates and tier assignments come from runtime exports rather than a duplicated pricing formula.',
    featureHtml: shopFeature,
    countLabel: `${SH.count} upgrades · ${shopRankRows} ranks · ${num(SH.grandTotal)}g all-in`,
    entries: shopEntries,
    groups: [
      { key: 'power', title: 'Power', note: 'Rows whose canonical lane is power.', has: (e) => e.lane === 'power' },
      { key: 'qol', title: 'Quality of life', note: 'Rows whose canonical lane is qol.', has: (e) => e.lane === 'qol' },
    ],
    facets: [
      { key: 'lane', label: 'Lane', of: (e) => e.lane },
      { key: 'band', label: 'Price band', of: (e) => e.band, name: (id) => SH.pricing.bandLabels[id] || humanize(id) },
      { key: 'ranks', label: 'Ranks', of: (e) => String(e.ranks), name: (value) => `${value} ranks` },
    ],
    sorts: [
      { key: 'roster', label: 'Registry order', of: (e) => shopEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'total', label: 'Total cost', of: (e) => SH.refs[e.id]?.totalCost, desc: true },
      { key: 'increment', label: 'Per-rank source value', of: (e) => e.perRank, desc: true },
    ],
    searchText: (e) => `${e.name} ${e.desc} ${e.id} ${e.lane} ${e.band} meta shop upgrade ${(SH.refs[e.id]?.ranks || []).map((row) => `${row.cost} gold tier ${row.tier} ${row.gate || ''}`).join(' ')}`,
    card: (e) => {
      const refs = SH.refs[e.id] || {};
      return `
        <div class="wtags">${tag(esc(humanize(e.lane)), 'cyan')}${tag(esc(SH.pricing.bandLabels[e.band] || humanize(e.band)), 'violet')}${tag(`${e.ranks} ranks`, 'gold')}</div>
        <p class="wdesc">${esc(e.desc)}</p>
        <div class="wfacts">
          ${fact('Per-rank value', `<b>${num(e.perRank, 4)}</b> <span class="wsub">source value</span>`)}
          ${fact('Full rank cost', `<b>${num(refs.totalCost)}g</b>`)}
        </div>
        <details class="wraw wschedule"><summary>Purchase ladder <span>${refs.ranks.length}</span></summary><ol>
          ${refs.ranks.map((row) => `<li>Rank <b>${num(row.rank)}</b> <span>tier ${num(row.tier)}</span><code>${num(row.cost)}g${row.gate ? ` · ${esc(SH.gates[row.gate]?.name || humanize(row.gate))}` : ''}</code></li>`).join('')}
        </ol></details>`;
    },
  };

  // ---- collection ---------------------------------------------------------
  const wearableEntries = ordered(WR);
  const wearablesRoster = {
    section: 'Collection',
    slug: 'wearables',
    domain: 'wearables',
    title: 'Wearables',
    tagline: 'Cosmetic pieces, anchors and trail behavior.',
    lede: 'Wearables are cosmetic attachments. The registry defines their anchor, blurb, source colors and whether they add trails; those are the only claims this page makes.',
    entries: wearableEntries,
    groups: [
      { key: 'eyes', title: 'Eyes', note: 'Anchored to the eye slot.', has: (e) => e.anchor === 'eyes' },
      { key: 'head', title: 'Head', note: 'Anchored to the head slot.', has: (e) => e.anchor === 'head' },
      { key: 'back', title: 'Back', note: 'Anchored to the back slot.', has: (e) => e.anchor === 'back' },
      { key: 'other', title: 'Other anchors', note: 'Every remaining canonical anchor.', has: (e) => !['eyes', 'head', 'back'].includes(e.anchor) },
    ],
    facets: [
      { key: 'anchor', label: 'Anchor', of: (e) => e.anchor },
      { key: 'trails', label: 'Trails', of: (e) => e.trails ? 'yes' : 'no' },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => wearableEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.blurb} wearable cosmetic ${e.anchor} ${e.trails ? 'trails' : ''}`,
    accent: (e) => colorHex(e.accent || e.color),
    card: (e) => `
      <div class="wtags">${tag(esc(humanize(e.anchor)), 'cyan')}${e.trails ? tag('Trails', 'violet') : ''}</div>
      <p class="wdesc">${esc(e.blurb)}</p>
      <div class="wfacts">
        ${fact('Colors', `<span class="wswatch" style="background:${esc(colorHex(e.color))}"></span><code>${esc(colorHex(e.color))}</code> <span class="wswatch" style="background:${esc(colorHex(e.accent))}"></span><code>${esc(colorHex(e.accent))}</code>`)}
        ${WR.refs[e.id]?.rewardedByQuests?.length ? fact('Quest rewards', list(WR.refs[e.id].rewardedByQuests.map((id) => cardLink('quests', id, esc(questName(id)))))) : ''}
      </div>`,
  };

  const cosmeticEntries = ordered(CO);
  const cosmeticsRoster = {
    section: 'Collection',
    slug: 'cosmetics',
    domain: 'cosmetics',
    title: 'Cosmetic styles',
    tagline: 'Every body, rim and accent palette.',
    lede: 'Cosmetic styles are complete source palettes. Each card shows availability, achievement route when one exists, and the exact body, rim and accent values stored by the registry.',
    entries: cosmeticEntries,
    groups: [
      { key: 'start', title: 'Available from the start', note: 'Present on a fresh save.', has: (e) => e.unlockedFromStart },
      { key: 'earned', title: 'Earned styles', note: 'Achievement-linked styles.', has: (e) => !e.unlockedFromStart },
    ],
    facets: [{ key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'achievement' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => cosmeticEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.name} cosmetic style skin ${(inverseUnlocks.get(`sprite:${e.id}`) || []).map((row) => row.name).join(' ')}`,
    accent: (e) => colorHex(e.accentColor),
    card: (e) => {
      const unlocks = inverseUnlocks.get(`sprite:${e.id}`) || [];
      const swatch = (value, label) => value === null || value === undefined
        ? `<span class="wsub">${esc(label)} uses the default</span>`
        : `<span class="wswatch" style="background:${esc(colorHex(value))}"></span><code>${esc(colorHex(value))}</code>`;
      return `
        <div class="wtags">${tag(e.unlockedFromStart ? 'From the start' : 'Achievement', e.unlockedFromStart ? 'cyan' : 'gold')}</div>
        <div class="wfacts">
          ${unlocks.length ? fact('Unlocked by', list(unlocks.map((row) => cardLink('achievements', row.id, esc(row.name))))) : fact('Availability', 'From the start')}
          ${fact('Body', swatch(e.bodyColor, 'Body'))}
          ${fact('Rim', swatch(e.rimColor, 'Rim'))}
          ${fact('Accent', swatch(e.accentColor, 'Accent'))}
        </div>`;
    },
  };

  // ---- measured tier rows -------------------------------------------------
  const tierRows = (T?.weapons || []).map((row) => ({
    ...row,
    weaponId: row.id,
    id: `${row.id}-${row.form}-l${row.level}`,
    name: `${row.name} · ${row.form === 'evolved' ? 'evolved' : `level ${row.level}`}`,
  }));
  const tierAxis = (row, key, label) => {
    const axis = row.axes[key];
    const tierText = axis.volatile
      ? `<b>${esc(axis.tierAtP10)} to ${esc(axis.tierAtP90)}</b> across P10 to P90, median tier <b>${esc(axis.tier)}</b>`
      : `tier <b>${esc(axis.tier)}</b>, stable across P10 to P90`;
    return `${fact(label, `${tierText}; median <b>${num(axis.median)}</b>, P10 to P90 <b>${num(axis.p10)} to ${num(axis.p90)}</b>; rank <b>${axis.rankInCohort} of ${axis.cohortSize}</b>; n=${axis.n}`)}`;
  };
  const tierFeature = T ? `
    <section class="wfeature" aria-labelledby="measurement-method">
      <div><span class="eyebrow">Measured, not voted</span><h3 id="measurement-method">Artifact-defined jobs and tiers</h3></div>
      <p>${esc(T.metric.whyTwo)}</p>
      <div class="wmethod-grid">
        ${T.metric.axes.map((axis) => `<div><b>${esc(humanize(axis.key))}</b><span>${esc(axis.what)}</span><code>${esc(axis.unit)}</code></div>`).join('')}
      </div>
      <p class="wsub">${esc(T.metric.whyNotSurvival)}</p>
    </section>` : '';
  const tiersRoster = T ? {
    section: 'Buildcraft',
    slug: 'tiers',
    domain: null,
    sourceKind: 'measurement',
    title: 'Weapon tiers',
    tagline: `${T.metric.axes.length} measured jobs, with sample and spread attached.`,
    lede: `${T.coverage.measured} of ${T.coverage.weaponDefs} weapons are measured across ${T.coverage.rows} form-and-level rows. Each letter is relative to its artifact-defined cohort, so rows from different cohorts are never ranked against one another.`,
    omissions: `<b>Tomes, relics and characters are named as unmeasured by the artifact.</b> ${Object.entries(T.notCovered).map(([key, reason]) => `<b>${esc(humanize(key))}:</b> ${esc(reason)}`).join(' ')}`,
    featureHtml: tierFeature,
    sourceLabel: `data/tier-rankings.json · fingerprint ${T.fingerprint}`,
    countLabel: `${T.coverage.measured} weapons · ${T.coverage.rows} measured rows`,
    entries: tierRows,
    groups: [
      { key: 'base-1', title: 'Base weapons · level 1', note: `${T.sample.singles.seeds} seeds per row, ranked only against this cohort.`, has: (e) => e.cohort === 'base:1' },
      { key: 'base-4', title: 'Base weapons · level 4', note: `${T.sample.singles.seeds} seeds per row, ranked only against this cohort.`, has: (e) => e.cohort === 'base:4' },
      { key: 'base-8', title: 'Base weapons · level 8', note: `${T.sample.singles.seeds} seeds per row, ranked only against this cohort.`, has: (e) => e.cohort === 'base:8' },
      { key: 'evolved-1', title: 'Evolved forms', note: `${T.sample.singles.seeds} seeds per row, ranked only against evolved forms.`, has: (e) => e.cohort === 'evolved:1' },
    ],
    facets: [
      { key: 'form', label: 'Form', of: (e) => e.form },
      { key: 'level', label: 'Level', of: (e) => String(e.level), name: (v) => `Level ${v}` },
      { key: 'crowd', label: 'Crowd tier', of: (e) => e.axes.trashClear.tier },
      { key: 'boss', label: 'Boss tier', of: (e) => e.axes.bossDamage.tier },
      { key: 'confidence', label: 'Spread', of: (e) => e.axes.trashClear.volatile || e.axes.bossDamage.volatile ? 'volatile' : 'stable' },
    ],
    sorts: [
      { key: 'roster', label: 'Cohort rank', of: (e) => e.axes.trashClear.rankInCohort },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'crowd', label: 'Crowd median', of: (e) => e.axes.trashClear.median, desc: true },
      { key: 'boss', label: 'Boss median', of: (e) => e.axes.bossDamage.median, desc: true },
    ],
    searchText: (e) => `${e.name} weapon tier ${e.cohort} crowd clear ${e.axes.trashClear.tier} boss damage ${e.axes.bossDamage.tier} ${e.axes.trashClear.volatile || e.axes.bossDamage.volatile ? 'volatile' : 'stable'}`,
    card: (e) => `
      <div class="wtags">${tag(`Crowd ${esc(e.axes.trashClear.tier)}`, e.axes.trashClear.tier === 'S' ? 'gold' : 'cyan')}${tag(`Boss ${esc(e.axes.bossDamage.tier)}`, e.axes.bossDamage.tier === 'S' ? 'gold' : 'pink')}${e.axes.trashClear.volatile || e.axes.bossDamage.volatile ? tag('Volatile', 'violet') : tag('Stable', '')}</div>
      <div class="wfacts">
        ${fact('Weapon', cardLink('weapons', e.weaponId, esc(weaponName(e.weaponId))))}
        ${tierAxis(e, 'trashClear', 'Crowd clear')}
        ${tierAxis(e, 'bossDamage', 'Boss damage')}
      </div>`,
  } : null;

  // ---- measured pairs and build chains -----------------------------------
  const pairEntries = (T?.meta?.pairs || []).map((pair) => ({
    ...pair,
    id: pair.ids.join('-'),
    name: pair.ids.map(weaponName).join(' + '),
  })).sort((a, b) => b.axes.trashClear.median - a.axes.trashClear.median || a.name.localeCompare(b.name));
  const buildFeature = T ? `
    <section class="wfeature" aria-labelledby="measured-builds">
      <div><span class="eyebrow">Greedy forward selection</span><h3 id="measured-builds">Measured build chains</h3></div>
      <p>${esc(T.meta.method)} Each chain starts from a measured solo and adds the best measured next weapon for that axis.</p>
      <div class="wbuild-grid">
        ${T.meta.builds.map((build) => `<article>
          <span class="wtag ink-${build.axis === 'trashClear' ? 'cyan' : 'pink'}">${esc(build.axis === 'trashClear' ? 'Crowd clear' : 'Boss damage')}</span>
          <h4>${build.ids.map((id) => cardLink('weapons', id, esc(weaponName(id)))).join(' + ')}</h4>
          <p><b>${num(build.median)}</b> ${esc(build.unit)} median, P10 to P90 <b>${num(build.p10)} to ${num(build.p90)}</b>, n=${T.sample.meta.seeds}.</p>
          <ol>${build.steps.map((step) => `<li>${step.added ? `Add ${cardLink('weapons', step.added, esc(weaponName(step.added)))}: <b>+${num(step.gain)}</b>` : `Seed ${cardLink('weapons', step.ids[0], esc(weaponName(step.ids[0])))}: <b>${num(step.median)}</b>`}</li>`).join('')}</ol>
        </article>`).join('')}
      </div>
    </section>` : '';
  const buildsRoster = T ? {
    section: 'Buildcraft',
    slug: 'builds',
    domain: null,
    sourceKind: 'measurement',
    title: 'Measured builds',
    tagline: 'Every weapon pair and the build chains the sweep found.',
    lede: `${T.meta.pairs.length} level-${T.meta.pairLevel} pairs were measured exhaustively on the smaller ${T.sample.meta.seeds}-seed cohort. Pair output, spread and synergy are shown on both axes; the ${T.meta.builds.length} featured build chains are measured extensions, not hand-picked recommendations.`,
    omissions: `<b>Pair and build samples use ${T.sample.meta.seeds} seeds, not the ${T.sample.singles.seeds}-seed single-weapon sweep.</b> ${esc(T.meta.partnerQualityNote)}`,
    featureHtml: buildFeature,
    sourceLabel: `data/tier-rankings.json · fingerprint ${T.fingerprint}`,
    countLabel: `${T.meta.pairs.length} measured pairs · ${T.meta.builds.length} build chains`,
    entries: pairEntries,
    groups: [{ key: 'all', title: 'Every measured pair', note: `All unordered pairs across the ${Object.keys(T.meta.solo).length}-weapon base roster, ${T.sample.meta.seeds} seeds per pair.`, has: () => true }],
    facets: [
      { key: 'weapon', label: 'Includes weapon', of: (e) => e.ids, multi: true, name: weaponName },
      { key: 'crowd', label: 'Crowd interaction', of: (e) => e.axes.trashClear.synergy >= 1.05 ? 'positive' : e.axes.trashClear.synergy <= 0.95 ? 'negative' : 'near additive' },
    ],
    sorts: [
      { key: 'crowd', label: 'Crowd output', of: (e) => e.axes.trashClear.median, desc: true },
      { key: 'crowdSynergy', label: 'Crowd synergy', of: (e) => e.axes.trashClear.synergy, desc: true },
      { key: 'boss', label: 'Boss output', of: (e) => e.axes.bossDamage.median, desc: true },
      { key: 'bossSynergy', label: 'Boss synergy', of: (e) => e.axes.bossDamage.synergy, desc: true },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.name} measured weapon pair build synergy crowd clear boss damage`,
    card: (e) => {
      const axis = (key, label) => {
        const a = e.axes[key];
        return fact(label, `median <b>${num(a.median)}</b>, P10 to P90 <b>${num(a.p10)} to ${num(a.p90)}</b>; synergy <b>${num(a.synergy)}</b> (${pct(a.synergy - 1)} vs solo sum); n=${a.n}`);
      };
      return `
        <div class="wtags">${tag('Measured pair', 'cyan')}${e.axes.trashClear.synergy >= 1.05 ? tag('Positive crowd interaction', 'gold') : e.axes.trashClear.synergy <= 0.95 ? tag('Crowd overlap', 'violet') : tag('Near additive', '')}</div>
        <div class="wfacts">
          ${fact('Weapons', e.ids.map((id) => cardLink('weapons', id, esc(weaponName(id)))).join(' + '))}
          ${axis('trashClear', 'Crowd clear')}
          ${axis('bossDamage', 'Boss damage')}
        </div>`;
    },
  } : null;

  return [
    weaponsRoster,
    coresRoster,
    powerCeilingRoster,
    ...(tiersRoster ? [tiersRoster, buildsRoster] : []),
    tomesRoster,
    relicsRoster,
    legendariesRoster,
    blessingsRoster,
    utilitiesRoster,
    ultimatesRoster,
    evolutionsRoster,
    jumpAugmentsRoster,
    charactersRoster,
    innatesRoster,
    signaturesRoster,
    bestiaryRoster,
    worldsRoster,
    expeditionsRoster,
    runModesRoster,
    worldEventsRoster,
    ambientEventsRoster,
    achievementsRoster,
    questsRoster,
    shopRoster,
    shipCoresRoster,
    shipSystemsRoster,
    shipFragmentsRoster,
    wearablesRoster,
    cosmeticsRoster,
  ];
}

// ================================================================ page shell
const groupOf = (roster, e) => roster.groups.find((g) => g.has(e));

function facetValues(roster, facet) {
  const seen = new Map();
  for (const e of roster.entries) {
    const values = facet.multi ? arr(facet.of(e)) : [facet.of(e)];
    for (const v of values) {
      if (v === undefined || v === null || v === '') continue;
      seen.set(v, (seen.get(v) || 0) + 1);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

const datasetKey = (k) => `s${k.charAt(0).toUpperCase()}${k.slice(1)}`;
const entryCountLabel = (count) => `${count} ${count === 1 ? 'entry' : 'entries'}`;

function renderRosterPage(roster, ctx) {
  const { esc, chrome, D } = ctx;
  const sourceDomain = roster.domain ? D.domains[roster.domain] : null;
  const noted = sourceDomain?.noted || 0;
  const total = roster.entries.length;

  const facetBar = roster.facets.map((f) => {
    const values = facetValues(roster, f);
    if (values.length < 2) return '';
    const label = f.name || humanize;
    return `
      <div class="wfacet">
        <span class="wfacet-h">${esc(f.label)}</span>
        <div class="wfacet-row" data-facet="${esc(f.key)}" data-multi="${f.multi ? '1' : '0'}">
          <button class="wf is-active" type="button" data-value="all" aria-pressed="true" aria-controls="wiki-groups">All</button>
          ${values.map(([v, n]) => `<button class="wf" type="button" data-value="${esc(v)}" aria-pressed="false" aria-controls="wiki-groups">${esc(label(v))} <span style="opacity:.5">${n}</span></button>`).join('')}
        </div>
      </div>`;
  }).join('');

  const sortBar = roster.sorts.length > 1 ? `
      <div class="wfacet">
        <span class="wfacet-h">Sort</span>
        <select class="wsort" id="wsort" aria-label="Sort ${esc(roster.title)}">
          ${roster.sorts.map((s) => `<option value="${esc(s.key)}" data-desc="${s.desc ? '1' : '0'}" data-text="${s.text ? '1' : '0'}">${esc(s.label)}</option>`).join('')}
        </select>
      </div>` : '';

  const groupsHtml = roster.groups.map((g) => {
    const members = roster.entries.filter((e) => groupOf(roster, e) === g);
    if (members.length === 0) return '';
    const cards = members.map((e) => {
      const facetAttrs = roster.facets.map((f) => {
        const value = f.multi ? arr(f.of(e)).join(' ') : String(f.of(e) ?? '');
        return `data-${f.key}="${esc(value)}"`;
      }).join(' ');
      const sortAttrs = roster.sorts.map((s) => {
        const raw = s.of(e);
        if (raw === undefined || raw === null) return '';
        return `data-${datasetKey(s.key).replace(/([A-Z])/g, '-$1').toLowerCase()}="${esc(String(s.text ? String(raw).toLowerCase() : (Number(raw) || 0)))}"`;
      }).join(' ');
      const accent = roster.accent ? roster.accent(e) : null;
      const note = (sourceDomain?.notes || {})[e.id];
      return `
      <article class="wcard" id="e-${esc(e.id)}" ${facetAttrs} ${sortAttrs}>
        <div class="wcard-h">
          <h4>${esc(e.name)}</h4>
          ${accent ? `<span class="wcard-accent" style="background:${esc(accent)}"></span>` : ''}
        </div>
        ${roster.card(e)}
        ${note ? `<p class="wnote">${esc(note)}</p>` : ''}
      </article>`;
    }).join('');
    return `
    <section class="wgroup" data-group="${esc(g.key)}" id="g-${esc(g.key)}">
      <div class="wgroup-h"><h3>${esc(g.title)}</h3><span class="wgroup-n">${members.length}</span></div>
      ${g.note ? `<p class="wgroup-note">${esc(g.note)}</p>` : ''}
      <div class="wgrid">${cards}</div>
    </section>`;
  }).join('');

  const body = `
<div class="wtopbar">
    ${chrome.AUTHBAR}
  <div class="wtopbar-row">
    <a class="brand" href="index.html">
      <span>
        <h1 class="chroma">WHOMP ${esc(roster.title.toLowerCase())}</h1>
        <p class="subtag">${esc(roster.tagline)}</p>
      </span>
    </a>
    <div class="chips">${chrome.liveChip()}</div>
  </div>
</div>

${chrome.searchMarkup(chrome.SEARCH_PLACEHOLDER)}

<div class="wshell">
  <nav class="wside">
    ${chrome.wikiNav(roster.slug)}
    <div class="stat">${esc(roster.countLabel || entryCountLabel(total))}, read straight out of the game</div>
  </nav>
  <main class="wmain">
    <div class="rule"></div>
    <h2 class="chroma">${esc(roster.title)}</h2>
    <p class="lede">${esc(roster.lede)}</p>

    <p class="wprov">Every value on this page is read from a verified generated artifact at build time, against
      <b>game@${esc(chrome.headSha)}</b>. The generator refuses stale artifacts, missing domains, missing entries
      and dead relations before it writes a page. Source: <code>${esc(roster.sourceLabel || sourceDomain?.source || 'generated measurement artifact')}</code>.
      ${sourceDomain ? (noted === 0
    ? `Optional director notes have <b>0 of ${total}</b> coverage, so these cards use canonical mechanics and authored registry copy only.`
    : `<b>${noted} of ${total}</b> carry an additional director note.`) : ''}</p>

    ${roster.omissions ? `<p class="womit">${roster.omissions}</p>` : ''}

    ${roster.featureHtml || ''}

    <div class="wbar">${facetBar}${sortBar}</div>
    <p class="wcount" id="wcount" role="status" aria-live="polite"></p>
    <div class="wempty" id="wempty" hidden>
      <b>No entries match these filters.</b>
      <button type="button" id="wreset">Reset filters</button>
    </div>

    <div id="wiki-groups">${groupsHtml}</div>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(chrome.buildStamp)} from <code>game@${esc(chrome.headSha)}</code>,
  content derived from <code>${esc(roster.sourceLabel || 'data/game-data.json')}</code>.
  <a href="wiki.html">All rosters</a> &middot; <a href="log.html#views">Dev log</a>
</footer>`;

  const script = `
// ---- facets ----
const cards = [...document.querySelectorAll('.wcard')];
const active = {};
document.querySelectorAll('.wfacet-row').forEach((row) => {
  const facet = row.dataset.facet;
  active[facet] = 'all';
  row.querySelectorAll('.wf').forEach((btn) => btn.addEventListener('click', () => {
    row.querySelectorAll('.wf').forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
    active[facet] = btn.dataset.value;
    apply();
  }));
});
function apply() {
  let shown = 0;
  for (const c of cards) {
    const ok = Object.entries(active).every(([k, v]) => {
      if (v === 'all') return true;
      const row = document.querySelector('.wfacet-row[data-facet="' + k + '"]');
      return row?.dataset.multi === '1' ? String(c.dataset[k] || '').split(' ').includes(v) : c.dataset[k] === v;
    });
    c.dataset.hidden = ok ? '0' : '1';
    if (ok) shown++;
  }
  document.querySelectorAll('.wgroup').forEach((g) => {
    const visible = [...g.querySelectorAll('.wcard')].filter((c) => c.dataset.hidden !== '1').length;
    g.dataset.empty = visible ? '0' : '1';
    const n = g.querySelector('.wgroup-n');
    if (n) n.textContent = visible;
  });
  const el = document.getElementById('wcount');
  if (el) el.textContent = shown === cards.length ? cards.length + ' shown' : shown + ' of ' + cards.length + ' shown';
  const empty = document.getElementById('wempty');
  if (empty) empty.hidden = shown !== 0;
}
function resetFilters() {
  document.querySelectorAll('.wfacet-row').forEach((row) => {
    row.querySelectorAll('.wf').forEach((b) => {
      const selected = b.dataset.value === 'all';
      b.classList.toggle('is-active', selected);
      b.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    active[row.dataset.facet] = 'all';
  });
  apply();
}
document.getElementById('wreset')?.addEventListener('click', resetFilters);
// ---- sort ----
const sortSel = document.getElementById('wsort');
if (sortSel) sortSel.addEventListener('change', () => {
  const opt = sortSel.selectedOptions[0];
  const key = sortSel.value, desc = opt.dataset.desc === '1', isText = opt.dataset.text === '1';
  const prop = 's' + key.charAt(0).toUpperCase() + key.slice(1);
  document.querySelectorAll('.wgrid').forEach((grid) => {
    [...grid.children]
      .sort((a, b) => {
        const x = a.dataset[prop], y = b.dataset[prop];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const cmp = isText ? String(x).localeCompare(String(y)) : (Number(x) - Number(y));
        return desc ? -cmp : cmp;
      })
      .forEach((k) => grid.appendChild(k));
  });
});
apply();
// ---- search: clear the filters before jumping, so a hit is never display:none ----
${chrome.SEARCH_SCRIPT(`
    if (target.classList.contains('wcard') && target.dataset.hidden === '1') {
      document.querySelectorAll('.wfacet-row').forEach((row) => {
        row.querySelectorAll('.wf').forEach((b) => {
          const selected = b.dataset.value === 'all';
          b.classList.toggle('is-active', selected);
          b.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        active[row.dataset.facet] = 'all';
      });
      apply();
    }`)}
`;

  return {
    file: `wiki-${roster.slug}.html`,
    html: ctx.page({
      title: `WHOMP ${roster.title.toLowerCase()}`,
      description: `${roster.title}: ${roster.tagline} Every value generated from the game's own data.`,
      body,
      script,
    }),
  };
}

// ================================================================ the hub
function renderHub(rosters, ctx) {
  const { esc, chrome, D, T } = ctx;
  const sections = [...new Set(rosters.map((r) => r.section))];
  const catalogRosters = rosters.filter((r) => r.domain);
  const catalogEntries = catalogRosters.reduce((sum, r) => sum + r.entries.length, 0);

  const body = `
<div class="wtopbar">
  ${chrome.AUTHBAR}
  <div class="wtopbar-row">
    <a class="brand" href="index.html">
      <span>
        <h1 class="chroma">WHOMP wiki</h1>
        <p class="subtag">Generated from the game, not written about it.</p>
      </span>
    </a>
    <div class="chips">${chrome.liveChip()}</div>
  </div>
</div>

${chrome.searchMarkup(chrome.SEARCH_PLACEHOLDER)}

<div class="wshell">
  <nav class="wside">
    ${chrome.wikiNav('')}
  </nav>
  <main class="wmain">
    <div class="rule"></div>
    <h2 class="chroma">The wiki</h2>
    <p class="lede">Every player-facing catalog in the generated public data layer, plus the measurements the simulation can honestly support.</p>

    <p class="wprov">This wiki is <b>generated and fail-closed</b>. Every value and relation is read from the
      verified artifacts built from <b>game@${esc(chrome.headSha)}</b>. All <b>${D.coverage.domains}</b> public
      registries have a route, with <b>${catalogEntries}</b> rendered source entries. The measured section adds
      <b>${T?.coverage?.rows || 0}</b> weapon tier rows and <b>${T?.meta?.pairs?.length || 0}</b> exhaustive weapon
      pairs. A stale artifact, unclassified domain, missing card, missing search entry or dead link stops generation.</p>

    <p class="womit">Where the game has no answer, these pages say so instead of guessing. Several numbers that a
      normal wiki would print are deliberately absent, and each roster explains which ones and why at the top of
      its own page. A missing column here means the value the game runs on is not the value the registry
      carries, so printing it would be a confident lie rather than a gap.</p>

    ${sections.map((section) => {
      const pages = rosters.filter((r) => r.section === section);
      return `<section class="whubsection" id="section-${esc(section.toLowerCase())}">
        <div class="whubsection-h"><h3>${esc(section)}</h3><span>${pages.length} ${pages.length === 1 ? 'guide' : 'guides'}</span></div>
        <div class="whub">${pages.map((r) => `
          <a class="whubcard" href="wiki-${esc(r.slug)}.html">
            <span class="n">${esc(r.countLabel || entryCountLabel(r.entries.length))}</span>
            <h3>${esc(r.title)}</h3>
            <p>${esc(r.tagline)}</p>
          </a>`).join('')}</div>
      </section>`;
    }).join('')}
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(chrome.buildStamp)} from <code>game@${esc(chrome.headSha)}</code>,
  content derived from <code>data/game-data.json</code>.
  <a href="log.html#views">Dev log</a>
</footer>`;

  return {
    file: 'wiki.html',
    html: ctx.page({
      title: 'WHOMP wiki',
      description: 'The complete generated WHOMP wiki: every public source catalog, measured weapon tiers and measured build pairs.',
      body,
      script: chrome.SEARCH_SCRIPT(''),
    }),
  };
}

// ================================================================ entry point
export function buildWiki(ctx) {
  const { D, T } = ctx;
  const rosters = rosterSpecs(D, ctx.esc, T);
  const violations = [];
  if (D.schema !== 7) violations.push(`game-data.json schema 7 is required, received ${D.schema}`);
  const byDomain = new Map();
  const slugs = new Set();
  for (const roster of rosters) {
    if (!roster.slug || !roster.title || !roster.section) violations.push(`roster missing slug, title or section: ${JSON.stringify({ slug: roster.slug, title: roster.title, section: roster.section })}`);
    if (slugs.has(roster.slug)) violations.push(`wiki slug ${roster.slug} is declared more than once`);
    slugs.add(roster.slug);
    for (const entry of roster.entries || []) {
      const matches = (roster.groups || []).filter((group) => group.has(entry));
      if (matches.length !== 1) {
        violations.push(`roster ${roster.slug} entry ${entry.id} has ${matches.length} group classifications; expected exactly one`);
      }
    }
    if (roster.domain) {
      if (byDomain.has(roster.domain)) violations.push(`domain ${roster.domain} is rendered by more than one route`);
      byDomain.set(roster.domain, roster);
      const source = D.domains[roster.domain];
      if (!source) { violations.push(`roster ${roster.slug} points at missing domain ${roster.domain}`); continue; }
      const sourceIds = Object.keys(source.entries).sort();
      const renderedIds = roster.entries.map((entry) => entry.id).sort();
      if (sourceIds.length !== source.count) violations.push(`domain ${roster.domain} declares ${source.count} entries but contains ${sourceIds.length}`);
      if (new Set(renderedIds).size !== renderedIds.length) violations.push(`roster ${roster.slug} emits duplicate entry ids`);
      if (JSON.stringify(renderedIds) !== JSON.stringify(sourceIds)) {
        const missing = sourceIds.filter((id) => !renderedIds.includes(id));
        const extra = renderedIds.filter((id) => !sourceIds.includes(id));
        violations.push(`roster ${roster.slug} does not exactly cover ${roster.domain}; missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
      }
    }
  }
  for (const domain of D.domainOrder) {
    if (!byDomain.has(domain)) violations.push(`public domain ${domain} has no declared wiki route`);
  }
  for (const domain of byDomain.keys()) {
    if (!D.domainOrder.includes(domain)) violations.push(`wiki renders undeclared domain ${domain}`);
  }
  if (!T || T.schema !== 1) violations.push('tier-rankings.json schema 1 is required');
  if (!D.domains.enemies?.speedPolicy?.unit || !Array.isArray(D.domains.enemies.speedPolicy.bands)) {
    violations.push('enemy speed policy is missing its unit or canonical bands');
  }
  for (const enemy of Object.values(D.domains.enemies?.entries || {})) {
    const profile = D.domains.enemies.refs?.[enemy.id]?.speedProfile;
    if (!profile || !Number.isFinite(profile.authoredBaseMps) || !Number.isFinite(profile.liveRunBaseMps)
      || !Number.isFinite(profile.liveRunMultiplier) || typeof profile.liveRunBandApplied !== 'boolean') {
      violations.push(`enemy ${enemy.id} has no renderable canonical speed profile`);
    }
  }
  const expectedForgivenessFields = [
    'acquireConeRad', 'acquireRangeM', 'bodyPadM', 'minHitRadiusM', 'rescueRadM',
    'magnetismConeRad', 'magnetismPull', 'centerMassGraceRad', 'minQuality',
  ].sort();
  const cores = D.domains.coreWeapons;
  const sourceCoreIds = Object.keys(cores.entries || {}).sort();
  const selectedCoreIds = Array.isArray(cores.selectOrder) ? cores.selectOrder : [];
  if (selectedCoreIds.length !== cores.count || new Set(selectedCoreIds).size !== selectedCoreIds.length
    || JSON.stringify([...selectedCoreIds].sort()) !== JSON.stringify(sourceCoreIds)) {
    violations.push('core weapon selectOrder does not cover the complete roster');
  }
  const aimPolicy = cores.aimPolicy;
  const assistLevels = Array.isArray(aimPolicy?.assistLevels) ? aimPolicy.assistLevels : [];
  const assistScaleKeys = Object.keys(aimPolicy?.assistScale || {}).sort();
  const aimProvenanceFields = ['assist', 'duelAssist', 'profiles', 'rangeFloor'].sort();
  if (assistLevels.length === 0 || new Set(assistLevels).size !== assistLevels.length
    || JSON.stringify([...assistLevels].sort()) !== JSON.stringify(assistScaleKeys)
    || assistLevels.some((level) => !Number.isFinite(aimPolicy.assistScale[level]))
    || !assistLevels.includes(aimPolicy?.defaultAssist) || !assistLevels.includes(aimPolicy?.duelAssist)
    || !Number.isFinite(aimPolicy?.minimumRangeM) || !Array.isArray(aimPolicy?.minimumRangeExempt)
    || aimPolicy.minimumRangeExempt.some((id) => !sourceCoreIds.includes(id))
    || JSON.stringify(Object.keys(aimPolicy?.provenance || {}).sort()) !== JSON.stringify(aimProvenanceFields)
    || Object.values(aimPolicy?.provenance || {}).some((source) => typeof source !== 'string' || source.length === 0)) {
    violations.push('global core aimPolicy is incomplete');
  }
  for (const core of Object.values(cores.entries || {})) {
    const profile = cores.refs?.[core.id]?.forgiveness;
    const keys = Object.keys(profile || {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expectedForgivenessFields)
      || Object.values(profile || {}).some((value) => !Number.isFinite(value))) {
      violations.push(`core weapon ${core.id} does not expose the complete nine-field aim and forgiveness profile`);
    }
  }
  const expectedPowerFields = ['attackSpeedFactor', 'attackSpeedKnee', 'critFactor', 'critKnee'].sort();
  if (JSON.stringify(Object.keys(D.powerCeiling?.config || {}).sort()) !== JSON.stringify(expectedPowerFields)
    || Object.values(D.powerCeiling?.config || {}).some((value) => !Number.isFinite(value))
    || !D.powerCeiling?.source || !Array.isArray(D.powerCeiling?.semantics) || D.powerCeiling.semantics.length === 0
    || D.powerCeiling.semantics.some((line) => typeof line !== 'string' || line.length === 0)) {
    violations.push('root powerCeiling does not expose the four-dial schema-7 contract');
  }
  if (T) {
    if (T.coverage?.weaponDefs !== D.domains.weapons.count || T.coverage?.measured !== D.domains.weapons.count) {
      violations.push(`tier coverage ${T.coverage?.measured}/${T.coverage?.weaponDefs} does not cover all ${D.domains.weapons.count} weapons`);
    }
    const tierRoster = rosters.find((r) => r.slug === 'tiers');
    if (tierRoster?.entries.length !== T.coverage?.rows) violations.push(`tier route emits ${tierRoster?.entries.length || 0} rows, artifact declares ${T.coverage?.rows}`);
    const buildsRoster = rosters.find((r) => r.slug === 'builds');
    if (buildsRoster?.entries.length !== T.meta?.pairs?.length) violations.push(`build route emits ${buildsRoster?.entries.length || 0} pairs, artifact declares ${T.meta?.pairs?.length}`);
    for (const row of T.weapons || []) {
      if (!D.domains.weapons.entries[row.id]) violations.push(`tier row points at missing weapon ${row.id}`);
      for (const axis of T.metric?.axes || []) {
        const reading = row.axes?.[axis.key];
        if (!reading || !reading.n || reading.p10 === undefined || reading.p90 === undefined || !reading.tier) violations.push(`tier row ${row.id}@${row.level}/${axis.key} has no renderable sample, spread or tier`);
        if (reading?.volatile && (!reading.tierAtP10 || !reading.tierAtP90 || reading.tierSpan <= 1)) violations.push(`volatile tier row ${row.id}@${row.level}/${axis.key} has no visible tier span evidence`);
      }
    }
  }
  if (violations.length) throw new Error(`Wiki source contract failed (${violations.length}):\n  ${violations.join('\n  ')}`);
  const pages = [renderHub(rosters, ctx), ...rosters.map((r) => renderRosterPage(r, ctx))];

  const TYPE = { enemies: 'enemy', coreWeapons: 'core weapon', weapons: 'weapon', passives: 'tome', shrineBlessings: 'blessing', runModes: 'run mode', levels: 'world' };
  const searchEntries = [];
  searchEntries.push({ type: 'wiki', title: 'WHOMP wiki', text: `All ${D.coverage.domains} source catalogs and measured guides`, anchor: '', href: 'wiki.html' });
  for (const r of rosters) {
    searchEntries.push({ type: 'wiki page', title: r.title, text: `${r.section} ${r.tagline} ${r.lede}`, anchor: '', href: `wiki-${r.slug}.html` });
    for (const e of r.entries) {
      searchEntries.push({
        type: TYPE[r.domain] || r.domain || r.sourceKind || 'wiki',
        title: e.name,
        text: r.searchText(e),
        anchor: `e-${e.id}`,
        href: `wiki-${r.slug}.html#e-${e.id}`,
      });
    }
  }
  const expectedSearchEntries = 1 + rosters.length + rosters.reduce((sum, roster) => sum + roster.entries.length, 0);
  if (searchEntries.length !== expectedSearchEntries) throw new Error(`Wiki search coverage is ${searchEntries.length}, expected ${expectedSearchEntries}. Every route and card needs one generated entry.`);

  /* GLOSSARY GAPS, said out loud in the build output. An enum with no authored
     sentence renders as the bare humanized value, which is honest but thin, and
     the only way anybody notices is if the build mentions it. */
  const gaps = [];
  const checkGloss = (domain, field, has, label) => {
    const vals = new Set(Object.values(D.domains[domain].entries).map((e) => e[field]).filter(Boolean));
    for (const v of [...vals].sort()) if (!has(v)) gaps.push(`${label} "${v}"`);
  };
  checkGloss('weapons', 'pattern', (v) => !!PATTERN_NOTE[v], 'weapon pattern');
  checkGloss('enemies', 'behavior', (v) => !!BEHAVIOR_NOTE[v], 'enemy behaviour');
  checkGloss('coreWeapons', 'cadence', (v) => !!CADENCE_NOTE[v], 'core cadence');
  checkGloss('coreWeapons', 'feel', (v) => !!FEEL_NOTE[v], 'core feel');

  return { pages, searchEntries, rosters, gaps };
}

export { WIKI_CSS };

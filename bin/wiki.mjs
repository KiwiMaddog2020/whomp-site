import { createHash } from 'node:crypto';

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

/* THE ONE EXPLAINER, instead of the same disclaimer thirty-two times.
 *
 * Every roster page used to carry a five-line paragraph about verified
 * artifacts, unsourced magnitudes and fail-closed generation. It was true, it
 * was in nobody's voice, and repeating it on every route made it furniture
 * rather than an argument. A reader who wants to know whether to trust a number
 * deserves one page that actually earns it; a reader who does not want to know
 * deserves one sentence and a link.
 *
 * The filename must begin "wiki" because bin/generate.mjs and bin/wiki-check.mjs
 * both treat the wiki*.html namespace as the set of generated routes, and a page
 * outside that namespace would be invisible to the retirement and manifest
 * checks that keep dead routes from shipping. */
const EXPLAINER_SLUG = 'how-it-is-built';
const EXPLAINER_FILE = `wiki-${EXPLAINER_SLUG}.html`;
const EXPLAINER_TITLE = 'Where the numbers come from';
const EXPLAINER_LINK_TEXT = 'Where the numbers come from';
export { EXPLAINER_SLUG, EXPLAINER_FILE, EXPLAINER_TITLE, EXPLAINER_LINK_TEXT };

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

/* A count inside a sentence is a word; a count inside a table is a digit. These
   are still read from the data, so the copy cannot drift when a roster grows.
   It only stops the prose reading like "the 5 ways a shrine changes how you
   move". Past twelve the digits win, because "three hundred pairs" is worse. */
const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const spell = (n) => (Number.isInteger(Number(n)) && n >= 0 && n < SPELLED.length ? SPELLED[n] : String(n));
const spellCap = (n) => spell(n).replace(/^./, (c) => c.toUpperCase());

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
    daggers: 'Strikes the nearest few enemies at full damage each. It picks them by their distance from you rather than from each other, so it does not care how they are spaced.',
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
  ricochet: { _: 'A disc thrown at where the target is going, then bouncing on to the next one. It gets more bounces as it levels.' },
  beam: {
    _: 'Holds persistent locks on targets and ramps its damage the longer a lock survives, with splash around where it lands.',
    faultline: 'Ruptures the ground in a line rather than firing a beam, throwing up pillars along it.',
  },
  burstNearest: {
    _: 'Fires a burst at whatever is closest, so it answers the thing about to touch you.',
    shotgun: 'A pellet volley that hits much harder up close than far away. The spread is the range limit.',
  },
  blackHole: { _: 'Drops a well that drags enemies inward and ticks damage into them while it lasts.' },
  pathEcho: { _: 'A lashing chain that trails the path you walked, heaviest at the front and tapering off toward the tail.' },
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
/* One number, because four things depend on the height of the sticky search
   band: what the band clears, where the sidebar starts sticking, how tall the
   sidebar may be, and how far an anchored card must sit below the fold so a deep
   link does not land underneath the band. Naming it once is what stops those four
   from drifting apart the next time the band gains a row. */
:root{--band:103px}
.skip-link{position:fixed;left:16px;top:12px;z-index:100;transform:translateY(-160%);padding:10px 14px;border-radius:8px;background:var(--cream);color:var(--ink);font-weight:800;text-decoration:none}
.skip-link:focus{transform:translateY(0);outline:3px solid var(--cyan);outline-offset:2px}
.wtopbar{max-width:1180px;margin:0 auto;padding:0 24px}
.wtopbar-brandrow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0 0}
.wtopbar-brandrow .authbar{padding:0}
.wtopbar-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:22px 0 0}

.wshell{max-width:1180px;margin:0 auto;padding:20px 24px 96px;display:flex;gap:36px;align-items:flex-start}
.wside{width:224px;max-height:calc(100vh - var(--band) - 26px);overflow-y:auto;flex:none;position:sticky;top:calc(var(--band) + 6px);display:flex;flex-direction:column;gap:2px;padding-right:5px}
.wside a{display:block;padding:9px 12px;border-radius:8px;color:var(--body);text-decoration:none;font-size:.92rem}
.wside a:hover{background:rgba(255,243,207,.05);color:var(--cream)}
.wside a.is-here{color:var(--cream);background:rgba(255,243,207,.06);font-weight:700}
.wside a[aria-current="page"]{box-shadow:inset 3px 0 0 var(--cyan)}
.wside-h{padding:14px 12px 6px;color:var(--gold);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.wside .stat{padding:9px 12px;color:var(--dim);font-size:.78rem}
.wmain{flex:1;min-width:0}
.wbreadcrumb{display:flex;align-items:center;gap:8px;margin:0 0 14px;color:var(--dim);font-size:.78rem;letter-spacing:.01em}
.wbreadcrumb a{color:var(--cyan);text-decoration:none}
.wbreadcrumb [aria-current="page"]{color:var(--body)}

/* THE PROVENANCE BANNER. The one thing that makes this different from a wiki is
   that it cannot go stale, and a reader has no way to know that unless the page
   says so. Said once per page, quietly, near the top: one sentence and a link to
   the page that argues it. It used to be five lines of the same paragraph on all
   thirty-two routes, which is furniture, not an argument. */
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

.wgroup{margin-bottom:38px;scroll-margin-top:calc(var(--band) + 18px)}
.wgroup-h{display:flex;align-items:baseline;gap:10px;margin:0 0 4px}
.wgroup-h h3{margin:0;font-size:1.15rem;color:var(--cream)}
.wgroup-n{color:var(--dim);font-size:.8rem;font-variant-numeric:tabular-nums}
.wgroup-note{color:var(--dim);font-size:.86rem;margin:0 0 14px;max-width:74ch}
.wgroup[data-empty="1"]{display:none}

.wgrid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.wcard{border:var(--edge);border-radius:14px;padding:16px 18px;background:rgba(255,243,207,.025);
  display:flex;flex-direction:column;gap:10px;scroll-margin-top:calc(var(--band) + 18px)}
.wcard[data-hidden="1"]{display:none}
.wcard:target{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(36,240,255,.14)}
.wcard:focus{outline:2px solid var(--cyan);outline-offset:3px}
.wcard-h{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wcard-h h4{margin:0;flex:1;min-width:0;font-size:1.06rem;color:var(--cream);font-weight:800}
.wcard-accent{width:30px;height:4px;border-radius:2px;flex:none}
/* THE AUTHORED GLYPH. Four domains ship one and the site used to drop it on the
   floor. It sits in the same inset well the measured pages already use for a
   component thumbnail (.wvisual-compact), at card-header size, so it reads as
   the same family of part rather than an emoji stuck on the front. Where the
   card has an accent the well borrows it, which is the accent bar the card is
   already wearing, one component earlier. An entry with no glyph renders no
   well at all: the header is a flex row and the title simply starts at the
   edge, so nothing reserves an empty square. */
.wcard-glyph{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;
  border:var(--edge);background:rgba(255,243,207,.045);font-size:1.1rem;line-height:1}
.wvisual{margin:0 0 4px;border:var(--edge);border-radius:12px;padding:10px;background:radial-gradient(circle at 50% 42%,rgba(36,240,255,.08),rgba(255,243,207,.015) 70%);overflow:hidden}
.wvisual img{display:block;width:auto;max-width:100%;height:auto;margin:0 auto;object-fit:contain;image-rendering:auto}
.wvisual-runtime-render img{width:min(256px,100%)}
.wvisual-runtime-glyph img{width:min(160px,52%)}
.wvisual-palette-strip img,.wvisual-evolution-strip img{width:100%}
.wvisual figcaption{display:flex;flex-direction:column;gap:2px;margin-top:8px;color:var(--dim);font-size:.7rem;line-height:1.4;overflow-wrap:anywhere}
.wvisual figcaption b{color:var(--cream);font-size:.74rem}
.wvisual-limit{border-left:2px solid var(--gold);padding-left:8px;color:var(--body)}
.wvisual-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 12px;padding:8px;border:var(--edge);border-radius:10px;background:rgba(255,243,207,.02)}
.wvisual-compact{display:inline-flex;width:54px;height:54px;align-items:center;justify-content:center;border-radius:9px;background:rgba(255,243,207,.035)}
.wvisual-compact img{display:block;max-width:50px;max-height:50px;width:auto;height:auto;object-fit:contain;image-rendering:auto}
.wrange{margin:7px 0 2px;padding:7px 9px;border-radius:8px;background:rgba(255,243,207,.025)}
.wrange-track{position:relative;display:block;height:5px;margin:5px 3px;background:linear-gradient(90deg,var(--violet),var(--cyan));border-radius:4px}
.wrange-track::before,.wrange-track::after,.wrange-mid{content:"";position:absolute;top:50%;width:2px;height:11px;background:var(--cream);transform:translate(-50%,-50%)}
.wrange-track::before{left:0}.wrange-track::after{left:100%}.wrange-mid{left:var(--median)}
.wrange-values{display:flex;justify-content:space-between;gap:8px;color:var(--cream);font-size:.7rem;font-variant-numeric:tabular-nums}
.wrange-limit{display:block;color:var(--dim);font-size:.64rem;line-height:1.35;margin-top:3px}
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
.whubsection{margin:0 0 38px;scroll-margin-top:calc(var(--band) + 18px)}
.whubsection-h{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
.whubsection-h h3{margin:0;color:var(--cream);font-size:1.08rem}
.whubsection-h span{color:var(--dim);font-size:.75rem}
@media (max-width:760px){
  .wshell{flex-direction:column;gap:16px;padding-top:14px}
  .wside{width:100%;max-height:none;position:static;overflow:visible;padding:0}
  .wgrid{grid-template-columns:1fr}
  .wfact-k,.wmeter-k{width:84px}
  .wraw dl{grid-template-columns:1fr}
  .wschedule li code{float:none;display:block;width:max-content;margin:2px 0 0}
  .wfeature{padding:16px}
  .wtopbar,.wshell{padding-left:16px;padding-right:16px}
  .wsearchband{padding-left:0;padding-right:0}
  /* WAS: .wside-section:not(.is-current-section){display:none}
     That hid four of the five sections on a phone, so a reader on Weapons could
     reach the thirteen other Buildcraft guides and none of the seventeen
     elsewhere, and the hub (which has no current section) hid all five. The
     sidebar is now one closed disclosure instead, which costs less room than the
     old single open section did and still reaches all thirty-one guides. */
  .wf,.wside a,.wside-section summary{min-height:44px;display:flex;align-items:center}
  /* A phone has no room for the page title, the tagline, two provenance chips and
     a search box before the content starts. The title and tagline stay; the chips
     shrink to one scannable row and give their vertical space back. */
  .wtopbar-row{gap:10px;padding-top:16px}
  .brand h1{font-size:1.32rem}
  .chips{gap:7px}
  .chip{padding:5px 11px;font-size:.74rem}
  .wtopbar-brandrow{padding-top:12px}
  .wiki-home-icon{width:38px;height:38px}
  .wbreadcrumb{flex-wrap:wrap;row-gap:2px}
  .wprov,.womit{padding:11px 13px}
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
/* Accents arrive as #rrggbb from the registry colours. The glyph well wants the
   same hue at two low alphas, and a bad or absent colour must produce nothing
   rather than an invalid declaration that paints the well black.
   THE BRIGHTNESS FLOOR is the part that matters. Three cosmetic accents are
   near-black (Shades is #121522), and a near-black ring on a near-black card is
   not a subtle ring, it is a missing one. Below the floor the well keeps its
   default hairline instead, so an accent can only ever add to the component. */
const rgba = (hex, alpha, minLuminance = 0) => {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return '';
  const value = parseInt(match[1], 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < minLuminance) return '';
  return `rgba(${r},${g},${b},${alpha})`;
};
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

/* WHAT THE PICTURE IS, in words a player already owns. Every one of these used
 * to lead with "Canonical", which is a word about our pipeline and not about
 * the image. The label still has to be exact: a render is not a screenshot and
 * a painted card glyph is not a sprite, and bin/wiki-check.mjs pins the render
 * label so a future rewrite cannot quietly promote one into the other. */
const visualKindLabel = (kind) => ({
  'runtime-render': 'Drawn by the game',
  'runtime-glyph': 'Card art, painted by the game',
  'palette-strip': 'The colors it is made of',
  'evolution-strip': 'The pieces it comes from',
}[kind] || humanize(kind));

const visualIndex = (V) => new Map((V?.entries || []).map((entry) => [`${entry.domain}:${entry.id}`, entry]));

function renderWikiVisual(entry, esc, { primary = false, use = 'entry', compact = false } = {}) {
  if (!entry) return '';
  const variants = entry.variants || [];
  const primaryVariant = variants[0];
  const responsive = entry.kind === 'runtime-render';
  const src = visualOutputPath(primaryVariant.path);
  const srcset = responsive
    ? ` srcset="${variants.map((variant) => `${esc(visualOutputPath(variant.path))} ${variant.width}w`).join(', ')}" sizes="(max-width:420px) calc(100vw - 60px), 256px"`
    : '';
  const loading = primary ? 'eager' : 'lazy';
  const priority = primary ? ' fetchpriority="high"' : '';
  const image = `<img src="${esc(src)}"${srcset} width="${primaryVariant.width}" height="${primaryVariant.height}" alt="${esc(entry.alt.text)}" loading="${loading}" decoding="async"${priority} data-pixelated="false">`;
  if (compact) {
    return `<span class="wvisual-compact" data-visual-key="${esc(entry.assetKey)}" data-visual-use="${esc(use)}">${image}</span>`;
  }
  const cameraView = entry.renderContext?.camera?.view || 'front';
  /* THE SAME FOUR DISCLOSURES, in plain words. It still says: the render is
   * isolated, the palette is a neutral stand-in or the subject's own, the
   * camera view, and that none of this is a screenshot of live play. Those are
   * the claims bin/wiki-check.mjs pins, because getting any of them wrong is
   * how a wiki starts passing off a studio render as evidence of a world. */
  const renderContext = entry.renderContext && typeof entry.renderContext === 'object'
    ? `<span><b>How it was made:</b> The game drew this on its own, alone, on a clear background under fixed light, seen from the ${esc(cameraView)}, ${entry.renderContext.palette?.id === 'toyMeadow' ? 'in stand-in colors a live world may repaint' : 'in its own colors'}. It is not a screenshot, and it is not how it looks in a live world. Frame: ${esc(humanize(String(entry.renderContext.frame?.mode || 'neutral frame').replace(/[-_]+/g, ' ')))}.</span>`
    : '';
  const limitation = entry.renderContext?.limitation || entry.limitation;
  return `<figure class="wvisual wvisual-${esc(entry.kind)}" data-visual-key="${esc(entry.assetKey)}" data-visual-use="${esc(use)}">
    ${image}
    <figcaption><b>${esc(visualKindLabel(entry.kind))}</b><span>${esc(humanize(entry.provenanceClass))} · ${esc(entry.source)}</span>${renderContext}${limitation ? `<span class="wvisual-limit">${esc(limitation)}</span>` : ''}</figcaption>
  </figure>`;
}

function renderVisualStrip(refs, index, esc, { use = 'reference', primary = false, label = 'Canonical components' } = {}) {
  const entries = refs.map((ref) => index.get(`${ref.domain}:${ref.id}`)).filter(Boolean);
  if (!entries.length) return '';
  return `<div class="wvisual-strip" aria-label="${esc(label)}">${entries.map((entry, index) => renderWikiVisual(entry, esc, { use, compact: true, primary: primary && index === 0 })).join('')}</div>`;
}

// ================================================================ THE ROSTERS
export function rosterSpecs(D, esc, T = null, V = null) {
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
  const SM = D.domains.shrineMovement;
  const MB = T?.measuredBuilds;
  const buildSample = T?.sample?.builds;
  const tierEvidenceReady = T?.schema === 2 && !!MB && !!buildSample;
  const visuals = visualIndex(V);

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
  const rangePlot = (reading, label, unit, sampleN = reading?.n) => {
    if (![reading?.p10, reading?.median, reading?.p90].every(Number.isFinite)) return '';
    const span = reading.p90 - reading.p10;
    const medianPosition = span > 0 ? Math.max(0, Math.min(100, ((reading.median - reading.p10) / span) * 100)) : 50;
    const accessible = `${label}: P10 ${num(reading.p10)}, median ${num(reading.median)}, P90 ${num(reading.p90)} ${unit}; n=${sampleN}. Local row scale; fixture limitations are listed above.`;
    return `<div class="wrange" role="img" aria-label="${esc(accessible)}">
      <span class="wrange-track" style="--median:${num(medianPosition, 1)}%"><i class="wrange-mid"></i></span>
      <span class="wrange-values"><span>P10 ${num(reading.p10)}</span><span>median ${num(reading.median)}</span><span>P90 ${num(reading.p90)} ${esc(unit)}</span></span>
      <span class="wrange-limit">n=${num(sampleN)} · local row scale; compare printed values, not bar length · controlled-fixture limits above</span>
    </div>`;
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
    if (e.unlockedFromStart) return 'In the level-up pool from the first run.';
    const questIds = r.unlockedByQuests || [];
    const achievementIds = r.unlockedByAchievements || [];
    const routes = [
      ...questIds.map((id) => cardLink('quests', id, esc(questName(id)))),
      ...achievementIds.map((id) => cardLink('achievements', id, esc(A.entries[id]?.name || humanize(id)))),
    ];
    if (routes.length) {
      const independence = routes.length > 1 ? ' Either route independently makes it available.' : '';
      return `Unlocked by ${list(routes)}, then it joins the level-up pool.${independence}`;
    }
    return '';
  };

  const weaponsRoster = {
    section: 'Buildcraft',
    slug: 'weapons',
    domain: 'weapons',
    title: 'Weapons',
    tagline: 'The half of your build that fires itself.',
    lede: `Weapons fire on their own. You are offered them as you level, you feed the levels back into them, and ${evolvedWeaponCount} of them are end forms that only arrive with the right tome and a boss chest. The one you aim by hand is a core weapon, and it has its own page.`,
    omissions: '<b>There is no damage-per-second column, on purpose.</b> The game never works one out: your might and your crit multiply the damage, your attack speed divides the interval, and half of these do not fire in a way that "damage times shots per second" describes at all. A beam ramps the longer it holds, a chain jump lands a flat share of the first hit, the shotgun pays more up close. One number would be wrong on most of these cards, so you get the base figures and the growth rule and you compare like with like. <b>Element is a look, not a rule</b>: it picks the color of the effect, and nothing in the game reads it for damage, resistance or status.',
    entries: weaponEntries,
    groups: [
      {
        key: 'base',
        title: 'Base weapons',
        /* THE LAST SENTENCE IS A REGRESSION GUARD, and bin/wiki-check.mjs pins it.
           An earlier version of this page read a character's startWeaponId as a
           weapon they begin the campaign holding. They do not: the standard solo
           campaign starts with the aimed core and nothing else. Reword it freely,
           update the pin with it, and keep saying the true thing. The sentence
           avoids an apostrophe on purpose: the pin is a plain substring match and
           the generator does not escape one, so a possessive here is a trap for
           whoever reworks this next. */
        note: `What the level-up offer draws from. ${freshBaseWeaponCount} are there on a fresh save, and the rest arrive through the quest or achievement routes named on each card. The weapon a character lists is a suggestion, not something they walk in holding.`,
        has: (e) => !e.evolved,
      },
      {
        key: 'evolved',
        title: 'Evolutions',
        note: 'End forms, never offered straight up. Each one is the payoff for maxing a specific weapon, holding its paired tome, and opening a boss chest. Turning one down is not final, the offer comes back at the next chest.',
        has: (e) => !!e.evolved,
      },
    ],
    facets: [
      { key: 'element', label: 'Element', of: (e) => e.element },
      { key: 'pattern', label: 'How it fires', of: (e) => e.pattern },
      {
        key: 'access',
        label: 'Availability',
        of: (e) => {
          if (e.evolved) return 'evolution';
          if (e.unlockedFromStart) return 'start';
          const refs = W.refs[e.id] || {};
          if (refs.unlockedByQuests?.length && refs.unlockedByAchievements?.length) return 'quest-or-achievement';
          return refs.unlockedByQuests?.length ? 'quest' : 'achievement';
        },
        name: (v) => ({
          start: 'From the start', quest: 'Quest', achievement: 'Achievement',
          'quest-or-achievement': 'Quest or achievement', evolution: 'Evolution',
        }[v] || v),
      },
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
          ${r.suggestedByCharacters?.length ? fact('Suggested by', `${list(r.suggestedByCharacters.map((id) => cardLink('characters', id, esc(charName(id)))))} as a default automatic-weapon identity; the standard solo campaign still starts with the aimed core only`) : ''}
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
      <div><span class="eyebrow">The same for every core</span><h3 id="aim-policy">How much the game helps you aim</h3></div>
      <div class="wmethod-grid">
        ${(C.aimPolicy.assistLevels || []).map((level) => `<div><b>${esc(humanize(level))}</b><span>Assist scale</span><code>${num(C.aimPolicy.assistScale[level], 4)}</code></div>`).join('')}
        <div><b>${esc(humanize(C.aimPolicy.defaultAssist))}</b><span>Default assist level</span><code>${esc(C.aimPolicy.defaultAssist)}</code></div>
        <div><b>${esc(humanize(C.aimPolicy.duelAssist))}</b><span>Duel normalization</span><code>${esc(C.aimPolicy.duelAssist)}</code></div>
        <div><b>${num(C.aimPolicy.minimumRangeM)} m</b><span>Minimum acquisition range</span><code>minimumRangeM</code></div>
        <div><b>${list(C.aimPolicy.minimumRangeExempt.map((id) => cardLink('cores', id, esc(coreName(id)))))}</b><span>Range-floor exemption</span><code>minimumRangeExempt</code></div>
      </div>
      <p>Every number here decides how much help you get pointing at something. None of them is damage, none of them is strength, and none of them is a ranking.</p>
      ${sourceParams(C.aimPolicy.provenance, 'Aim-policy provenance')}
    </section>`;
  const coresRoster = {
    section: 'Buildcraft',
    slug: 'cores',
    domain: 'coreWeapons',
    title: 'Core weapons',
    tagline: 'The one you aim yourself.',
    /* THE PIN. bin/wiki-check.mjs requires this lede to keep saying that the
       choice locks the aimed slot, and forbids the older claim that it was the
       only decision shaping a whole run, which was false: tomes, weapons,
       relics and blessings all shape one too. Reword around the kept phrase and
       leave the ban alone. */
    lede: `A core weapon is the one you point yourself. Picking it locks in that aimed-weapon slot before the run starts, all ${spell(C.count)} are open on a fresh save, and the level-up draft can never hand you a second one. The aim numbers on each card say how much the game helps you point it, and nothing at all about how hard it lands.`,
    omissions: `<b>No damage figures on this page, on purpose.</b> Clip size, reload, cooldown and damage multiplier for these ${spell(C.count)} are kept somewhere this page cannot read, and it will not guess at a number it cannot see. The unused evolution names sitting in the game files are not a mechanic you can reach and are not a promise of one. <b>Aim and forgiveness say how generous the targeting is</b>, never how much damage arrives. The pip count is here because the game tests it against the real clip.`,
    featureHtml: aimPolicyFeature,
    entries: coreEntries,
    groups: [{ key: 'all', title: 'Core selection', note: 'The order the picker puts them in. It is an order, not a ladder.', has: () => true }],
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
      <div><span class="eyebrow">How the curve bends</span><h3 id="power-ceiling-semantics">The knee, in the game's own words</h3></div>
      ${(D.powerCeiling.semantics || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      ${sourceParams({ source: D.powerCeiling.source }, 'Power-ceiling provenance')}
    </section>`;
  const powerCeilingRoster = {
    section: 'Buildcraft',
    slug: 'power-ceilings',
    domain: null,
    sourceKind: 'game rule',
    /* The page title also becomes the document title, as "WHOMP <title>" in
       lower case. "Where power stops paying" is the better heading and the worse
       browser tab, so the heading stays plain and the tagline carries the turn. */
    title: 'Diminishing returns',
    tagline: 'Attack speed and crit each stop paying full price somewhere.',
    lede: 'Permanent power does not climb forever. Past a point, more attack speed and more crit each buy you less than the last one did, and these four numbers are where that starts and how hard it bites.',
    omissions: '<b>This page will not work out what your own build gets.</b> The game keeps your permanent attack-speed bonus and your crit product to itself, and the buffs that come and go during a run land after these curves anyway. So the four numbers are here and the arithmetic on your run is not.',
    featureHtml: powerCeilingFeature,
    sourceLabel: D.powerCeiling.source,
    countLabel: `${powerCeilingEntries.length} dials`,
    entries: powerCeilingEntries,
    groups: [{ key: 'all', title: 'The four dials', note: 'All four, in the order the game keeps them.', has: () => true }],
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
    speed: maxOf(statEntries, (e) => E.refs[e.id]?.speedProfile?.liveRunBaseMps),
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
  const enemyScalingFeature = `
    <section class="wfeature" aria-labelledby="enemy-scaling-policy">
      <div><span class="eyebrow">Independent live-run clocks</span><h3 id="enemy-scaling-policy">Health, contact damage and kill XP scale separately</h3></div>
      <p>These are three different runtime steps, not one shared enemy-level curve.</p>
      <div class="wmethod-grid">
        <div><b>Spawn health</b><span>Every 25 seconds</span><code>+ ${pct(E.scaling.hpPer25s)}</code></div>
        <div><b>Contact damage</b><span>Every 30 seconds</span><code>+ ${pct(E.scaling.damagePer30s)}</code></div>
        <div><b>Kill XP reward</b><span>Every 120 build-clock seconds</span><code>+ ${pct(E.scaling.xpPer120s)}</code></div>
      </div>
      <p>Ordinary SpawnDirector wave health is resolved from its base before level/external multipliers and may also receive the mode-owned opening enemy HP bonus. Bosses, recurring minibosses, elites, set pieces and direct-spawn systems are excluded from that opening lever. Contact damage has its own elapsed-time step. Kill XP uses its separate build-clock step, then player and global XP multipliers apply.</p>
      ${sourceParams(E.scaling, 'Canonical scaling increments')}
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
    /* THE TAGLINE IS PINNED BY EXACT EQUALITY in bin/wiki-check.mjs. What the
       pin protects is the claim that this roster is complete AND that it does
       not describe every kind as a thing that walks up and touches you: snipers,
       bombers, strafers and spitters hold their distance on purpose. The second
       sentence now says that outright instead of merely avoiding the wrong
       phrasing. Change it and change the equality with it. */
    tagline: 'Every kind in the game. Several of them never come near you.',
    lede: 'What each kind does to you, and where you first run into it. Health, contact damage and kill XP are opening numbers that climb on three separate clocks while you play, so the sentence on a card outlives the bars underneath it.',
    omissions: `<b>Every time on this page is minutes of real play.</b> ${clockNote} For basic and special kinds, <b>the speed shown is a starting speed, not how fast the thing ends up chasing you</b>: the run keeps multiplying it, and single instances carry their own multipliers on top. <b>Bosses and minibosses carry no combat numbers here at all.</b> What they have, how hard they hit and how they move is decided while the fight is running, in stages, and differently by mode, so the leftover values sitting in their rows would be a guess wearing the clothes of a fact.`,
    featureHtml: `${enemyScalingFeature}${speedPolicyFeature}`,
    entries: enemyEntries,
    groups: [
      /* THE FIRST THREE NOTES CARRY PINNED SUBSTRINGS, checked against the
         rendered page by bin/wiki-check.mjs. Two of them promise that the
         behaviour sentence on a basic or special card is the behaviour that
         actually runs, which is what separates these tiers from the boss and
         miniboss rows; the third keeps the Maw out of the recurring cadence
         pool it does not belong to. Reword around them and move the pins with
         the wording, but never drop either claim. */
      { key: 'basic', title: 'Basic', note: 'The bulk of a run, and the only tier an elite can be promoted out of. The listed basic behaviour runs in live combat exactly as written, and one of these is never the problem: the count is the problem.', has: (e) => e.tier === 'basic' },
      { key: 'special', title: 'Special', note: 'Kinds that change how a fight works instead of how big it is. Their listed special behaviour also runs in live combat.', has: (e) => e.tier === 'special' },
      { key: 'miniboss', title: 'Minibosses', note: 'Bruiser, Warden, Ravager and Harrier are the four that keep coming back on a timer. The Maw is a separate authored set-piece and is not another turn of that timer. None of them arrives with numbers attached: what a miniboss is worth gets decided when it is sent.', has: (e) => e.tier === 'miniboss' },
      { key: 'boss', title: 'Bosses', note: 'Booked into a world at a fixed time rather than rolled for, and driven directly once they arrive. The behaviour names in this roster do not describe how a boss moves.', has: (e) => e.tier === 'boss' },
    ],
    facets: [
      { key: 'tier', label: 'Tier', of: (e) => e.tier },
      /* Boss/miniboss movement belongs to the director, not this registry
         placeholder. Returning null also keeps it out of card data attributes. */
      { key: 'behavior', label: 'Live behaviour', of: (e) => statTiers.has(e.tier) ? e.behavior : null },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => enemyEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'hp', label: 'Published health', of: (e) => statTiers.has(e.tier) ? e.hp : undefined, desc: true },
      { key: 'damage', label: 'Published contact damage', of: (e) => statTiers.has(e.tier) ? e.damage : undefined, desc: true },
      { key: 'xp', label: 'Published XP', of: (e) => statTiers.has(e.tier) ? e.xp : undefined, desc: true },
      { key: 'speed', label: 'Published live-run base speed', of: (e) => statTiers.has(e.tier) ? E.refs[e.id]?.speedProfile?.liveRunBaseMps : undefined, desc: true },
    ],
    searchText: (e) => `${e.tier} ${statTiers.has(e.tier) ? e.behavior : ''} enemy monster`,
    card: (e) => {
      const r = E.refs[e.id] || {};
      const where = enemyWhere(e);
      const boss = enemyBoss(e);
      const showStats = statTiers.has(e.tier);
      const showBehaviour = showStats && BEHAVIOR_NOTE[e.behavior];
      const speed = showStats ? r.speedProfile : null;
      return `
        <div class="wtags">
          ${tag(esc(humanize(e.tier)), e.tier === 'boss' ? 'pink' : e.tier === 'miniboss' ? 'gold' : e.tier === 'special' ? 'violet' : '')}
          ${showStats ? tag(esc(humanize(e.behavior)), 'cyan') : ''}
          ${speed ? (speed.liveRunBandApplied ? tag(`Speed &times;${num(speed.liveRunMultiplier)}`, 'gold') : tag('Base speed unchanged', '')) : ''}
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
          ${!showStats ? fact('Contextual mechanics', '<b>UNMEASURED</b>: health, damage, behavior and final chase speed are set through private, multi-stage runtime authority.') : ''}
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
  const relicWeightTotal = Object.values(R.baseWeights || {}).reduce((sum, weight) => sum + weight, 0);
  const relicsRoster = {
    section: 'Buildcraft',
    slug: 'relics',
    domain: 'relics',
    title: 'Relics',
    tagline: 'Small things you pick up, and keep picking up.',
    lede: 'A relic is a find you can take again and again until it hits its ceiling. Most of them are one small number in your favor, a few of them are one small number in your favor and a smaller one against you, and the rare ones are rare because the game says so.',
    omissions: '<b>No relic has a letter grade here.</b> Grading one would mean first deciding which build it is sitting in and what the chests cost that run, and neither of those has been measured, so a ladder would be a guess said with a straight face. Every relic in the game is on this page. The order they sit in is not a ranking.',
    entries: relicEntries,
    groups: ['common', 'rare', 'epic', 'legendary'].map((rarity) => ({
      key: rarity,
      title: humanize(rarity),
      note: R.baseWeights?.[rarity] !== undefined
        ? `Drawn with weight ${R.baseWeights[rarity]} out of ${relicWeightTotal}.`
        : '',
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
    icon: (e) => e.icon,
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
  const passiveAccess = (entry) => {
    if (entry.unlockedFromStart) return 'from the start';
    if (P.refs[entry.id]?.runtimeUnlock) return 'signature-boss milestone';
    return 'achievement';
  };
  const tomesRoster = {
    section: 'Buildcraft',
    slug: 'tomes',
    domain: 'passives',
    title: 'Tomes',
    tagline: 'The stat half of your build.',
    lede: `A tome raises one number and keeps raising it every time you take it again. Nothing here fires, aims or lands: this is the half of a build that quietly makes the other half bigger, and ${spell(evolutionsByPassive.size)} of them are also the key to a weapon end form.`,
    omissions: '<b>No tome has a letter grade here.</b> A tome is worth whatever the build around it is worth, and nobody has picked the build to measure it against yet, so putting these in order would be inventing a fact rather than reporting one. What each level actually adds is on the card, and you can do the comparing.',
    entries: passiveEntries,
    groups: [
      { key: 'start', title: 'Available from the start', note: 'Offered from the first run, before you have earned anything.', has: (e) => e.unlockedFromStart },
      { key: 'milestone', title: 'Campaign milestone unlock', note: 'Arrives when the campaign hits its signature-boss milestone, and stays in the pool afterwards.', has: (e) => !!P.refs[e.id]?.runtimeUnlock },
      { key: 'earned', title: 'Achievement unlocks', note: 'Locked until you do the thing. The achievement that opens each one is on its card.', has: (e) => !e.unlockedFromStart && !P.refs[e.id]?.runtimeUnlock },
    ],
    facets: [
      { key: 'access', label: 'Availability', of: passiveAccess },
      { key: 'stat', label: 'Stat', of: (e) => e.stat },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => passiveEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'levels', label: 'Max level', of: (e) => e.maxLevel, desc: true },
    ],
    searchText: (e) => `${e.desc} ${e.stat} tome passive ${passiveAccess(e)} ${P.refs[e.id]?.runtimeUnlock?.description || ''}`,
    card: (e) => {
      const unlocks = inverseUnlocks.get(`passive:${e.id}`) || [];
      const recipes = evolutionsByPassive.get(e.id) || [];
      const runtimeUnlock = P.refs[e.id]?.runtimeUnlock;
      const availability = runtimeUnlock
        ? `${esc(runtimeUnlock.description)} <span class="wsub">${esc(humanize(runtimeUnlock.scope))} · ${runtimeUnlock.requiredMilestones} milestone · ${runtimeUnlock.permanent ? 'permanent' : 'run-scoped'} · ${esc(humanize(runtimeUnlock.availability))}</span>`
        : unlocks.length
          ? list(unlocks.map((row) => cardLink('achievements', row.id, esc(row.name))))
          : 'In the tome pool from the first run.';
      return `
        <div class="wtags">${tag(esc(humanize(e.stat)), 'cyan')}${tag(esc(humanize(passiveAccess(e))), e.unlockedFromStart ? '' : 'gold')}</div>
        <p class="wdesc">${esc(e.desc)}</p>
        <div class="wfacts">
          ${fact('Levels', `<b>${e.maxLevel}</b> max, source payload <b>${num(e.perLevel)}</b> per level${e.shieldRegenPerLevel !== undefined ? `, shield regen <b>${num(e.shieldRegenPerLevel)}</b> per level` : ''}`)}
          ${fact(runtimeUnlock ? 'Runtime unlock' : unlocks.length ? 'Unlocked by' : 'Availability', availability)}
          ${recipes.length ? fact('Evolution key', list(recipes.map((row) => `${cardLink('weapons', row.baseId, esc(weaponName(row.baseId)))} into ${cardLink('weapons', row.evolvedId, esc(weaponName(row.evolvedId)))}`))) : ''}
        </div>
        ${runtimeUnlock ? sourceParams(runtimeUnlock.provenance, 'Runtime-unlock provenance') : ''}`;
    },
  };

  // ---- legendary upgrades -------------------------------------------------
  const legendaryEntries = ordered(LG);
  const legendariesRoster = {
    section: 'Buildcraft',
    slug: 'legendaries',
    domain: 'legendaries',
    title: 'Legendary upgrades',
    tagline: `A run holds ${spell(LG.cap)} of the ${legendaryEntries.length}.`,
    lede: `A legendary is the upgrade a run gets remembered for. There are ${legendaryEntries.length} of them and you can carry ${spell(LG.cap)} at once, so most of this page is the part you did not get.`,
    entries: legendaryEntries,
    groups: [{ key: 'all', title: 'Legendary pool', note: `All ${legendaryEntries.length}. You will be holding ${spell(LG.cap)} at most.`, has: () => true }],
    facets: [{ key: 'shape', label: 'Parameter shape', of: (e) => Object.keys(e.params || {}).length > 1 ? 'multi-part' : 'single-part' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => legendaryEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.desc} ${e.effect} legendary ${Object.keys(e.params || {}).join(' ')}`,
    accent: (e) => colorHex(e.color),
    icon: (e) => e.icon,
    card: (e) => `
      <div class="wtags">${tag('Legendary', 'gold')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <p class="wgloss">${esc(e.effect)}</p>
      ${sourceParams(e.params)}`,
  };

  // ---- shrine blessings ---------------------------------------------------
  const blessingEntries = ordered(BL);
  const shrineRuntimeFeature = (id) => `
    <section class="wfeature" aria-labelledby="${id}">
      <div><span class="eyebrow">What lighting one up actually does</span><h3 id="${id}">Blessings first, then a legendary or a way to move</h3></div>
      <p>A normal world shrine that lights up has <b>${num(SM.runtime.normalWorldShrineMovementSlots)}</b> movement slot to fill, and it only fills if no legendary replacement arrived first. Directive and merchant offers do not carry that slot at all.</p>
      ${(SM.runtime.semantics || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      ${sourceParams(SM.runtime.provenance, 'Shrine runtime provenance')}
    </section>`;
  const blessingsRoster = {
    section: 'Buildcraft',
    slug: 'blessings',
    domain: 'shrineBlessings',
    title: 'Shrine blessings',
    tagline: 'The three a shrine puts in front of you.',
    /* THE PIN, and bin/wiki-check.mjs holds both halves of it. This page used to
       read as the whole of what a shrine can do, which it is not: a legendary
       replacement can arrive instead, and a movement offering can follow. Both
       sentences below are pinned by their wording. Reword them freely, move the
       pin with them, and keep saying that the trio is a part and not the total. */
    lede: `A shrine you activate offers three, drawn from these ${blessingEntries.length}. That trio is only part of what a shrine can do, because a legendary replacement can turn up ahead of the blessing menu and a way to move can follow it, so this page is not the complete set of shrine outcomes.`,
    featureHtml: shrineRuntimeFeature('blessing-shrine-runtime'),
    entries: blessingEntries,
    groups: [{ key: 'all', title: 'Blessing registry', note: 'Every option the trio can be drawn from. The movement offering that can follow it has its own page.', has: () => true }],
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

  // ---- live shrine movement offerings ------------------------------------
  const shrineMovementEntries = ordered(SM);
  const cappedMovementCount = shrineMovementEntries.filter((entry) => entry.maxStacks !== undefined).length;
  const uncappedMovementNames = shrineMovementEntries.filter((entry) => entry.maxStacks === undefined).map((entry) => entry.name);
  const shrineMovementRoster = {
    section: 'Buildcraft',
    slug: 'shrine-movement',
    domain: 'shrineMovement',
    title: 'Shrine movement',
    tagline: `The ${spell(shrineMovementEntries.length)} ways a shrine changes how you move.`,
    lede: `Once a shrine has offered its blessings, it draws one movement offering from these ${spell(shrineMovementEntries.length)}, unless a legendary replacement took that slot first. ${spellCap(cappedMovementCount)} of them stop being offered once you have taken them to their ceiling, and ${list(uncappedMovementNames)} never does, so there is always something left to draw.`,
    featureHtml: shrineRuntimeFeature('movement-shrine-runtime'),
    entries: shrineMovementEntries,
    groups: [{ key: 'all', title: 'Live movement offering pool', note: `All ${spell(shrineMovementEntries.length)}, in the order the game draws them.`, has: () => true }],
    facets: [{ key: 'stat', label: 'Stat', of: (e) => e.stat }],
    sorts: [
      { key: 'roster', label: 'Draw order', of: (e) => shrineMovementEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'value', label: 'Source value', of: (e) => e.value, desc: true },
    ],
    searchText: (e) => `${e.desc} ${e.stat} shrine movement offering ${e.glyph} ${(SM.runtime.semantics || []).join(' ')}`,
    accent: (e) => colorHex(e.color),
    card: (e) => `
      <div class="wtags">${tag('World-shrine offering', 'gold')}${tag(esc(humanize(e.stat)), 'cyan')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${fact('Source value', `<b>${num(e.value)}</b> applied to <code>${esc(e.stat)}</code>`)}
        ${e.maxStacks !== undefined ? fact('Stack ceiling', `<b>${num(e.maxStacks)}</b>; leaves the eligible pool at cap`) : fact('Stack ceiling', 'Uncapped; remains eligible')}
        ${fact('Glyph', `<b>${esc(e.glyph)}</b>`)}
      </div>`,
  };

  // ---- utility abilities --------------------------------------------------
  const utilityEntries = ordered(UT);
  const utilitiesRoster = {
    section: 'Buildcraft',
    slug: 'utilities',
    domain: 'utilities',
    title: 'Utility abilities',
    tagline: 'The F key, and what you put under it.',
    lede: `You carry one of these and you press F. ${UT.entries[UT.starterId]?.name || 'The starter'} is the one you already have, the other ${spell(utilityEntries.length - 1)} cost gold, and every one of them is a cooldown you have to spend at the right moment.`,
    entries: utilityEntries,
    groups: [
      { key: 'starter', title: 'Starter utility', note: 'What you are holding before you buy anything.', has: (e) => e.id === UT.starterId },
      { key: 'forge', title: 'Unlockable utilities', note: 'The rest, each with a price on it.', has: (e) => e.id !== UT.starterId },
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

  // ---- player ultimate ----------------------------------------------------
  const ultimateEntries = ordered(UL);
  const ultimateRuntime = UL.runtime || { owner: '', slot: '', availability: {}, semantics: [] };
  const ultimateAvailability = ultimateRuntime.availability.fromRunStart
    ? ultimateRuntime.availability.scope === 'standard-player-run'
      ? 'Armed from the first second of a normal run'
      : 'Armed from the first second of the run'
    : ultimateRuntime.availability.requiresBossKill
      ? 'Armed once a boss goes down'
      : 'Armed when the game decides to arm it';
  const ultimateRuntimeFeature = `
    <section class="wfeature" aria-labelledby="ultimate-runtime">
      <div><span class="eyebrow">What the game promises about it</span><h3 id="ultimate-runtime">Who holds it, and when it is ready</h3></div>
      <ul>${ultimateRuntime.semantics.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      ${sourceParams(ultimateRuntime.availability || {}, 'Ultimate availability contract')}
      ${sourceParams(ultimateRuntime.provenance || {}, 'Ultimate runtime provenance')}
    </section>`;
  const ultimatesRoster = {
    section: 'Buildcraft',
    slug: 'ultimates',
    domain: 'ultimates',
    /* The heading and the document title are both pinned to this exact string
       by bin/wiki-check.mjs, which also forbids the doubled "WHOMP whomp
       ultimate" the qualifier used to produce. The page name stays put; the
       tagline and lede carry the voice. */
    title: 'WHOMP Ultimate',
    tagline: `One ability, held on ${ultimateRuntime.slot}. ${ultimateAvailability}.`,
    lede: `There is exactly one ultimate and the ${ultimateRuntime.owner} is the one holding it. ${ultimateAvailability}, it comes down on ${ultimateRuntime.slot}, and the cooldown printed here is the number the game starts from before anything you are carrying cuts into it.`,
    featureHtml: ultimateRuntimeFeature,
    entries: ultimateEntries,
    groups: [{
      key: 'all',
      title: `${humanize(ultimateRuntime.owner)} ultimate ability`,
      note: ultimateEntries.length === 1
        ? `Every ultimate the ${ultimateRuntime.owner} can hold. There is one of them.`
        : `Every ultimate the ${ultimateRuntime.owner} can hold, and there are ${ultimateEntries.length}.`,
      has: () => true,
    }],
    facets: [],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => ultimateEntries.indexOf(e) }],
    searchText: (e) => `${e.desc} ${ultimateRuntime.owner} ultimate ability ${ultimateRuntime.slot} slot ${ultimateAvailability} ${ultimateRuntime.availability.scope || ''} ${ultimateRuntime.semantics.join(' ')} ${Object.keys(e.params || {}).join(' ')}`,
    icon: (e) => e.icon,
    card: (e) => `
      <div class="wtags">${tag(`${esc(humanize(ultimateRuntime.owner))} ability`, 'cyan')}${tag(`${esc(ultimateRuntime.slot)} slot`, 'violet')}${tag(esc(ultimateAvailability), 'gold')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${fact('Owner', `<b>${esc(humanize(ultimateRuntime.owner))}</b>`)}
        ${fact('Input slot', `<b>${esc(ultimateRuntime.slot)}</b>`)}
        ${fact('Availability', `<b>${esc(ultimateAvailability)}</b>${ultimateRuntime.availability.requiresBossKill ? '' : ' · no boss kill required'}`)}
        ${fact('Applies to', `<b>${esc(humanize(String(ultimateRuntime.availability.scope).replace(/[-_]+/g, ' ')))}</b>`)}
        ${fact('Base cooldown', `<b>${cooldown(e.cooldownMs)}</b>, before your own gear touches it`)}
      </div>
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
    tagline: `${spellCap(evolutionEntries.length)} recipes, each one the end of a weapon.`,
    lede: `Max the weapon, hold the tome it wants, then open a boss chest. What comes out is the end form, it does not level any further, and these ${spell(evolutionEntries.length)} are all of them.`,
    entries: evolutionEntries,
    groups: [{ key: 'all', title: 'Recipes', note: `All ${spell(evolutionEntries.length)}. There is not another one waiting to be found.`, has: () => true }],
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
    /* THE TITLE IS PINNED by bin/wiki-check.mjs, which also forbids the two
       claims this page used to make: that these arrive from chests, and that
       this short list is the whole live movement pool. Neither is true. Keep
       the word "Legacy" doing its job and keep both bans intact. */
    title: 'Legacy jump augment aliases',
    tagline: `${spellCap(jumpEntries.length)} old names for offerings that live somewhere else now.`,
    lede: `The game still keeps ${spell(jumpEntries.length)} older names for ${list(jumpEntries.map((entry) => entry.name))}. They are names and nothing more: neither one is handed out here, the shrine is where both are actually offered, and every card points at the offering it stands for.`,
    entries: jumpEntries,
    groups: [{ key: 'all', title: 'Legacy aliases', note: 'Names only. The pool you actually draw from is on the Shrine movement page.', has: () => true }],
    facets: [{ key: 'stat', label: 'Stat', of: (e) => e.stat }],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => jumpEntries.indexOf(e) }],
    searchText: (e) => `${e.desc} ${e.stat} legacy jump movement augment alias ${SM.entries[JA.refs[e.id]?.shrineMovementOffering]?.name || ''}`,
    accent: (e) => colorHex(e.color),
    card: (e) => {
      const offeringId = JA.refs[e.id]?.shrineMovementOffering;
      return `
        <div class="wtags">${tag('Legacy alias', 'gold')}${tag(esc(humanize(e.stat)), 'cyan')}</div>
        <p class="wdesc">${esc(e.desc)}</p>
        <div class="wfacts">
          ${fact('What it adds', `<b>${num(e.perLevel)}</b> per level${e.maxLevel ? `, <b>${e.maxLevel}</b> levels max` : ''}`)}
          ${fact('Offered as', cardLink('shrine-movement', offeringId, esc(SM.entries[offeringId]?.name || humanize(offeringId))))}
        </div>`;
    },
  };

  // ---- characters ---------------------------------------------------------
  const characterEntries = ordered(CH);
  const characterBaseRuntime = CH.runtime.baseStats;
  const characterWeaponRuntime = CH.runtime.weaponIdentity;
  const characterBaseFeature = `
    <section class="wfeature" aria-labelledby="character-base-inputs">
      <div><span class="eyebrow">Runtime interpretation</span><h3 id="character-base-inputs">Loadout suggestion and authored identity inputs</h3></div>
      ${(characterWeaponRuntime.semantics || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      ${sourceParams(characterWeaponRuntime.provenance, 'Suggested-weapon provenance')}
      ${Object.entries(characterBaseRuntime).map(([key, contract]) => `<div class="wmethod-row">
        <b>${esc(humanize(key))}</b><span>${esc(contract.semantics)}</span>
        ${sourceParams(contract.provenance, `${humanize(key)} provenance`)}
      </div>`).join('')}
    </section>`;
  const charactersRoster = {
    section: 'Heroes',
    slug: 'characters',
    domain: 'characters',
    title: 'Characters',
    tagline: 'Who you start as, before the run starts rewriting it.',
    /* THE SECOND SENTENCE CARRIES THREE REGRESSION GUARDS in plain words, and
       bin/wiki-check.mjs pins their labelled forms on the cards and the sort
       menu: health is a run-start base, the speed number is an identity input
       rather than metres per second, might is a multiplier rather than final
       damage, and the listed weapon is a suggestion the solo campaign does not
       actually hand you. Reword freely and keep all four true. */
    lede: 'A character is a starting health number, a speed, a damage multiplier, one passive rule and one signature move. The three numbers are inputs the run multiplies, not the speed you travel at or the damage you land, and the weapon named on a card is a suggestion rather than something you walk in holding.',
    featureHtml: characterBaseFeature,
    entries: characterEntries,
    groups: [
      { key: 'start', title: 'Character roster', note: 'Every one of them, in the order the game lists them.', has: () => true },
    ],
    facets: [
      { key: 'weapon', label: 'Suggested weapon', of: (e) => e.startWeaponId, name: weaponName },
      { key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'unlockable' },
    ],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => characterEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'health', label: 'Run-start health base', of: (e) => e.baseStats?.maxHp, desc: true },
      { key: 'speed', label: `Speed identity input (relative to ${characterBaseRuntime.speed.reference})`, of: (e) => e.baseStats?.speed, desc: true },
      { key: 'might', label: 'Damage identity multiplier input', of: (e) => e.baseStats?.might, desc: true },
    ],
    searchText: (e) => `${e.desc} character hero ${weaponName(e.startWeaponId)} ${IN.entries[e.innateId]?.name || ''} ${SG.entries[e.signatureId]?.name || ''}`,
    card: (e) => `
      <div class="wtags">${tag(e.unlockedFromStart ? 'From the start' : 'Unlockable', e.unlockedFromStart ? 'cyan' : 'gold')}</div>
      <p class="wdesc">${esc(e.desc)}</p>
      <div class="wfacts">
        ${fact('Suggested weapon', `${cardLink('weapons', e.startWeaponId, esc(weaponName(e.startWeaponId)))} <span class="wsub">default-loadout identity; standard solo campaign grants the aimed core only</span>`)}
        ${fact('Innate', cardLink('innates', e.innateId, esc(IN.entries[e.innateId]?.name || humanize(e.innateId))))}
        ${fact('Signature', cardLink('signatures', e.signatureId, esc(SG.entries[e.signatureId]?.name || humanize(e.signatureId))))}
        ${fact('Run-start health base', `<b>${num(e.baseStats?.maxHp)} ${esc(characterBaseRuntime.maxHp.unit)}</b>, before shop and other run-start bonuses`)}
        ${fact(`Speed identity input (relative to ${characterBaseRuntime.speed.reference})`, `<b>${num(e.baseStats?.speed)}</b> authored input; runtime identity multiplier <b>&times;${num(e.baseStats?.speed / characterBaseRuntime.speed.reference)}</b>, not m/s`)}
        ${fact('Damage identity multiplier input', `<b>&times;${num(e.baseStats?.might)}</b> in the multiplicative damage product, not final damage`)}
      </div>`,
  };

  // ---- innates ------------------------------------------------------------
  const innateEntries = ordered(IN);
  const innatesRoster = {
    section: 'Heroes',
    slug: 'innates',
    domain: 'innates',
    title: 'Innates',
    /* The tagline was already right: concrete, one turn, no machinery. Left
       alone on purpose rather than rewritten for the sake of a diff. */
    tagline: 'The passive rule each character brings.',
    lede: 'An innate belongs to one character and arrives with them, and the sentence on each card is the one you are shown at character select. You do not pick it and you do not spend anything on it; the three numbers underneath are where it starts, what a level adds, and where it stops climbing.',
    entries: innateEntries,
    groups: [{ key: 'all', title: 'Innate roster', note: 'One for each character, in the order the characters are listed.', has: () => true }],
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
    tagline: 'One move bound to R, and then the wait.',
    lede: 'A signature is the one thing you press on purpose that is not a weapon. Each character has exactly one, nobody shares, and the only thing standing between two uses of it is the cooldown.',
    entries: signatureEntries,
    groups: [{ key: 'all', title: 'Signature roster', note: 'One for each character, and no two of them overlap.', has: () => true }],
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
  const bossDetails = (e) => `<details class="wraw wschedule"><summary>Authored signature-boss schedule <span>${e.bosses?.length || 0}</span></summary><ol>${(e.bosses || [])
    .map((row) => `<li>${cardLink('bestiary', row.kindId, esc(enemyName(row.kindId)))} <span>${esc(scheduleTime(row.atSec))}</span>${row.signature ? '<code>signature slot</code>' : ''}</li>`)
    .join('')}</ol></details>`;
  const encounterSchedule = D.world.encounterSchedule;
  const encounterScheduleFeature = (id) => `
    <section class="wfeature" aria-labelledby="${id}">
      <div><span class="eyebrow">Cadence evidence</span><h3 id="${id}">Authored tables plus automatic-miniboss cadence context</h3></div>
      <p>The exported interval is <b>${num(encounterSchedule.automaticMinibossCadenceSec)} seconds</b> on the ${esc(humanize(encounterSchedule.cadenceClock))}. In the unified profile that is <b>${mmss(encounterSchedule.unifiedProfilePreBankIntervalElapsedSec)}</b> elapsed before the pacing bank and <b>${mmss(encounterSchedule.unifiedProfileEndlessIntervalElapsedSec)}</b> in endless play. These are independently derived phase intervals, not exact encounter timestamps or miniboss identities.</p>
      ${(encounterSchedule.semantics || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      ${(encounterSchedule.limits || []).map((line) => `<p class="womit">${esc(line)}</p>`).join('')}
      ${sourceParams(encounterSchedule.provenance, 'Encounter-schedule provenance')}
    </section>`;
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
    /* EVERY WORLD SHIPS ITS OWN TAGLINE and the card prints it verbatim from
       src/data/levels.ts. Scorchdune telling you to bring water, and that it
       will not help, is better than anything this page can put above it, so the
       page copy frames those lines and never competes with them. */
    tagline: 'The campaign, in the order it lets you have it.',
    lede: 'Each world names itself in one line, and that line is usually the honest summary. Underneath it is everything the line leaves out: what spawns there and when, which bosses are already booked, what the ground is made of, and which world you have to get through to reach it.',
    /* Deliberately NOT the same paragraph as the expeditions omissions box. The
       shared limit underneath both is real, so both still state it, but a reader
       moving between the two pages should be told the thing that is true of the
       page they are on, not handed the same notice twice. */
    omissions: `<b>The boss slots are booked, the minibosses are not.</b> Each world was written with the rows and the signature-boss times you see on its card. The automatic minibosses run to an interval laid over all of that, so the game will tell you how often one is due and never which one or exactly when. Authored times became real minutes only where the shared pace scale holds. ${clockNote}`,
    featureHtml: encounterScheduleFeature('campaign-encounter-schedule'),
    entries: worldEntries,
    groups: [
      { key: 'campaign', title: 'Campaign route', note: 'The chain the game walks you along, in order.', has: (e) => (L.campaignLevelIds || []).includes(e.id) },
      { key: 'additional', title: 'Additional worlds', note: 'Built, registered and playable, and not on that chain.', has: (e) => !(L.campaignLevelIds || []).includes(e.id) },
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
    tagline: 'Arenas that sit outside the campaign entirely.',
    /* The "connected to none of it" claim is structural, not editorial: an
       expedition entry carries no unlocks field, nothing unlocks it, and its
       refs carry no shipCore, unlike every world on the campaign route. See
       the registry header in src/data/levels.ts, which calls them a parallel
       mode rather than part of the unlock ladder. */
    lede: 'An expedition is built like a campaign world and connected to none of it. Nothing unlocks it, nothing follows it and no ship core comes out of it, so the only reason to go is that you wanted to.',
    omissions: `<b>Nothing on this page is progression.</b> An expedition unlocks nothing and is unlocked by nothing, so a card here is only ever the arena itself. Its rows and its signature-boss times were written by hand the same way a world is, and the automatic minibosses laid over them are the same unpublished interval: how often, never which one and never when. ${clockNote}`,
    featureHtml: encounterScheduleFeature('expedition-encounter-schedule'),
    entries: expeditionEntries,
    groups: [{ key: 'all', title: 'Expedition roster', note: 'Every expedition there is, in the order the game lists them.', has: () => true }],
    facets: [{ key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'unlockable' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => expeditionEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.tagline} expedition arena ${e.paletteId} ${(EX.refs[e.id]?.enemyKinds || []).map(enemyName).join(' ')}`,
    card: (e) => worldCard(e, EX.refs[e.id] || {}),
  };

  // ---- run modes ----------------------------------------------------------
  const openingEnemyHp = RM.openingEnemyHpBonus;
  const openingEnemyHpFeature = `
    <section class="wfeature" aria-labelledby="opening-enemy-hp-policy">
      <div><span class="eyebrow">Spawn-health contract</span><h3 id="opening-enemy-hp-policy">Opening enemy HP bonus</h3></div>
      <p>Each mode's <code>${esc(openingEnemyHp.field)}</code> applies only to <b>${esc(humanize(openingEnemyHp.appliesTo))}</b>. It fades <b>${esc(openingEnemyHp.fade)}</b> on the <b>${esc(humanize(openingEnemyHp.fadeClock))}</b> from ${mmss(openingEnemyHp.startsAtPaceSec)} to zero by <b>${mmss(openingEnemyHp.fadesToZeroAtPaceSec)}</b>. In the unified profile that threshold is <b>${mmss(openingEnemyHp.unifiedProfileElapsedSec)}</b> of real play.</p>
      <details class="wraw"><summary>Excluded spawn authorities <span>${openingEnemyHp.excludes.length}</span></summary><ul>${openingEnemyHp.excludes.map((line) => `<li>${esc(line)}</li>`).join('')}</ul></details>
      ${(openingEnemyHp.semantics || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      ${sourceParams(openingEnemyHp.provenance, 'Opening-HP provenance')}
    </section>`;
  const modeEntries = ordered(RM, (e) => ({ ...e, name: humanize(e.id) }));
  const runModesRoster = {
    section: 'World',
    slug: 'modes',
    domain: 'runModes',
    title: 'Run modes',
    tagline: 'The clock and the handling a whole run is played on.',
    lede: 'A mode is not a difficulty setting. It is the entire set of numbers a run is played on: how fast its clock runs against real time, when the pacing bank closes, when the final horde is due, how you move, and how hard the opening pushes back.',
    featureHtml: openingEnemyHpFeature,
    entries: modeEntries,
    groups: [{ key: 'all', title: 'Mode profiles', note: 'Every mode the game will put you in, with nothing held back from the profile.', has: () => true }],
    facets: [
      { key: 'flyers', label: 'Flying enemies', of: (e) => e.allowFlyers ? 'enabled' : 'disabled' },
      { key: 'ladder', label: 'Tier ladder', of: (e) => e.tierLadderEnabled ? 'enabled' : 'disabled' },
    ],
    sorts: [{ key: 'roster', label: 'Roster order', of: (e) => modeEntries.indexOf(e) }],
    searchText: (e) => `${e.id} run mode pace endless movement camera flyers events opening enemy HP bonus linear fade ${openingEnemyHp.fadesToZeroAtPaceSec} pace seconds unified ${openingEnemyHp.unifiedProfileElapsedSec} elapsed seconds`,
    card: (e) => `
      <div class="wtags">${tag(e.allowFlyers ? 'Flyers enabled' : 'No flyers', 'cyan')}${tag(e.tierLadderEnabled ? 'Tier ladder' : 'No tier ladder', 'violet')}</div>
      <div class="wfacts">
        ${fact('Pace clock', `<b>${num(e.paceScale)}</b> pace seconds per real second`)}
        ${fact('Pacing bank', `<b>${mmss(e.bankAtElapsedSec)}</b> real time`)}
        ${fact('Final horde', `<b>${playClock(e.finalHordeAtPaceSec) || `${e.finalHordeAtPaceSec} pace seconds`}</b>`)}
        ${fact('Victory choice', bool(e.offersVictoryChoice))}
        ${fact('Opening enemy HP bonus', `<b>${pct(e[openingEnemyHp.field])}</b> on ordinary SpawnDirector wave health at run start; ${esc(openingEnemyHp.fade)} fade to <b>0%</b> by ${mmss(openingEnemyHp.fadesToZeroAtPaceSec)} on the mode-profiled pace clock <span class="wsub">(${mmss(openingEnemyHp.unifiedProfileElapsedSec)} real-play equivalent in the unified profile; excluded authorities are listed above)</span>`)}
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
    tagline: 'Placed before you arrive, and found only by walking into them.',
    lede: 'A rare event is put somewhere in a world before you get there and then stays put. Each one carries a weight that decides how often it is picked, a limit on how many a single run can hold, a minimum distance from the others, and a list of worlds that will take it.',
    featureHtml: worldEventFeature,
    entries: worldEventEntries,
    groups: [{ key: 'all', title: 'The rare-event pool', note: 'A single run only ever places a few of these.', has: () => true }],
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
    tagline: 'The things a world does whether or not you are watching.',
    lede: 'Ambient events are set per world rather than per event, so the cards here are worlds. Each one lists what that place is allowed to grow, drop or send drifting past you, and a world only ever runs what is on its own line.',
    featureHtml: ambientFeature,
    entries: ambientEntries,
    groups: [
      { key: 'campaign', title: 'Campaign worlds', note: 'Campaign worlds that keep a table of their own.', has: (e) => !!AE.refs[e.id]?.campaignLevel },
      { key: 'expedition', title: 'Expeditions', note: 'The expedition arenas, which keep separate tables.', has: (e) => !!AE.refs[e.id]?.expedition },
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
    tagline: `${shipCoreEntries.length} pieces of your ship, and a world is sitting on each one.`,
    lede: 'A core is one of your own ship systems, carried back off the boss that closes a world. Each one is awarded once and never again, and each one comes home with a memory in it.',
    omissions: '<b>There is no bonus column here, because a core does not have one.</b> Bringing one home changes the ship and the ground it stands on, and it does nothing at all to the numbers in your next run.',
    entries: shipCoreEntries,
    groups: [{ key: 'all', title: 'Recovered systems', note: `All ${shipCoreEntries.length}, in the order the campaign hands them over.`, has: () => true }],
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
    tagline: `${shipFragmentEntries.length} pieces of the ship that never made it to the wreck.`,
    lede: 'These came down away from the wreck and stayed where they landed, out along the routes that lead off the hub. Nobody local has been in a hurry about them.',
    omissions: '<b>The route is as precise as this gets.</b> A fragment is somewhere out along the one route named on its card, and which somewhere is a thing the hub knows and this page does not.',
    entries: shipFragmentEntries,
    groups: [{ key: 'all', title: 'The fragments', note: `All ${shipFragmentEntries.length}, in the order the hub lays the routes out.`, has: () => true }],
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
      <div><span class="eyebrow">How the wreck comes back</span><h3 id="ship-rebuild-tiers">The rebuild, stage by stage</h3></div>
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
    tagline: 'One socket per core, and what the ship looks like as they fill.',
    lede: `There is one socket per core, laid out in the order the campaign fills them, with the memory archive at the centre of the ring instead of out on it. As the cores come back the wreck stops looking like a wreck, in ${SS.rebuildTierCount} stages. Every count of cores you could be holding${rebuildCoreRange} is written down against the stage it puts you at.`,
    omissions: '<b>Fragments do not seat in these sockets.</b> A fragment names a system, and a socket names a system, and the game never says the one goes into the other.',
    featureHtml: shipSystemFeature,
    countLabel: `${SS.count} sockets · ${SS.rebuildTierCount} rebuild tiers`,
    entries: shipSystemEntries,
    groups: [
      { key: 'heart', title: 'Heart socket', note: 'The one socket at the centre of the ring rather than out on it. The whole story is about this one.', has: (e) => e.heart },
      { key: 'systems', title: 'System sockets', note: 'The rest of the ring, in the order the campaign fills it.', has: (e) => !e.heart },
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
  /* Counted, never typed out. The ladder can grow a row without a schema bump,
     and a hand-written "15 weapons" in the lede would quietly go wrong the day
     it does. Payload kinds are counted per payload, not per achievement,
     because one achievement can pay out more than one thing. */
  const achievementPayloads = achievementEntries.reduce((tally, e) => {
    for (const kind of Object.keys(e.unlocks || {})) tally[kind] = (tally[kind] || 0) + 1;
    return tally;
  }, {});
  const achievementsRoster = {
    section: 'Progression',
    slug: 'achievements',
    domain: 'achievements',
    title: 'Achievements',
    tagline: 'What the game counts, and what it pays out for.',
    lede: `An achievement is a counter with a payout at the end. ${achievementPayloads.weapon || 0} weapons and ${achievementPayloads.passive || 0} tomes sit behind this list, which makes it less a trophy cabinet than a list of what is not in your level-up pool yet.`,
    omissions: '<b>How far along you are is not here.</b> Every card carries the counter and the number it wants, and the running total is on your save, where this page cannot see it.',
    entries: achievementEntries,
    groups: [
      { key: 'run', title: 'Single-run goals', note: 'Counted inside one run. The counter goes back to zero when the run does.', has: (e) => e.kind === 'runStat' },
      { key: 'lifetime', title: 'Lifetime goals', note: 'Counted across every run on the save. These are the patient ones.', has: (e) => e.kind === 'lifetime' },
      { key: 'event', title: 'Milestones', note: 'No counter on these. Something specific either happened or it did not.', has: (e) => e.kind === 'event' },
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
    tagline: 'One ask at a time, from somebody who wants something specific.',
    lede: `One ask is active at a time, it comes from a person and never from a board, and the next step of a chain opens only when you turn in the one before it. ${Q.giverOrder.length} villagers want ${Q.count} very specific things.`,
    featureHtml: questTitleFeature,
    countLabel: `${Q.count} quests · ${Q.chainOrder.length} chains · ${Q.titleOrder.length} titles`,
    entries: questEntries,
    groups: (Q.chainOrder || []).map((chainId) => ({
      key: chainId,
      title: humanize(chainId),
      note: `${Q.chainQuests[chainId].length} steps, in the order they are offered.`,
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
      <div><span class="eyebrow">What it all costs</span><h3 id="shop-gates">The two gates, and the bill</h3></div>
      <p><b>${num(SH.grandTotal)}g</b> buys every rank and both gates. The ${SH.count} rows on this page come apart into <b>${shopRankRows}</b> separate purchases.</p>
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
    /* Not "Meta shop": "meta" is a design word, and rule 12 of docs/VOICE.md
       keeps design words out of player-facing copy. Not "The shop" either: the
       page title is also the document title, as "WHOMP <title>" in lower case,
       and "WHOMP the shop" reads as a gag this page is not making. */
    title: 'Shop',
    tagline: 'Every rank you buy stays bought.',
    lede: `Gold you carry out of a run buys permanent ranks between runs: ${SH.count} rows here, ${num(SH.grandTotal)}g for every rank and both gates. The price band is the whole message, and hitting harder costs more than picking gold up faster.`,
    omissions: '<b>The per-rank number is what the game stores, not what you will feel.</b> A rank lands alongside everything else your run picked up, and the attack-speed row still goes through the soft knee on the way, so this page prices the ladder and stops there.',
    featureHtml: shopFeature,
    countLabel: `${SH.count} upgrades · ${shopRankRows} ranks · ${num(SH.grandTotal)}g all-in`,
    entries: shopEntries,
    groups: [
      { key: 'power', title: 'Power', note: 'The rows that move your numbers, from what you hit for down to how much gold survives a bad run.', has: (e) => e.lane === 'power' },
      { key: 'qol', title: 'Quality of life', note: 'These do not touch your numbers. They change what the level-up screen is allowed to offer you.', has: (e) => e.lane === 'qol' },
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
    tagline: 'What the village hands you for doing it a favour.',
    lede: 'A wearable is what a quest pays you: somebody wanted something specific, you brought it back, and this is what they handed over. It bolts onto whichever hero you are playing, and it does nothing else.',
    omissions: '<b>An anchor is where a piece mounts, not a slot you fill.</b> A hero wears one of these at a time, so eyes, head and back are not three things you can have on at once.',
    entries: wearableEntries,
    groups: [
      { key: 'eyes', title: 'Eyes', note: 'Mounted at the eyes.', has: (e) => e.anchor === 'eyes' },
      { key: 'head', title: 'Head', note: 'Mounted on the crown, which on a wizard means the tip of the hat.', has: (e) => e.anchor === 'head' },
      { key: 'back', title: 'Back', note: 'Mounted between the shoulders.', has: (e) => e.anchor === 'back' },
      { key: 'other', title: 'Other anchors', note: 'Everything that mounts somewhere else, mostly at the neck.', has: (e) => !['eyes', 'head', 'back'].includes(e.anchor) },
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
    tagline: 'Three colors each, and not one of them makes you stronger.',
    lede: 'A style is three colors: body, rim and accent. It changes nothing about how a run goes, which is the entire point of it.',
    omissions: '<b>These are the colors, not the look.</b> The strip on each card is the three stored values side by side, exact and flat, and it is not a picture of anyone wearing anything. What the game currently does with those colors is on the card too, in the game\'s own words, and it is less than you would expect.',
    entries: cosmeticEntries,
    groups: [
      { key: 'start', title: 'Available from the start', note: 'Yours before you have done anything.', has: (e) => e.unlockedFromStart },
      { key: 'earned', title: 'Earned styles', note: 'Earned by doing one specific thing. The achievement that pays out is named on the card.', has: (e) => !e.unlockedFromStart },
    ],
    facets: [{ key: 'access', label: 'Availability', of: (e) => e.unlockedFromStart ? 'from the start' : 'achievement' }],
    sorts: [
      { key: 'roster', label: 'Roster order', of: (e) => cosmeticEntries.indexOf(e) },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.name} cosmetic style skin ${(inverseUnlocks.get(`sprite:${e.id}`) || []).map((row) => row.name).join(' ')}`,
    accent: (e) => colorHex(e.accentColor),
    icon: (e) => e.icon,
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
  const tierRows = (tierEvidenceReady ? T.weapons : []).map((row) => ({
    ...row,
    weaponId: row.id,
    id: `${row.id}-${row.form}-l${row.level}`,
    name: `${row.name} · ${row.form === 'evolved' ? 'evolved' : `level ${row.level}`}`,
  }));
  const axisIsMeasured = (axis) => axis?.status !== 'UNMEASURED';
  const unmeasuredReason = (axis) => String(axis?.reason || '').replace(/^UNMEASURED:\s*/i, '');
  const tierAxis = (row, key, label) => {
    const axis = row.axes[key];
    if (!axisIsMeasured(axis)) {
      return fact(label, `<b>UNMEASURED</b>: ${esc(unmeasuredReason(axis))} No tier or cohort rank is assigned.`);
    }
    const tierText = axis.volatile
      ? `<b>${esc(axis.tierAtP10)} to ${esc(axis.tierAtP90)}</b> across P10 to P90, median tier <b>${esc(axis.tier)}</b>`
      : `tier <b>${esc(axis.tier)}</b>, stable across P10 to P90`;
    return `${fact(label, `${tierText}; median <b>${num(axis.median)}</b>, P10 to P90 <b>${num(axis.p10)} to ${num(axis.p90)}</b>; competition rank <b>${axis.rankInCohort} of ${axis.cohortSize}</b>, cohort percentile <b>${num(axis.percentileInCohort * 100, 1)}%</b>; n=${axis.n}${rangePlot(axis, label, T.metric.axes.find((candidate) => candidate.key === key)?.unit || '', axis.n)}`)}`;
  };
  const tierFeature = tierEvidenceReady ? `
    <section class="wfeature" aria-labelledby="measurement-method">
      <div><span class="eyebrow">How the measuring was done</span><h3 id="measurement-method">The tests, and what they hold still</h3></div>
      <p>${esc(T.metric.whyTwo)}</p>
      <div class="wmethod-grid">
        ${T.metric.axes.map((axis) => `<div><b>${esc(axis.label || (axis.key === 'trashClear' ? 'Controlled trash sim' : axis.key === 'bossDamage' ? 'Stationary-target sim' : humanize(axis.key)))}</b><span>${esc(axis.job)} ${esc(axis.what)}</span><code>${esc(axis.unit)}</code></div>`).join('')}
        ${Object.entries(T.fixtureContract || {}).map(([key, fixture]) => `<div><b>${esc(fixture.name)}</b><span>${esc(fixture.classification)} · ${esc(fixture.control)}</span><code>controlled r=${num(fixture.controlled.radius)}, speed=${num(fixture.controlled.speed)}, hp=${num(fixture.controlled.hp)} · runtime behavior ${fixture.runtimeBehavior ? 'enabled' : 'disabled'}</code></div>`).join('')}
      </div>
      <p class="wsub">${esc(T.metric.whyNotSurvival)}</p>
      <p class="wsub">${esc(T.executionContract.note)} Workers used: ${num(T.executionContract.workersUsed)} of cap ${num(T.executionContract.workerCap)}; execution-only, not measurement evidence.</p>
      <details class="wraw"><summary>Evidence and limits <span>${T.limits.length} named limits</span></summary>
        <dl><div><dt>Fixture fingerprint</dt><dd><code>${esc(T.fingerprint)}</code></dd></div><div><dt>Source-contract digest</dt><dd><code>${esc(T.sourceContract.digest)}</code></dd></div></dl>
        <ul>${T.limits.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      </details>
    </section>` : '';
  const tiersRoster = tierEvidenceReady ? {
    section: 'Buildcraft',
    slug: 'tiers',
    domain: null,
    sourceKind: 'controlled simulation',
    title: 'Automatic weapons, measured',
    tagline: `${spellCap(T.metric.axes.length)} lab tests, run over and over, with the spread left in.`,
    lede: `${T.coverage.measured === T.coverage.weaponDefs ? `Every one of the ${T.coverage.weaponDefs} automatic weapons` : `${T.coverage.measured} of the ${T.coverage.weaponDefs} automatic weapons`} went through the same ${spell(T.metric.axes.length)} tests, at ${T.coverage.rows} combinations of form and level. This is a laboratory and not a run: nothing here dodges, nothing here is aimed, and a letter only says where a row landed against the other rows it was compared with. Where a test could not honestly produce a number, the row says so instead of taking a guess.`,
    omissions: `<b>Core weapons, tomes, relics and characters have no letters here, and the measurement says why.</b> ${Object.entries(T.notCovered).map(([key, reason]) => `<b>${esc(humanize(key))}:</b> ${esc(reason)}`).join(' ')}`,
    featureHtml: tierFeature,
    sourceLabel: `data/tier-rankings.json · fingerprint ${T.fingerprint} · source ${T.sourceContract.digest}`,
    countLabel: `${T.coverage.measured} weapons · ${T.coverage.rows} evidence rows`,
    entries: tierRows,
    visualRefs: (entry) => [{ domain: 'weapons', id: entry.weaponId }],
    groups: [
      { key: 'base-1', title: 'Base weapons · level 1', note: `${T.sample.singles.seeds} seeds per row, and a row is only ranked against the others in this group.`, has: (e) => e.cohort === 'base:1' },
      { key: 'base-4', title: 'Base weapons · level 4', note: `${T.sample.singles.seeds} seeds per row, and a row is only ranked against the others in this group.`, has: (e) => e.cohort === 'base:4' },
      { key: 'base-8', title: 'Base weapons · level 8', note: `${T.sample.singles.seeds} seeds per row, and a row is only ranked against the others in this group.`, has: (e) => e.cohort === 'base:8' },
      { key: 'evolved-1', title: 'Evolved forms', note: `${T.sample.singles.seeds} seeds per row, and an end form is only ranked against other end forms.`, has: (e) => e.cohort === 'evolved:1' },
    ],
    facets: [
      { key: 'form', label: 'Form', of: (e) => e.form },
      { key: 'level', label: 'Level', of: (e) => String(e.level), name: (v) => `Level ${v}` },
      { key: 'crowd', label: 'Controlled trash tier', of: (e) => axisIsMeasured(e.axes.trashClear) ? e.axes.trashClear.tier : 'UNMEASURED' },
      { key: 'boss', label: 'Stationary-target tier', of: (e) => axisIsMeasured(e.axes.bossDamage) ? e.axes.bossDamage.tier : 'UNMEASURED' },
      { key: 'confidence', label: 'Evidence status', of: (e) => Object.values(e.axes).some((axis) => !axisIsMeasured(axis)) ? 'contains UNMEASURED axis' : Object.values(e.axes).some((axis) => axis.volatile) ? 'sample-sensitive tier' : 'tier-consistent in fixture' },
    ],
    sorts: [
      { key: 'roster', label: 'Controlled trash rank', of: (e) => axisIsMeasured(e.axes.trashClear) ? e.axes.trashClear.rankInCohort : undefined },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
      { key: 'crowd', label: 'Controlled trash median', of: (e) => axisIsMeasured(e.axes.trashClear) ? e.axes.trashClear.median : undefined, desc: true },
      { key: 'boss', label: 'Stationary-target median', of: (e) => axisIsMeasured(e.axes.bossDamage) ? e.axes.bossDamage.median : undefined, desc: true },
    ],
    searchText: (e) => `${e.name} automatic weapon controlled simulation tier ${e.cohort} trash fixture ${axisIsMeasured(e.axes.trashClear) ? e.axes.trashClear.tier : `UNMEASURED ${unmeasuredReason(e.axes.trashClear)}`} stationary target fixture ${axisIsMeasured(e.axes.bossDamage) ? e.axes.bossDamage.tier : `UNMEASURED ${unmeasuredReason(e.axes.bossDamage)}`} ${Object.values(e.axes).some((axis) => axisIsMeasured(axis) && axis.volatile) ? 'sample-sensitive' : 'tier-consistent in fixture'}`,
    card: (e) => `
      <div class="wtags">${tag(axisIsMeasured(e.axes.trashClear) ? `Trash sim ${esc(e.axes.trashClear.tier)}` : 'Trash sim UNMEASURED', e.axes.trashClear.tier === 'S' ? 'gold' : 'cyan')}${tag(axisIsMeasured(e.axes.bossDamage) ? `Stationary target ${esc(e.axes.bossDamage.tier)}` : 'Stationary target UNMEASURED', e.axes.bossDamage.tier === 'S' ? 'gold' : 'pink')}${Object.values(e.axes).some((axis) => axisIsMeasured(axis) && axis.volatile) ? tag('Sample-sensitive tier', 'violet') : tag('Tier-consistent where measured', '')}</div>
      <div class="wfacts">
        ${fact('Weapon', cardLink('weapons', e.weaponId, esc(weaponName(e.weaponId))))}
        ${tierAxis(e, 'trashClear', 'Controlled trash sim')}
        ${tierAxis(e, 'bossDamage', 'Stationary-target sim')}
      </div>`,
  } : null;

  // ---- measured pairs and build chains -----------------------------------
  const pairEntries = (MB?.pairs || []).map((pair) => ({
    ...pair,
    id: pair.ids.join('-'),
    name: pair.ids.map(weaponName).join(' + '),
  })).sort((a, b) => b.axes.trashClear.median - a.axes.trashClear.median || a.name.localeCompare(b.name));
  const selectionBiasLimits = (T?.limits || []).filter((line) => /same(?:[- ]| deterministic seed )cohort|holdout/i.test(line));
  const attributedRows = (byWeapon, unit) => Object.entries(byWeapon || {}).map(([id, reading]) => `${cardLink('weapons', id, esc(weaponName(id)))}: <b>${num(reading.median)}</b> ${esc(unit)} median${reading.shareOfAttributed ? ` · <b>${pct(reading.shareOfAttributed.median)}</b> of attributed damage` : ''}`).join('<br>');
  const buildFeature = tierEvidenceReady ? `
    <section class="wfeature" aria-labelledby="measured-builds">
      <div><span class="eyebrow">How the paths were found</span><h3 id="measured-builds">One weapon at a time, best next each time</h3></div>
      <p>${esc(MB.method)} Each path starts from one weapon alone in the lab and adds whichever weapon measured best next to it. It says nothing about aiming, terrain, moving, when a weapon becomes available, or how a real run goes.</p>
      <div class="wbuild-grid">
        ${MB.builds.map((build, buildIndex) => `<article>
          <span class="wtag ink-${build.axis === 'trashClear' ? 'cyan' : 'pink'}">${esc(build.label)} · ${esc(build.axis === 'trashClear' ? 'controlled trash sim' : 'stationary-target sim')}</span>
          <h4>${build.ids.map((id) => cardLink('weapons', id, esc(weaponName(id)))).join(' + ')}</h4>
          ${renderVisualStrip(build.ids.map((id) => ({ domain: 'weapons', id })), visuals, esc, {
            use: 'build-feature', primary: buildIndex === 0, label: `${build.label} canonical weapon components`,
          })}
          <p><b>${num(build.median)}</b> ${esc(build.unit)} median, P10 to P90 <b>${num(build.p10)} to ${num(build.p90)}</b>, n=${buildSample.seeds}.</p>
          ${rangePlot(build, `${build.label} ${build.axis}`, build.unit, buildSample.seeds)}
          <p>${build.requirements.map((requirement) => `${cardLink('weapons', requirement.id, esc(weaponName(requirement.id)))}: ${requirement.unlockedFromStart ? 'available from the start' : requirement.achievementId ? `requires ${cardLink('achievements', requirement.achievementId, esc(requirement.achievementName))}` : 'unlock requirement not represented in this build result'}`).join('<br>')}</p>
          <ol>${build.steps.map((step) => `<li>${step.added ? `Add ${cardLink('weapons', step.added, esc(weaponName(step.added)))}: measured marginal median <b>${num(step.marginal.median)}</b> ${esc(step.marginal.unit)}, P10 to P90 <b>${num(step.marginal.p10)} to ${num(step.marginal.p90)}</b>${rangePlot(step.marginal, `${step.added} marginal`, step.marginal.unit, step.marginal.n)}` : `Seed ${cardLink('weapons', step.ids[0], esc(weaponName(step.ids[0])))}: total median <b>${num(step.median)}</b> ${esc(build.unit)}`}<br><span class="wsub">${esc(step.attributionLabel)}<br>${attributedRows(step.byWeapon, 'damage/min')}<br>${esc(step.unattributedLabel)} Median <b>${num(step.unattributed.median)}</b> damage/min, P10 to P90 <b>${num(step.unattributed.p10)} to ${num(step.unattributed.p90)}</b>.</span></li>`).join('')}</ol>
        </article>`).join('')}
      </div>
    </section>` : '';
  const buildsRoster = tierEvidenceReady ? {
    section: 'Buildcraft',
    slug: 'builds',
    domain: null,
    sourceKind: 'controlled simulation',
    title: 'Automatic weapons in pairs',
    tagline: 'What two weapons do together, against what they do apart.',
    lede: `Every one of the ${MB.pairs.length} pairs you can make at level ${MB.pairLevel} was run on the same ${buildSample.seeds} seeds, on both tests. Each card says what the pair put out, how much of that each weapon was responsible for, and whether the two of them together beat the two of them separately. The ${spell(MB.builds.length)} longer paths at the top are what a search found in a laboratory, and a laboratory is not a run.`,
    omissions: `<b>Pairs and paths were run on ${buildSample.seeds} seeds, not the ${T.sample.singles.seeds} the single-weapon sweep used.</b> ${esc(MB.partnerQualityNote)} ${selectionBiasLimits.map((line) => esc(line)).join(' ')} ${esc(T.loadoutContract.orderLimit)} The unlock lines say only whether you could have a weapon, never when it would actually turn up in a run.`,
    featureHtml: buildFeature,
    sourceLabel: `data/tier-rankings.json · fingerprint ${T.fingerprint} · source ${T.sourceContract.digest}`,
    countLabel: `${MB.pairs.length} controlled pairs · ${MB.builds.length} search paths`,
    entries: pairEntries,
    visualRefs: (entry) => entry.ids.map((id) => ({ domain: 'weapons', id })),
    groups: [{ key: 'all', title: 'Every controlled-sim pair', note: `Every pair that can be made from the ${spell(Object.keys(MB.solo).length)} eligible weapons, ${buildSample.seeds} seeds each, order ignored.`, has: () => true }],
    facets: [
      { key: 'weapon', label: 'Includes weapon', of: (e) => e.ids, multi: true, name: weaponName },
    ],
    sorts: [
      { key: 'crowd', label: 'Controlled trash output', of: (e) => e.axes.trashClear.median, desc: true },
      { key: 'crowdSynergy', label: 'Trash output / solo sum', of: (e) => e.axes.trashClear.synergy, desc: true },
      { key: 'boss', label: 'Stationary-target output', of: (e) => e.axes.bossDamage.median, desc: true },
      { key: 'bossSynergy', label: 'Target output / solo sum', of: (e) => e.axes.bossDamage.synergy, desc: true },
      { key: 'name', label: 'Name', of: (e) => e.name, text: true },
    ],
    searchText: (e) => `${e.name} automatic weapon pair controlled simulation loadout trash fixture stationary target fixture solo sum ratio`,
    card: (e) => {
      const axis = (key, label) => {
        const a = e.axes[key];
        return `${fact(label, `median <b>${num(a.median)}</b>, P10 to P90 <b>${num(a.p10)} to ${num(a.p90)}</b>; output / solo sum median <b>${num(a.synergy)}</b> (${pct(a.synergy - 1)}), ratio P10 to P90 <b>${num(a.synergyP10)} to ${num(a.synergyP90)}</b>; n=${a.n}${rangePlot(a, label, T.metric.axes.find((candidate) => candidate.key === key)?.unit || '', a.n)}`)}${fact(`${label} damage attribution`, `${esc(a.attributionLabel)}<br>${attributedRows(a.byWeapon, a.componentUnit)}<br>${esc(a.unattributedLabel)} Median <b>${num(a.unattributed.median)}</b> ${esc(a.componentUnit)}, P10 to P90 <b>${num(a.unattributed.p10)} to ${num(a.unattributed.p90)}</b>.`)}`;
      };
      return `
        <div class="wtags">${tag('Controlled-sim pair', 'cyan')}${tag('Automatic weapons', 'violet')}</div>
        <div class="wfacts">
          ${fact('Weapons', e.ids.map((id) => cardLink('weapons', id, esc(weaponName(id)))).join(' + '))}
          ${axis('trashClear', 'Controlled trash sim')}
          ${axis('bossDamage', 'Stationary-target sim')}
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
    shrineMovementRoster,
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

/* Search result kinds are player-facing UI, never raw artifact keys. Keep the
 * complete public-domain map here so a newly routed domain cannot leak a
 * camelCase implementation name into the combobox. buildWiki validates exact
 * coverage against domainOrder below. */
export const SEARCH_TYPE = {
  weapons: 'weapon',
  coreWeapons: 'core weapon',
  enemies: 'enemy',
  relics: 'relic',
  levels: 'world',
  passives: 'tome',
  characters: 'character',
  innates: 'innate',
  signatures: 'signature',
  expeditions: 'expedition',
  achievements: 'achievement',
  runModes: 'run mode',
  shipCores: 'ship core',
  shipFragments: 'ship fragment',
  legendaries: 'legendary upgrade',
  ultimates: 'ultimate ability',
  evolutions: 'evolution recipe',
  shrineBlessings: 'shrine blessing',
  shrineMovement: 'shrine movement offering',
  utilities: 'utility ability',
  wearables: 'wearable',
  quests: 'quest',
  shop: 'shop upgrade',
  worldEvents: 'rare world event',
  ambientEvents: 'ambient event placement',
  shipSystems: 'ship system',
  cosmetics: 'cosmetic style',
  jumpAugments: 'legacy jump alias',
};

/* Every path below feeds a visible title, sentence, fact, facet, sort key or
 * search token on its domain route. Presence is checked after roster shaping,
 * which also covers derived display fields such as run-mode names and evolution
 * recipe anchors. This is intentionally narrower than "every artifact field":
 * a new private/export-only field must not break the wiki, while deleting a
 * field the wiki actually presents must fail before HTML is written. */
export const DISPLAY_FIELD_PATHS = Object.freeze({
  weapons: ['desc', 'pattern', 'element', 'shape', 'baseDamage', 'fireRateMs', 'maxLevel', 'perLevel', 'params', 'unlockedFromStart'],
  coreWeapons: ['desc', 'feel', 'cadence', 'cadenceLabel', 'meter', 'meterPips', 'color'],
  passives: ['desc', 'stat', 'perLevel', 'maxLevel', 'unlockedFromStart'],
  relics: ['icon', 'rarity', 'flavor', 'desc', 'maxStacks'],
  legendaries: ['icon', 'color', 'desc', 'effect', 'params'],
  shrineBlessings: ['glyph', 'color', 'desc', 'stat', 'value'],
  shrineMovement: ['glyph', 'color', 'artColor', 'desc', 'stat', 'value'],
  utilities: ['glyph', 'color', 'desc', 'cooldownMs', 'implemented', 'unlockedFromStart', 'costGold', 'params'],
  ultimates: ['desc', 'cooldownMs', 'icon', 'params'],
  evolutions: ['baseId', 'passiveId', 'evolvedId'],
  jumpAugments: ['desc', 'stat', 'perLevel', 'color'],
  characters: ['desc', 'signatureId', 'innateId', 'startWeaponId', 'baseStats.maxHp', 'baseStats.speed', 'baseStats.might', 'unlockedFromStart'],
  innates: ['effect', 'valueKind', 'base', 'growth', 'cap', 'characterSelectCopy'],
  signatures: ['desc', 'cooldownMs', 'params'],
  enemies: ['tier', 'behavior'],
  levels: ['tagline', 'paletteId', 'cardAccent', 'tuning', 'spawnTable', 'bosses', 'shrineCount', 'launchPads', 'surfaces', 'unlockedFromStart'],
  expeditions: ['tagline', 'paletteId', 'tuning', 'spawnTable', 'bosses', 'shrineCount', 'launchPads', 'surfaces', 'unlockedFromStart'],
  runModes: ['paceScale', 'bankAtElapsedSec', 'finalHordeAtPaceSec', 'offersVictoryChoice', 'openingHpBonusPct', 'allowFlyers', 'tierLadderEnabled', 'worldEventSelection', 'earthyWorldEventCount', 'otherWorldEventCount'],
  worldEvents: ['weight', 'maxPerRun', 'minSpacingM', 'allowedWorlds'],
  ambientEvents: ['events'],
  achievements: ['desc', 'kind'],
  quests: ['giver', 'chainId', 'step', 'title', 'ask', 'objective', 'target.kind', 'target.count', 'reaction', 'reward', 'reward.kind'],
  shop: ['desc', 'perRank', 'ranks', 'lane', 'band'],
  shipCores: ['worldId', 'system', 'memoryFlavor'],
  shipSystems: ['label', 'heart', 'coreId'],
  shipFragments: ['route', 'system', 'form', 'memoryFlavor'],
  wearables: ['anchor', 'blurb', 'color', 'accent', 'trails'],
  cosmetics: ['icon', 'unlockedFromStart', 'bodyColor', 'rimColor', 'accentColor'],
});

/* Ref fields are held to a stronger rule than "present if present": each
 * conditional relation is triggered from its independent owner (achievement,
 * quest, evolution, character, level, and so on). Deleting the derived backlink
 * therefore still fails instead of making the condition disappear with it. */
export const DISPLAY_REF_FIELD_PATHS = Object.freeze({
  weapons: [
    { path: 'suggestedByCharacters', when: (entry, D) => Object.values(D.domains.characters.entries).some((row) => row.startWeaponId === entry.id) },
    { path: 'unlockedByAchievements', when: (entry, D) => Object.values(D.domains.achievements.entries).some((row) => row.unlocks?.weapon === entry.id) },
    { path: 'unlockedByQuests', when: (entry, D) => Object.values(D.domains.quests.entries).some((row) => row.reward?.weaponId === entry.id) },
    { path: 'evolvesFrom', when: (entry, D) => Object.values(D.domains.evolutions.entries).some((row) => row.evolvedId === entry.id) },
    { path: 'evolvesInto', when: (entry, D) => Object.values(D.domains.evolutions.entries).some((row) => row.baseId === entry.id) },
    { path: 'donorForCores', when: (entry, D) => Object.values(D.domains.coreWeapons.entries).some((row) => row.donorWeaponId === entry.id) },
  ],
  coreWeapons: ['donorWeapon', 'forgiveness'],
  enemies: [
    'speedProfile',
    { path: 'spawnsIn', when: (entry, D) => ['levels', 'expeditions'].some((domain) => Object.values(D.domains[domain].entries).some((row) => row.spawnTable?.some((spawn) => spawn.kindId === entry.id))) },
    { path: 'bossIn', when: (entry, D) => ['levels', 'expeditions'].some((domain) => Object.values(D.domains[domain].entries).some((row) => row.bosses?.some((boss) => boss.kindId === entry.id))) },
    { path: 'splitsInto', when: (entry) => !!entry.onDeath?.split?.kindId },
    { path: 'splitsFrom', when: (entry, D) => Object.values(D.domains.enemies.entries).some((row) => row.onDeath?.split?.kindId === entry.id) },
  ],
  relics: ['inArenaPool'],
  passives: [
    { path: 'requiredByEvolutions', when: (entry, D) => Object.values(D.domains.evolutions.entries).some((row) => row.passiveId === entry.id) },
    { path: 'unlockedByAchievements', when: (entry, D) => Object.values(D.domains.achievements.entries).some((row) => row.unlocks?.passive === entry.id) },
    { path: 'runtimeUnlock', when: (entry) => entry.id === 'aegisTome' },
  ],
  jumpAugments: ['shrineMovementOffering'],
  characters: ['suggestedWeapon'],
  innates: ['characters'],
  signatures: ['characters'],
  levels: [
    'enemyNames', 'bossNames',
    { path: 'unlockedBy', when: (entry, D) => Object.values(D.domains.levels.entries).some((row) => row.unlocks === entry.id) },
    { path: 'unlocksName', when: (entry) => !!entry.unlocks },
    { path: 'shipCore', when: (entry, D) => Object.values(D.domains.shipCores.entries).some((row) => row.worldId === entry.id) },
    { path: 'worldEvents', when: (entry, D) => Object.values(D.domains.worldEvents.entries).some((row) => row.allowedWorlds?.includes(entry.id)) },
    { path: 'ambientEvents', when: (entry, D) => Object.prototype.hasOwnProperty.call(D.domains.ambientEvents.entries, entry.id) },
  ],
  expeditions: [
    'enemyKinds',
    { path: 'worldEvents', when: (entry, D) => Object.values(D.domains.worldEvents.entries).some((row) => row.allowedWorlds?.includes(entry.id)) },
    { path: 'ambientEvents', when: (entry, D) => Object.prototype.hasOwnProperty.call(D.domains.ambientEvents.entries, entry.id) },
  ],
  worldEvents: ['campaignLevels', 'expeditions'],
  ambientEvents: [
    { path: 'campaignLevel', when: (entry, D) => !!D.domains.levels.entries[entry.id] },
    { path: 'expedition', when: (entry, D) => !!D.domains.expeditions.entries[entry.id] },
  ],
  quests: [
    'giverName',
    { path: 'previousQuest', when: (entry) => entry.step > 1 },
    { path: 'nextQuest', when: (entry, D) => D.domains.quests.chainQuests?.[entry.chainId]?.indexOf(entry.id) < D.domains.quests.chainQuests?.[entry.chainId]?.length - 1 },
    { path: 'rewardWeapon', when: (entry) => typeof entry.reward?.weaponId === 'string' },
    { path: 'rewardWearable', when: (entry) => typeof entry.reward?.wearableId === 'string' },
    { path: 'rewardTitle', when: (entry) => typeof entry.reward?.titleId === 'string' },
  ],
  shop: ['ranks', 'totalCost'],
  shipCores: ['levelName', 'socket', 'socketLabel'],
  shipSystems: ['coreName'],
  shipFragments: ['routeLabel'],
  wearables: [{ path: 'rewardedByQuests', when: (entry, D) => Object.values(D.domains.quests.entries).some((row) => row.reward?.wearableId === entry.id) }],
  cosmetics: [{ path: 'unlockedByAchievements', when: (entry, D) => Object.values(D.domains.achievements.entries).some((row) => row.unlocks?.sprite === entry.id) }],
});

/* Domain/root contracts also feed visible features. These paths keep the prose
 * bound to exported runtime semantics rather than to a hand-copied constant. */
export const DISPLAY_ROOT_FIELD_PATHS = Object.freeze([
  'domains.enemies.scaling.hpPer25s',
  'domains.enemies.scaling.damagePer30s',
  'domains.enemies.scaling.xpPer120s',
  'domains.characters.runtime.baseStats.maxHp.role',
  'domains.characters.runtime.baseStats.maxHp.unit',
  'domains.characters.runtime.baseStats.maxHp.semantics',
  'domains.characters.runtime.baseStats.maxHp.provenance',
  'domains.characters.runtime.baseStats.speed.role',
  'domains.characters.runtime.baseStats.speed.unit',
  'domains.characters.runtime.baseStats.speed.reference',
  'domains.characters.runtime.baseStats.speed.semantics',
  'domains.characters.runtime.baseStats.speed.provenance',
  'domains.characters.runtime.baseStats.might.role',
  'domains.characters.runtime.baseStats.might.unit',
  'domains.characters.runtime.baseStats.might.semantics',
  'domains.characters.runtime.baseStats.might.provenance',
  'domains.characters.runtime.weaponIdentity.field',
  'domains.characters.runtime.weaponIdentity.role',
  'domains.characters.runtime.weaponIdentity.standardSoloCampaignGrant',
  'domains.characters.runtime.weaponIdentity.semantics',
  'domains.characters.runtime.weaponIdentity.provenance',
  'domains.shrineMovement.runtime.owner',
  'domains.shrineMovement.runtime.offerSlot',
  'domains.shrineMovement.runtime.normalWorldShrineMovementSlots',
  'domains.shrineMovement.runtime.gate.requiresWorldShrine',
  'domains.shrineMovement.runtime.gate.requiresNoLegendaryReplacement',
  'domains.shrineMovement.runtime.semantics',
  'domains.shrineMovement.runtime.provenance',
  'domains.runModes.openingEnemyHpBonus.field',
  'domains.runModes.openingEnemyHpBonus.owner',
  'domains.runModes.openingEnemyHpBonus.appliesTo',
  'domains.runModes.openingEnemyHpBonus.excludes',
  'domains.runModes.openingEnemyHpBonus.fade',
  'domains.runModes.openingEnemyHpBonus.fadeClock',
  'domains.runModes.openingEnemyHpBonus.startsAtPaceSec',
  'domains.runModes.openingEnemyHpBonus.fadesToZeroAtPaceSec',
  'domains.runModes.openingEnemyHpBonus.unifiedProfileElapsedSec',
  'domains.runModes.openingEnemyHpBonus.semantics',
  'domains.runModes.openingEnemyHpBonus.provenance',
  'world.encounterSchedule.automaticMinibossCadenceSec',
  'world.encounterSchedule.cadenceClock',
  'world.encounterSchedule.unifiedProfilePreBankIntervalElapsedSec',
  'world.encounterSchedule.unifiedProfileEndlessIntervalElapsedSec',
  'world.encounterSchedule.semantics',
  'world.encounterSchedule.limits',
  'world.encounterSchedule.provenance',
]);

export const DISPLAY_CONDITIONAL_FIELD_PATHS = Object.freeze({
  weapons: [
    { path: 'tickRateMs', when: (entry) => entry.fireRateMs === 0 },
    { path: 'evolved', when: (entry, D) => Object.values(D.domains.evolutions.entries).some((row) => row.evolvedId === entry.id) },
  ],
  passives: [{ path: 'shieldRegenPerLevel', when: (entry) => entry.id === 'aegisTome' }],
  relics: [
    { path: 'stats', when: (entry) => !entry.event },
    { path: 'event', when: (entry) => !entry.stats },
  ],
  shrineMovement: [{ path: 'maxStacks', when: (entry) => entry.id !== 'extraJump' }],
  jumpAugments: [{ path: 'maxLevel', when: (entry) => entry.id === 'jumpPower' }],
  enemies: [
    { path: 'hp', when: (entry) => ['basic', 'special'].includes(entry.tier) },
    { path: 'damage', when: (entry) => ['basic', 'special'].includes(entry.tier) },
    { path: 'xp', when: (entry) => ['basic', 'special'].includes(entry.tier) },
    { path: 'onDeath.split.count', when: (entry) => !!entry.onDeath?.split?.kindId },
    { path: 'flying', when: (entry, D) => D.domains.enemies.flyingIds?.includes(entry.id) },
  ],
  achievements: [
    {
      path: 'unlocks',
      when: (entry, D) => [
        ...Object.values(D.domains.weapons.refs || {}).flatMap((refs) => refs?.unlockedByAchievements || []),
        ...Object.values(D.domains.passives.refs || {}).flatMap((refs) => refs?.unlockedByAchievements || []),
        ...Object.values(D.domains.cosmetics.refs || {}).flatMap((refs) => refs?.unlockedByAchievements || []),
        ...Object.values(D.domains.levels.refs || {}).flatMap((refs) => refs?.unlockedByAchievements || []),
      ].includes(entry.id),
    },
    { path: 'levelId', when: (entry) => typeof entry.levelId === 'string' },
    { path: 'stat', when: (entry) => typeof entry.stat === 'string' },
    { path: 'target', when: (entry) => entry.target !== undefined },
  ],
  quests: [
    { path: 'reward.amount', when: (entry) => entry.reward?.kind === 'gold' },
    { path: 'unit', when: (entry) => typeof entry.unit === 'string' },
  ],
});

const displayPathValue = (entry, path) => {
  let value = entry;
  for (const segment of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, segment)) {
      return { present: false, value: undefined };
    }
    value = value[segment];
  }
  return { present: value !== undefined, value };
};

const displayValueIsRenderable = (value) => {
  if (value === null) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  return ['boolean', 'object'].includes(typeof value);
};

const NONEMPTY_DISPLAY_ARRAYS = new Set([
  'levels.spawnTable', 'levels.bosses', 'expeditions.spawnTable', 'expeditions.bosses',
  'worldEvents.allowedWorlds', 'ambientEvents.events', 'quests.ask', 'quests.reaction',
]);

function renderRosterPage(roster, ctx) {
  const { esc, chrome, D, V } = ctx;
  const qualifiedTitle = /^WHOMP\b/i.test(roster.title) ? roster.title : `WHOMP ${roster.title.toLowerCase()}`;
  const sourceDomain = roster.domain ? D.domains[roster.domain] : null;
  const total = roster.entries.length;
  const visuals = visualIndex(V);
  let primaryVisualUsed = /<img\b[^>]*\bloading="eager"/.test(roster.featureHtml || '');

  const facetBar = roster.facets.map((f) => {
    const values = facetValues(roster, f);
    if (values.length < 2) return '';
    const label = f.name || humanize;
    return `
      <div class="wfacet">
        <span class="wfacet-h" id="facet-${esc(roster.slug)}-${esc(f.key)}">${esc(f.label)}</span>
        <div class="wfacet-row" role="group" aria-labelledby="facet-${esc(roster.slug)}-${esc(f.key)}" data-facet="${esc(f.key)}" data-multi="${f.multi ? '1' : '0'}">
          <button class="wf is-active" type="button" data-value="all" aria-pressed="true" aria-controls="wiki-groups">All</button>
          ${values.map(([v, n]) => `<button class="wf" type="button" data-value="${esc(v)}" aria-pressed="false" aria-controls="wiki-groups">${esc(label(v))} <span style="opacity:.5">${n}</span></button>`).join('')}
        </div>
      </div>`;
  }).join('');

  const sortBar = roster.sorts.length > 1 ? `
      <div class="wfacet">
        <label class="wfacet-h" for="wsort">Sort</label>
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
        return value ? `data-${f.key}="${esc(value)}"` : '';
      }).filter(Boolean).join(' ');
      const sortAttrs = roster.sorts.map((s) => {
        const raw = s.of(e);
        if (raw === undefined || raw === null) return '';
        return `data-${datasetKey(s.key).replace(/([A-Z])/g, '-$1').toLowerCase()}="${esc(String(s.text ? String(raw).toLowerCase() : (Number(raw) || 0)))}"`;
      }).join(' ');
      const accent = roster.accent ? roster.accent(e) : null;
      const note = (sourceDomain?.notes || {})[e.id];
      const visualRefs = roster.visualRefs
        ? roster.visualRefs(e)
        : roster.domain
          ? [{ domain: roster.domain, id: e.id }]
          : [];
      const visualEntries = visualRefs.map((ref) => visuals.get(`${ref.domain}:${ref.id}`)).filter(Boolean);
      const isPrimaryVisual = !primaryVisualUsed && visualEntries.length > 0;
      if (isPrimaryVisual) primaryVisualUsed = true;
      const visualHtml = roster.visualRefs
        ? renderVisualStrip(visualRefs, visuals, esc, {
            use: 'reference',
            primary: isPrimaryVisual,
            label: `${e.name} canonical visual components`,
          })
        : visualEntries.length === 1
          ? renderWikiVisual(visualEntries[0], esc, { primary: isPrimaryVisual, use: 'entry' })
          : '';
      /* The glyph is the entry's own, straight from the game, so a roster opts
         in by naming where it lives and never by inventing one here. */
      const glyph = roster.icon ? roster.icon(e) : '';
      const glyphRing = rgba(accent, 0.45, 0.25);
      const glyphWash = rgba(accent, 0.12, 0.25);
      return `
      <article class="wcard" id="e-${esc(e.id)}" tabindex="-1" ${facetAttrs} ${sortAttrs}>
        <div class="wcard-h">
          ${glyph ? `<span class="wcard-glyph" aria-hidden="true"${glyphRing ? ` style="border-color:${glyphRing};background:${glyphWash}"` : ''}>${esc(glyph)}</span>` : ''}
          <h4>${esc(e.name)}</h4>
          ${accent ? `<span class="wcard-accent" style="background:${esc(accent)}"></span>` : ''}
        </div>
        ${visualHtml}
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
  <div class="wtopbar-brandrow">
    ${chrome.wikiBrand}
    ${chrome.AUTHBAR}
  </div>
  <div class="wtopbar-row">
    <span class="brand">
      <span>
        <h1 class="chroma">${esc(qualifiedTitle)}</h1>
        <p class="subtag">${esc(roster.tagline)}</p>
      </span>
    </span>
    <div class="chips">${chrome.liveChip()}</div>
  </div>
</div>

${chrome.searchMarkup(chrome.SEARCH_PLACEHOLDER)}

<div class="wshell">
  <nav class="wside" aria-label="Wiki navigation">
    ${chrome.wikiNav(roster.slug)}
    <div class="stat">${esc(roster.countLabel || entryCountLabel(total))}, read straight out of the game</div>
  </nav>
  <main class="wmain" id="wiki-main" tabindex="-1">
    <div class="rule"></div>
    <nav class="wbreadcrumb" aria-label="Breadcrumb"><a href="wiki.html">Wiki</a><span aria-hidden="true">/</span><a href="wiki.html#section-${esc(roster.section.toLowerCase())}">${esc(roster.section)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(roster.title)}</span></nav>
    <h2 class="chroma">${esc(roster.title)}</h2>
    <p class="lede">${esc(roster.lede)}</p>

    <p class="wprov">Every number on this page was read out of the game, at build <b>game@${esc(chrome.headSha)}</b>.
      <a href="${EXPLAINER_FILE}">${EXPLAINER_LINK_TEXT}</a></p>

    ${roster.omissions ? `<p class="womit">${roster.omissions}</p>` : ''}

    ${roster.featureHtml || ''}

    <div class="wbar">${facetBar}${sortBar}</div>
    <p class="wcount" id="wcount" role="status" aria-live="polite"></p>
    <div class="wempty" id="wempty" hidden>
      <b>Nothing here matches all of that at once.</b>
      <button type="button" id="wreset">Reset filters</button>
    </div>

    <div id="wiki-groups">${groupsHtml}</div>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(chrome.buildStamp)} from <code>game@${esc(chrome.headSha)}</code>,
  content derived from <code>${esc(roster.sourceLabel || 'data/game-data.json')}</code> and verified visual associations from <code>data/wiki-visuals.json</code>.
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
function sortCards() {
  if (!sortSel) return;
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
}
if (sortSel) sortSel.addEventListener('change', sortCards);
sortCards();

// ---- wiki navigation ----
${chrome.NAV_SCRIPT}
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
      title: qualifiedTitle,
      description: `${roster.title}: ${roster.tagline} Canonical facts generated from verified game artifacts.`,
      body,
      script,
    }),
  };
}

// ================================================================ the hub
function renderHub(rosters, ctx) {
  const { esc, chrome, D, T, V } = ctx;
  const sections = [...new Set(rosters.map((r) => r.section))];
  const catalogRosters = rosters.filter((r) => r.domain);
  const catalogEntries = catalogRosters.reduce((sum, r) => sum + r.entries.length, 0);

  const body = `
<div class="wtopbar">
  <div class="wtopbar-brandrow">
    ${chrome.wikiBrand}
    ${chrome.AUTHBAR}
  </div>
  <div class="wtopbar-row">
    <span class="brand">
      <span>
        <h1 class="chroma">WHOMP wiki</h1>
        <p class="subtag">Generated from the game, not written about it.</p>
      </span>
    </span>
    <div class="chips">${chrome.liveChip()}</div>
  </div>
</div>

${chrome.searchMarkup(chrome.SEARCH_PLACEHOLDER)}

<div class="wshell">
  <nav class="wside" aria-label="Wiki navigation">
    ${chrome.wikiNav('')}
  </nav>
  <main class="wmain" id="wiki-main" tabindex="-1">
    <div class="rule"></div>
    <h2 class="chroma">The wiki</h2>
    <p class="lede">Everything the game knows about itself, laid out flat. The numbers are read out of it rather than copied over, so they cannot quietly go stale.</p>

    <p class="wprov">Every one of the game's <b>${D.coverage.domains}</b> catalogs has a page here, <b>${catalogEntries}</b> entries in all, plus
      <b>${T?.coverage?.rows || 0}</b> measured weapon rows, <b>${T?.measuredBuilds?.pairs?.length || 0}</b> measured pairs, and <b>${V.coverage.entries}</b> pictures the game drew of its own
      contents. Read at build <b>game@${esc(chrome.headSha)}</b>. <a href="${EXPLAINER_FILE}">${EXPLAINER_LINK_TEXT}</a></p>

    <p class="womit">Where the game has no answer, these pages say so rather than guess. A few numbers an ordinary wiki
      would print are missing on purpose, and every page names its own gaps at the top. A gap here means the number
      the game runs on is not the number the page could show you, and half a truth about damage is worse than none.</p>

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
  content derived from the three verified artifacts <code>data/game-data.json</code>, <code>data/tier-rankings.json</code>, and <code>data/wiki-visuals.json</code>.
  <a href="log.html#views">Dev log</a>
</footer>`;

  return {
    file: 'wiki.html',
    html: ctx.page({
      title: 'WHOMP wiki',
      description: 'The complete generated WHOMP wiki: every public source catalog and controlled automatic-weapon simulation surface.',
      body,
      script: `${chrome.SEARCH_SCRIPT('')}\n${chrome.NAV_SCRIPT}`,
    }),
  };
}

// ================================================================ the explainer
/* One page that has to earn what thirty-two repeated paragraphs only asserted.
 *
 * Every claim on it is checkable in this repo, and every count in it is read
 * from the same artifacts the rest of the wiki reads, for the obvious reason: a
 * page about not retyping numbers cannot retype numbers. */
function renderExplainer(rosters, ctx) {
  const { esc, chrome, D, T, V } = ctx;
  const catalogEntries = rosters.filter((r) => r.domain).reduce((sum, r) => sum + r.entries.length, 0);

  const section = (eyebrow, heading, id, paragraphs) => `
    <section class="wfeature" aria-labelledby="${esc(id)}">
      <div><span class="eyebrow">${esc(eyebrow)}</span><h3 id="${esc(id)}">${esc(heading)}</h3></div>
      ${paragraphs.map((line) => `<p>${line}</p>`).join('')}
    </section>`;

  const body = `
<div class="wtopbar">
  <div class="wtopbar-brandrow">
    ${chrome.wikiBrand}
    ${chrome.AUTHBAR}
  </div>
  <div class="wtopbar-row">
    <span class="brand">
      <span>
        <h1 class="chroma">${esc(EXPLAINER_TITLE)}</h1>
        <p class="subtag">Nobody typed them in.</p>
      </span>
    </span>
    <div class="chips">${chrome.liveChip()}</div>
  </div>
</div>

${chrome.searchMarkup(chrome.SEARCH_PLACEHOLDER)}

<div class="wshell">
  <nav class="wside" aria-label="Wiki navigation">
    ${chrome.wikiNav(EXPLAINER_SLUG)}
  </nav>
  <main class="wmain" id="wiki-main" tabindex="-1">
    <div class="rule"></div>
    <nav class="wbreadcrumb" aria-label="Breadcrumb"><a href="wiki.html">Wiki</a><span aria-hidden="true">/</span><span aria-current="page">${esc(EXPLAINER_TITLE)}</span></nav>
    <h2 class="chroma">${esc(EXPLAINER_TITLE)}</h2>
    <p class="lede">Every figure on every page here was read out of the game while this site was being built. The pages are assembled from the same files the game itself loads to run.</p>

    <p class="wprov">This copy of the wiki was built ${esc(chrome.buildStamp)} from <b>game@${esc(chrome.headSha)}</b>.</p>

    ${section('The short version', 'Nothing here is a copy', 'not-a-copy', [
    'An ordinary wiki is a copy. Somebody reads a damage number, types it onto a page, and the page stays right until the next balance pass, which nobody tells it about.',
    'This one keeps no copy to go stale. The number is read at build time out of the game\'s own catalogs, so tuning a weapon moves this page the next time it is built, and nobody has to remember that it exists.',
  ])}

    ${section('The authored half', 'Sentences, never numbers', 'sentences-not-numbers', [
    'The game stores a weapon\'s firing style as <code>pierceLine</code>. That is exact and it is useless to read, so the wiki writes the sentence underneath it, and every one of those sentences was checked against the code that actually reads the value.',
    'Where it could not be checked, the page shows the bare value instead. An honest <b>spitter</b> beats a confident wrong sentence about spitters.',
  ])}

    ${section('The refusals', 'It would rather publish nothing', 'the-refusals', [
    'The build stops, with no partial output, if the catalogs are older than the game, if a catalog has no page, if a page is missing a card it claims to hold, if any link on the site points at nothing, or if a picture differs by one byte from the one the game just drew.',
    'Then it reads back the pages it wrote and checks them again. There is no warning mode and nothing to acknowledge, because a warning nobody reads is how a wrong number ships.',
  ])}

    ${section('The pictures', 'The game drew them, alone', 'the-pictures', [
    `The <b>${V.coverage.entries}</b> images on these pages are not screenshots, and nobody drew them for the site. The game rendered each one itself, on a clear background under fixed light, and the build redraws all of them to compare against what it is about to publish.`,
    'A live world lights and repaints the same thing differently. Treat a picture here as the shape of a thing rather than the sight of it.',
  ])}

    ${section('Who wrote what', 'The game speaks for itself', 'who-wrote-what', [
    'Every name, description and line of flavor text on this site was written for the game and is reproduced here word for word. The explaining around it was written for the wiki.',
    'So if a description reads oddly, it reads that way in the game too, and this is not the place it gets fixed.',
  ])}

    <p class="womit">Some numbers exist in the game and are still kept off these pages. Damage per second is the loud one: your might and
      your crit multiply it, your attack speed divides the interval, and half the weapons here do not have "damage times shots per second"
      behavior in the first place, so a single column would be wrong on most cards. Every page names its own gaps at the top, and the
      reason has the same shape every time. <b>The number the game runs on is not the number the page could show you</b>, and half a truth
      about damage is worse than an obvious hole.</p>

    <p class="wcount">Coverage right now: <b>${D.coverage.domains}</b> catalogs, <b>${catalogEntries}</b> entries, <b>${T?.coverage?.rows || 0}</b> measured weapon rows,
      <b>${T?.measuredBuilds?.pairs?.length || 0}</b> measured pairs, <b>${V.coverage.entries}</b> pictures.</p>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(chrome.buildStamp)} from <code>game@${esc(chrome.headSha)}</code>.
  <a href="wiki.html">All rosters</a> &middot; <a href="log.html#views">Dev log</a>
</footer>`;

  return {
    file: EXPLAINER_FILE,
    html: ctx.page({
      title: `WHOMP wiki: ${EXPLAINER_TITLE.toLowerCase()}`,
      description: 'How the WHOMP wiki is built, what it refuses to publish, and why its numbers cannot quietly go stale.',
      body,
      script: `${chrome.SEARCH_SCRIPT('')}\n${chrome.NAV_SCRIPT}`,
    }),
  };
}

// ================================================================ evidence contract
const HEX_256 = /^[a-f0-9]{64}$/;
const DAMAGE_ATTRIBUTION_LABEL = 'Damage attribution/share only; not kill credit and not causal marginal contribution.';
const UNATTRIBUTED_LABEL = 'Damage the controlled sink could not associate with a loadout weapon; published explicitly so attribution cannot fail open.';
const VISUAL_SOURCE_PREFIX = 'data/wiki-visuals/';
const VISUAL_OUTPUT_PREFIX = 'wiki-assets/';

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const sha256Text = (value) => createHash('sha256').update(value).digest('hex');

export function visualOutputPath(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath.startsWith(VISUAL_SOURCE_PREFIX)) {
    throw new Error(`visual asset path must begin ${VISUAL_SOURCE_PREFIX}: ${String(sourcePath)}`);
  }
  const tail = sourcePath.slice(VISUAL_SOURCE_PREFIX.length);
  const parts = tail.split('/');
  if (!tail || parts.some((part) => !/^[a-z0-9][a-z0-9._-]*$/.test(part) || part === '.' || part === '..')) {
    throw new Error(`unsafe visual asset path: ${sourcePath}`);
  }
  return `${VISUAL_OUTPUT_PREFIX}${parts.join('/')}`;
}

function visualManifestViolations(D, V) {
  const violations = [];
  const named = (value) => typeof value === 'string' && value.trim().length > 0;
  const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!V || V.schema !== 1) return [`wiki-visuals.json schema 1 is required${V ? `, received ${V.schema}` : ''}`];
  if (V.generator !== 'node bin/wiki-visuals.mjs') violations.push('visual manifest generator identity is invalid');
  if (!HEX_256.test(V.sourceFingerprint || '') || !Array.isArray(V.sourceFiles) || V.sourceFiles.length === 0
    || new Set(V.sourceFiles).size !== V.sourceFiles.length || V.sourceFiles.some((path) => !named(path))) {
    violations.push('visual manifest source fingerprint or source inventory is invalid');
  }
  if (V.provenance?.ownership !== 'repository-controlled-generated-output'
    || V.provenance?.aiGenerated !== false || V.provenance?.externalAssets !== false
    || !named(V.provenance?.derivation) || !V.provenance?.license?.classification) {
    violations.push('visual manifest repository ownership, derivation or license provenance is incomplete');
  }
  if (V.performanceBudget?.format !== 'image/png' || V.performanceBudget?.primaryPortraitWidth !== 256
    || canonicalJson(V.performanceBudget?.responsivePortraitWidths) !== canonicalJson([256, 512])
    || !Number.isSafeInteger(V.performanceBudget?.totalBytes) || !Number.isSafeInteger(V.performanceBudget?.variantBytes)) {
    violations.push('visual performance budget does not preserve the PNG and 256/512 responsive contract');
  }
  if (!named(V.renderer?.threeRevision) || V.renderer?.pixelRatio !== 1 || V.renderer?.clearAlpha !== 0
    || canonicalJson(V.renderer?.portraitVariants) !== canonicalJson([
      { label: '256w', width: 256, height: 288 }, { label: '512w', width: 512, height: 576 },
    ]) || !named(V.renderer?.browser?.product) || !named(V.renderer?.browser?.userAgent)
    || !named(V.renderer?.browser?.jsVersion) || !named(V.renderer?.node)
    || !named(V.renderer?.vite) || !named(V.renderer?.three)) {
    violations.push('visual renderer does not preserve the transparent deterministic 256/512 capture contract');
  }
  const policies = Array.isArray(V.policies) ? V.policies : [];
  const entries = Array.isArray(V.entries) ? V.entries : [];
  const unavailable = Array.isArray(V.unavailable) ? V.unavailable : [];
  if (policies.length === 0 || new Set(policies.map((policy) => policy.domain)).size !== policies.length
    || policies.some((policy) => !named(policy?.domain))) {
    violations.push('visual manifest must expose a nonempty set of unique covered domain policies');
  }
  if (unavailable.length !== 0) violations.push('visual manifest contains unavailable entries; this release requires complete canonical coverage');
  const surfaces = Array.isArray(V.surfaceInventory) ? V.surfaceInventory : [];
  if (surfaces.length === 0 || new Set(surfaces.map((surface) => surface?.surface)).size !== surfaces.length
    || surfaces.some((surface) => !named(surface?.surface) || !named(surface?.source) || !named(surface?.reason)
      || !['generated', 'reference-only', 'unavailable', 'excluded'].includes(surface?.status)
      || (surface.entryIds && (!Array.isArray(surface.entryIds) || new Set(surface.entryIds).size !== surface.entryIds.length)))) {
    violations.push('visual surface inventory is missing, duplicated or unclassified');
  }
  const expected = new Set();
  for (const policy of policies) {
    const sourceDomain = D.domains?.[policy.domain];
    const expectedIds = Array.isArray(policy.expectedIds) ? policy.expectedIds : [];
    const classifiedSurface = surfaces.find((surface) => surface.surface === policy.domain);
    if (!sourceDomain || !named(policy.strategy) || new Set(expectedIds).size !== expectedIds.length
      || canonicalJson([...expectedIds].sort()) !== canonicalJson(Object.keys(sourceDomain.entries || {}).sort())) {
      violations.push(`visual policy ${policy.domain || '(missing)'} does not exactly cover its canonical game-data domain`);
    }
    if (classifiedSurface && classifiedSurface.status !== 'generated') {
      violations.push(`visual policy ${policy.domain} conflicts with surface inventory status ${classifiedSurface.status}`);
    }
    for (const id of expectedIds) expected.add(`${policy.domain}:${id}`);
  }
  const entryKeys = new Set();
  const assetKeys = new Set();
  const sourcePaths = new Set();
  const outputPaths = new Set();
  let variantCount = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    const key = `${entry?.domain}:${entry?.id}`;
    if (!expected.has(key) || entryKeys.has(key) || entry.assetKey !== key || assetKeys.has(entry.assetKey)) {
      violations.push(`visual association ${key} is missing, duplicated or outside a canonical policy`);
    }
    entryKeys.add(key);
    assetKeys.add(entry.assetKey);
    const policy = policies.find((candidate) => candidate.domain === entry?.domain);
    if (entry.kind !== policy?.strategy || !D.domains?.[entry.domain]?.entries?.[entry.id]
      || !named(entry.name) || !named(entry.source) || entry.sourceFingerprint !== V.sourceFingerprint
      || entry.mimeType !== 'image/png' || entry.pixelated !== false || entry.alpha !== true
      || entry.alt?.decorative !== false || !named(entry.alt?.text) || !named(entry.alt?.source)
      || !String(entry.alt?.text || '').toLocaleLowerCase().includes(String(entry.name || '').toLocaleLowerCase())) {
      violations.push(`visual entry ${key} has invalid identity, provenance, alt, MIME, alpha or rendering semantics`);
    }
    if (entry.domain === 'cosmetics' && !named(entry.limitation)) violations.push(`visual entry ${key} lacks its cosmetic palette limitation`);
    const variants = Array.isArray(entry.variants) ? entry.variants : [];
    if (entry.kind === 'runtime-render') {
      if (canonicalJson(variants.map(({ label, width, height }) => ({ label, width, height })))
        !== canonicalJson([{ label: '256w', width: 256, height: 288 }, { label: '512w', width: 512, height: 576 }])) {
        violations.push(`visual entry ${key} does not have exact 256/512 runtime-render variants`);
      }
      const context = entry.renderContext;
      const paletteValid = plainObject(context?.palette)
        && (context.palette.id === 'toyMeadow' || context.palette.id === null)
        && (context.palette.id === 'toyMeadow'
          ? context.palette.source === 'src/render/palettes.ts#PALETTES.toyMeadow'
            && /neutral/i.test(context.palette.role || '') && /live world/i.test(context.palette.role || '') && /recolou?r/i.test(context.palette.role || '')
          : context.palette.source === null && /renderer-owned materials/i.test(context.palette.role || ''));
      const frameValid = plainObject(context?.frame) && named(context.frame.mode)
        && (context.frame.clockSec === null || Number.isFinite(context.frame.clockSec))
        && (context.frame.stateTimeMs === null || Number.isFinite(context.frame.stateTimeMs));
      const trailingWearable = entry.domain === 'wearables' && D.domains.wearables.entries[entry.id]?.trails === true;
      const expectedCameraView = trailingWearable ? 'rear' : 'front';
      if (!plainObject(context)
        || context.presentation !== 'deterministic-isolated-runtime-render'
        || !paletteValid
        || canonicalJson(context.camera) !== canonicalJson({ projection: 'perspective', verticalFovDeg: 34, framing: 'bounds-fit', view: expectedCameraView })
        || canonicalJson(context.lighting) !== canonicalJson({ mode: 'fixed-neutral-three-light', source: 'src/dev/wikiVisualsGallery.ts#addPortraitLights' })
        || canonicalJson(context.background) !== canonicalJson({ alpha: 0 })
        || !frameValid || !named(context.limitation)) {
        violations.push(`visual entry ${key} lacks the exact isolated runtime render context`);
      }
      if (trailingWearable && (!/\brear\b/i.test(entry.alt?.text || '')
        || !/\brear\b/i.test(context?.limitation || '') || !/\btrail\b/i.test(context?.limitation || ''))) {
        violations.push(`visual entry ${key} does not explain its rear camera for a trailing wearable`);
      }
      if (entry.enemyRenderClass === 'horde' && (context?.frame?.clockSec !== 1 || context?.frame?.stateTimeMs !== 1000)) {
        violations.push(`visual entry ${key} does not pin the canonical horde portrait frame`);
      }
      if (/static|construction|isolated|normalized/i.test(context?.frame?.mode || '')
        && (context?.frame?.clockSec !== null || context?.frame?.stateTimeMs !== null)) {
        violations.push(`visual entry ${key} assigns animation time to a static construction pose`);
      }
      if (entry.domain === 'shipFragments' && (!/isolated|normalized/i.test(context?.frame?.mode || '')
        || !/isolated|normalized|world placement/i.test(context?.limitation || ''))) {
        violations.push(`visual entry ${key} does not disclose isolated normalized ship-fragment placement`);
      }
    } else if (variants.length !== 1 || variants[0]?.label !== 'intrinsic') {
      violations.push(`visual entry ${key} must have exactly one intrinsic glyph/composition variant`);
    } else if (entry.renderContext !== undefined) {
      violations.push(`visual entry ${key} assigns runtime render context to a non-runtime visual`);
    }
    const primary = variants[0];
    for (const field of ['path', 'width', 'height', 'byteSize', 'sha256', 'alpha', 'mimeType']) {
      if (entry[field] !== primary?.[field]) violations.push(`visual entry ${key} primary ${field} differs from its first variant`);
    }
    for (const variant of variants) {
      variantCount++;
      totalBytes += Number.isSafeInteger(variant?.byteSize) ? variant.byteSize : 0;
      let outputPath = '';
      try { outputPath = visualOutputPath(variant?.path); } catch (error) { violations.push(error.message); }
      if (sourcePaths.has(variant?.path) || (outputPath && outputPaths.has(outputPath))) violations.push(`visual variant ${key}/${variant?.label} has a duplicate path`);
      sourcePaths.add(variant?.path);
      if (outputPath) outputPaths.add(outputPath);
      if (!Number.isSafeInteger(variant?.width) || variant.width < 1 || !Number.isSafeInteger(variant?.height) || variant.height < 1
        || !Number.isSafeInteger(variant?.byteSize) || variant.byteSize < 1 || variant.byteSize > V.performanceBudget.variantBytes
        || !HEX_256.test(variant?.sha256 || '') || variant?.mimeType !== 'image/png' || variant?.alpha !== true) {
        violations.push(`visual variant ${key}/${variant?.label} has invalid dimensions, size, hash, MIME or alpha metadata`);
      }
    }
  }
  if (entryKeys.size !== expected.size || [...expected].some((key) => !entryKeys.has(key))) {
    violations.push(`visual entry coverage is ${entryKeys.size}, expected ${expected.size} canonical associations`);
  }
  for (const entry of entries) {
    for (const component of entry.components || []) {
      if (!entryKeys.has(`${component?.domain}:${component?.id}`)) violations.push(`visual entry ${entry.assetKey} has unresolved component ${component?.domain}:${component?.id}`);
    }
  }
  const byDomain = {};
  for (const policy of policies) byDomain[policy.domain] = { entries: 0, variants: 0, unavailable: 0, bytes: 0 };
  for (const entry of entries) {
    const row = byDomain[entry.domain] || (byDomain[entry.domain] = { entries: 0, variants: 0, unavailable: 0, bytes: 0 });
    row.entries++;
    row.variants += entry.variants?.length || 0;
    row.bytes += (entry.variants || []).reduce((sum, variant) => sum + (variant.byteSize || 0), 0);
  }
  const coverage = { domains: policies.length, entries: entries.length, variants: variantCount, unavailable: unavailable.length, bytes: totalBytes, byDomain };
  if (canonicalJson(V.coverage) !== canonicalJson(coverage) || totalBytes > V.performanceBudget.totalBytes) {
    violations.push('visual coverage/performance ledger does not match its entries and variants');
  }
  if (!HEX_256.test(V.contentFingerprint || '')) violations.push('visual contentFingerprint is invalid');
  else {
    const copy = JSON.parse(JSON.stringify(V));
    delete copy.contentFingerprint;
    if (V.contentFingerprint !== sha256Text(canonicalJson(copy))) violations.push('visual contentFingerprint does not match manifest content');
  }
  return violations;
}

function tierEvidenceViolations(D, T) {
  const violations = [];
  if (!T || T.schema !== 2) return [`tier-rankings.json schema 2 is required${T ? `, received ${T.schema}` : ''}`];
  const named = (value) => typeof value === 'string' && value.trim().length > 0;
  const finite = (value) => Number.isFinite(value);
  const axisDefs = Array.isArray(T.metric?.axes) ? T.metric.axes : [];
  const axisKeys = axisDefs.map((axis) => axis.key);
  const axisUnits = new Map(axisDefs.map((axis) => [axis.key, axis.unit]));

  if (T.evidenceKind !== 'automatic-weapon-controlled-simulation') violations.push('tier evidenceKind must identify automatic-weapon controlled simulation');
  if (JSON.stringify(T.covers) !== JSON.stringify(['automaticWeapons'])) violations.push('tier covers must be exactly automaticWeapons');
  const expectedNotCovered = ['characters', 'coreWeapons', 'relics', 'tomes'];
  if (JSON.stringify(Object.keys(T.notCovered || {}).sort()) !== JSON.stringify(expectedNotCovered)
    || Object.values(T.notCovered || {}).some((reason) => !named(reason))) {
    violations.push('tier notCovered must name core weapons, tomes, relics and characters with reasons');
  }
  if (T.sourceContract?.algorithm !== 'sha256' || !HEX_256.test(T.sourceContract?.digest || '')
    || !Array.isArray(T.sourceContract?.files) || T.sourceContract.files.length === 0
    || T.sourceContract.files.some((file) => !named(file?.path) || !HEX_256.test(file?.sha256 || ''))
    || new Set(T.sourceContract.files.map((file) => file.path)).size !== T.sourceContract.files.length) {
    violations.push('tier sourceContract is missing its sha256 digest or unique file fingerprints');
  }
  if (!named(T.fingerprint) || !Array.isArray(T.limits) || T.limits.length === 0
    || T.limits.some((line) => !named(line)) || !Array.isArray(T.heldConstant) || T.heldConstant.length === 0) {
    violations.push('tier fingerprint, held constants or measurement limits are incomplete');
  }
  const limitText = (T.limits || []).join(' ');
  if (!/same(?:[- ]| deterministic seed )cohort/i.test(limitText) || !/holdout/i.test(limitText)) {
    violations.push('tier limits do not disclose same-cohort greedy selection bias and the absence of holdout validation');
  }
  if (!Number.isInteger(T.executionContract?.workersUsed) || T.executionContract.workersUsed <= 0
    || !Number.isInteger(T.executionContract?.workerCap) || T.executionContract.workerCap !== 4
    || T.executionContract.workersUsed > T.executionContract.workerCap
    || T.executionContract.executionOnly !== true || !named(T.executionContract.note)) {
    violations.push('tier executionContract does not classify bounded worker use as execution-only');
  }
  if (axisKeys.length < 2 || new Set(axisKeys).size !== axisKeys.length
    || axisDefs.some((axis) => !named(axis.key) || !named(axis.unit) || !named(axis.job) || !named(axis.what))) {
    violations.push('tier metric axes are missing keys, units, jobs or fixture definitions');
  }

  const fixtures = T.fixtureContract || {};
  if (JSON.stringify(Object.keys(fixtures).sort()) !== JSON.stringify(['boss', 'trash'])) {
    violations.push('tier fixtureContract must contain exactly trash and boss fixtures');
  }
  for (const [key, fixture] of Object.entries(fixtures)) {
    const canonicalEnemy = D.domains.enemies?.entries?.[fixture?.id];
    const numbers = [fixture?.kindIndex, fixture?.authored?.radius, fixture?.authored?.speed, fixture?.authored?.hp,
      fixture?.controlled?.radius, fixture?.controlled?.speed, fixture?.controlled?.hp];
    if (!named(fixture?.id) || !named(fixture?.name) || !named(fixture?.tier)
      || !named(fixture?.classification) || !named(fixture?.control)
      || !canonicalEnemy || canonicalEnemy.tier !== fixture.tier
      || numbers.some((value) => !finite(value)) || fixture.runtimeBehavior !== false) {
      violations.push(`tier ${key} fixture does not expose canonical identity, authored/controlled values and runtimeBehavior=false`);
    }
  }
  if (fixtures.boss?.tier !== 'boss' || !/stationary/i.test(fixtures.boss?.control || '')
    || !/non-attacking|does not attack/i.test(fixtures.boss?.control || '')
    || !/behavior|phase/i.test(fixtures.boss?.control || '')) {
    violations.push('tier stationary-target fixture is not tied to a canonical boss kind with disabled attacks and behavior');
  }

  const singles = T.sample?.singles;
  const buildsSample = T.sample?.builds;
  const sampleValid = (sample, label) => {
    if (!Number.isInteger(sample?.seeds) || sample.seeds <= 0
      || !Array.isArray(sample.seedList) || sample.seedList.length !== sample.seeds
      || new Set(sample.seedList).size !== sample.seedList.length
      || sample.seedList.some((seed) => !Number.isInteger(seed))
      || !finite(sample.secondsPerRun) || sample.secondsPerRun <= 0) {
      violations.push(`${label} sample does not preserve its deterministic seeds and run duration`);
      return false;
    }
    return true;
  };
  const singlesValid = sampleValid(singles, 'single-weapon');
  const buildsValid = sampleValid(buildsSample, 'pair/build');

  const distribution = (reading, expectedN, label, { requireN = true, full = false } = {}) => {
    if (!reading || typeof reading !== 'object') { violations.push(`${label} has no distribution`); return; }
    if (requireN && reading.n !== expectedN) violations.push(`${label} sample n=${reading.n} does not match ${expectedN}`);
    if (!Array.isArray(reading.perSeed) || reading.perSeed.length !== expectedN
      || reading.perSeed.some((value) => !finite(value))) violations.push(`${label} does not preserve ${expectedN} finite per-seed values`);
    if (![reading.p10, reading.median, reading.p90].every(finite)
      || reading.p10 > reading.median || reading.median > reading.p90) violations.push(`${label} has an invalid P10/median/P90 distribution`);
    if (full && (![reading.min, reading.mean, reading.max].every(finite)
      || reading.min > reading.p10 || reading.p90 > reading.max)) violations.push(`${label} has an invalid min/mean/max distribution`);
  };

  const loadout = T.loadoutContract;
  const weaponDomain = D.domains.weapons;
  const expectedEligible = (weaponDomain.order || []).filter((id) => !weaponDomain.refs?.[id]?.evolvesFrom).sort();
  if (!Number.isInteger(loadout?.weaponSlots) || loadout.weaponSlots <= 0
    || !Array.isArray(loadout?.eligibleIds) || new Set(loadout.eligibleIds).size !== loadout.eligibleIds.length
    || JSON.stringify([...loadout.eligibleIds].sort()) !== JSON.stringify(expectedEligible)
    || loadout.insertionOrder !== 'lexicographic-weapon-id' || !named(loadout.orderLimit)
    || !Number.isInteger(loadout.level) || loadout.level <= 0 || loadout.rarityBonusLevels !== 0) {
    violations.push('tier loadoutContract does not match the legal automatic-weapon roster, deterministic insertion order and neutral rarity');
  }
  const expectedPairRows = expectedEligible.length * (expectedEligible.length - 1) / 2;
  const buildSize = buildsSample?.buildSize;
  const buildStartCount = buildsSample?.buildStartCount;
  const expectedBuildChains = axisKeys.length * (Number.isInteger(buildStartCount) ? buildStartCount : 0);
  let expectedCandidatesPerChain = 1;
  if (Number.isInteger(buildSize) && buildSize > 0) {
    for (let size = 1; size < buildSize; size++) expectedCandidatesPerChain += expectedEligible.length - size;
  }
  const expectedTotalCandidates = expectedBuildChains * expectedCandidatesPerChain;
  const expectedBuildSeconds = (expectedEligible.length + expectedPairRows)
    * (buildsValid ? buildsSample.seeds : 0) * axisKeys.length * (buildsValid ? buildsSample.secondsPerRun : 0)
    + expectedTotalCandidates * (buildsValid ? buildsSample.seeds : 0) * (buildsValid ? buildsSample.secondsPerRun : 0);
  if (!Number.isInteger(buildSize) || buildSize <= 0 || buildSize > loadout?.weaponSlots || buildSize > expectedEligible.length
    || !Number.isInteger(buildStartCount) || buildStartCount <= 0 || buildStartCount > expectedEligible.length
    || buildsSample?.level !== loadout?.level || buildsSample?.soloRows !== expectedEligible.length
    || buildsSample?.pairRows !== expectedPairRows || buildsSample?.buildChains !== expectedBuildChains
    || buildsSample?.totalCandidateLoadouts !== expectedTotalCandidates
    || buildsSample?.totalSimulatedSeconds !== expectedBuildSeconds || !named(buildsSample?.note)) {
    violations.push('pair/build sample accounting does not match the legal roster, axes, build size, candidate loadouts or simulated duration');
  }
  const expectedSingleRunsPerRow = (singlesValid ? singles.seeds : 0) * axisKeys.length;
  const expectedSingleSeconds = (T.coverage?.rows || 0) * expectedSingleRunsPerRow * (singlesValid ? singles.secondsPerRun : 0);
  if (singles?.rows !== T.coverage?.rows || singles?.runsPerRow !== expectedSingleRunsPerRow
    || singles?.totalSimulatedSeconds !== expectedSingleSeconds) {
    violations.push('single-weapon sample accounting does not match evidence rows, axes, seeds or simulated duration');
  }

  const rows = Array.isArray(T.weapons) ? T.weapons : [];
  if (T.coverage?.weaponDefs !== weaponDomain.count || T.coverage?.measured !== weaponDomain.count
    || T.coverage?.rows !== rows.length) violations.push('tier coverage does not cover the complete automatic-weapon roster and evidence rows');
  const rowIds = new Set();
  const ranks = new Map();
  for (const row of rows) {
    const rowKey = `${row.id}:${row.form}:${row.level}`;
    if (rowIds.has(rowKey)) violations.push(`tier row ${rowKey} is duplicated`);
    rowIds.add(rowKey);
    if (!weaponDomain.entries[row.id] || !named(row.name) || !named(row.form) || !named(row.cohort) || !Number.isInteger(row.level)) {
      violations.push(`tier row ${rowKey} has no canonical weapon/form/cohort/level identity`);
    }
    for (const key of axisKeys) {
      const reading = row.axes?.[key];
      distribution(reading, singlesValid ? singles.seeds : 0, `tier row ${rowKey}/${key}`, { full: true });
      if (reading?.status === 'UNMEASURED') {
        if (reading.tier !== null || !named(reading.reason)
          || (reading.rankInCohort !== null && reading.rankInCohort !== undefined)
          || (reading.percentileInCohort !== null && reading.percentileInCohort !== undefined)) {
          violations.push(`UNMEASURED tier row ${rowKey}/${key} has a tier/rank or no exact reason`);
        }
        continue;
      }
      if (!named(reading?.tier) || !Number.isInteger(reading?.rankInCohort) || !Number.isInteger(reading?.cohortSize)
        || !finite(reading?.percentileInCohort)) {
        violations.push(`measured tier row ${rowKey}/${key} has no tier or cohort rank`);
      } else {
        const cohortKey = `${row.cohort}/${key}`;
        if (!ranks.has(cohortKey)) ranks.set(cohortKey, []);
        ranks.get(cohortKey).push(reading);
      }
      if (reading?.volatile && (!named(reading.tierAtP10) || !named(reading.tierAtP90) || reading.tierSpan <= 1)) {
        violations.push(`volatile tier row ${rowKey}/${key} has no visible tier span evidence`);
      }
    }
  }
  for (const [cohort, readings] of ranks) {
    const invalid = readings.some((reading) => {
      const expectedRank = 1 + readings.filter((other) => other.median > reading.median).length;
      const expectedPercentile = readings.length > 1
        ? Math.round((1 - (expectedRank - 1) / (readings.length - 1)) * 1000) / 1000
        : 1;
      return reading.cohortSize !== readings.length || reading.rankInCohort !== expectedRank
        || reading.percentileInCohort !== expectedPercentile;
    });
    if (invalid) {
      violations.push(`tier cohort ${cohort} does not use median-based competition ranks and shared tie percentiles`);
    }
  }

  const measuredBuilds = T.measuredBuilds;
  if (!measuredBuilds || !named(measuredBuilds.method) || !Number.isInteger(measuredBuilds.pairLevel)
    || !named(measuredBuilds.partnerQualityNote) || !measuredBuilds.solo
    || !Array.isArray(measuredBuilds.pairs) || !Array.isArray(measuredBuilds.builds)) {
    violations.push('measuredBuilds is missing method, pair level, quality note, solo evidence, pairs or build paths');
    return violations;
  }
  if (measuredBuilds.pairLevel !== loadout?.level) violations.push('measuredBuilds pair level differs from the loadout contract');
  const eligible = loadout?.eligibleIds || [];
  if (JSON.stringify(Object.keys(measuredBuilds.solo).sort()) !== JSON.stringify([...eligible].sort())) {
    violations.push('measuredBuilds solo evidence does not exactly cover eligible weapon ids');
  }
  for (const id of eligible) {
    for (const key of axisKeys) distribution(measuredBuilds.solo?.[id]?.[key], buildsValid ? buildsSample.seeds : 0, `solo ${id}/${key}`, { full: true });
  }
  const expectedBuildDescriptors = axisKeys.flatMap((axis) => [...eligible]
    .sort((a, b) => (measuredBuilds.solo?.[b]?.[axis]?.median ?? -Infinity)
      - (measuredBuilds.solo?.[a]?.[axis]?.median ?? -Infinity) || a.localeCompare(b))
    .slice(0, Number.isInteger(buildStartCount) ? buildStartCount : 0)
    .map((id) => `${axis}/${id}`));
  const actualBuildDescriptors = measuredBuilds.builds.map((build) => `${build?.axis}/${build?.seededFrom?.[0]}`);
  if (JSON.stringify(actualBuildDescriptors) !== JSON.stringify(expectedBuildDescriptors)
    || new Set(actualBuildDescriptors).size !== actualBuildDescriptors.length) {
    violations.push('measured build chains do not exactly cover the unique top-solo starts on every axis');
  }

  const pairKeys = new Set();
  for (const pair of measuredBuilds.pairs) {
    const ids = pair.ids || [];
    const pairKey = ids.join('+');
    if (ids.length !== 2 || new Set(ids).size !== 2 || ids.some((id) => !eligible.includes(id))
      || JSON.stringify(ids) !== JSON.stringify([...ids].sort()) || pairKeys.has(pairKey)) {
      violations.push(`measured pair ${pairKey || '(missing ids)'} is duplicated, unordered or ineligible`);
    }
    pairKeys.add(pairKey);
    for (const key of axisKeys) {
      const reading = pair.axes?.[key];
      distribution(reading, buildsValid ? buildsSample.seeds : 0, `pair ${pairKey}/${key}`);
      if (![reading?.soloSum, reading?.synergy, reading?.synergyP10, reading?.synergyP90].every(finite)
        || reading.synergyP10 > reading.synergy || reading.synergy > reading.synergyP90
        || !Array.isArray(reading.synergyPerSeed) || reading.synergyPerSeed.length !== buildsSample?.seeds
        || reading.synergyPerSeed.some((value) => !finite(value)) || reading.componentUnit !== 'damage/min'
        || reading.attributionLabel !== DAMAGE_ATTRIBUTION_LABEL || reading.unattributedLabel !== UNATTRIBUTED_LABEL
        || JSON.stringify(Object.keys(reading.byWeapon || {}).sort()) !== JSON.stringify([...ids].sort())) {
        violations.push(`pair ${pairKey}/${key} has invalid solo-sum ratio or per-weapon attribution`);
      }
      distribution(reading?.unattributed, buildsValid ? buildsSample.seeds : 0, `pair ${pairKey}/${key} unattributed damage`, { full: true });
      if (reading?.unattributed?.max !== 0) violations.push(`pair ${pairKey}/${key} has non-zero unattributed controlled-sink damage`);
      for (const id of ids) {
        const component = reading?.byWeapon?.[id];
        distribution(component, buildsValid ? buildsSample.seeds : 0, `pair ${pairKey}/${key} component ${id}`, { full: true });
        const share = component?.shareOfAttributed;
        distribution(share, buildsValid ? buildsSample.seeds : 0, `pair ${pairKey}/${key} share ${id}`, { requireN: false });
      }
      for (let index = 0; index < (buildsValid ? buildsSample.seeds : 0); index++) {
        const attributed = ids.reduce((sum, id) => sum + (reading?.byWeapon?.[id]?.perSeed?.[index] || 0), 0);
        const shareSum = ids.reduce((sum, id) => sum + (reading?.byWeapon?.[id]?.shareOfAttributed?.perSeed?.[index] || 0), 0);
        if (attributed > 0 && Math.abs(shareSum - 1) > 0.002) violations.push(`pair ${pairKey}/${key} seed ${index} attribution shares do not sum to one`);
      }
    }
  }
  if (pairKeys.size !== expectedPairRows) violations.push(`measured pair coverage is ${pairKeys.size}, expected ${expectedPairRows} exhaustive unordered pairs`);

  const achievements = D.domains.achievements.entries;
  for (const build of measuredBuilds.builds) {
    const label = `${build.axis || 'unknown'} build`;
    if (build.label !== 'Measured controlled-sim build' || !axisKeys.includes(build.axis)
      || build.unit !== axisUnits.get(build.axis) || build.method !== 'greedy-forward-selection'
      || build.level !== loadout?.level || !Array.isArray(build.seededFrom) || build.seededFrom.length !== 1
      || !eligible.includes(build.seededFrom[0]) || build.candidateLoadouts !== expectedCandidatesPerChain
      || !Array.isArray(build.ids) || build.ids.length !== buildSize
      || build.ids.length > loadout?.weaponSlots || new Set(build.ids).size !== build.ids.length
      || build.ids.some((id) => !eligible.includes(id)) || JSON.stringify(build.ids) !== JSON.stringify([...build.ids].sort())) {
      violations.push(`${label} violates its label, axis, unit, method, level or legal loadout`);
    }
    if (![build.p10, build.median, build.p90].every(finite) || build.p10 > build.median || build.median > build.p90) {
      violations.push(`${label} has an invalid P10/median/P90 summary`);
    }
    if (!Array.isArray(build.requirements) || build.requirements.length !== build.ids.length
      || JSON.stringify(build.requirements.map((requirement) => requirement.id).sort()) !== JSON.stringify([...build.ids].sort())) {
      violations.push(`${label} does not expose one unlock requirement per component`);
    }
    for (const requirement of build.requirements || []) {
      const weapon = weaponDomain.entries[requirement.id];
      const achievement = requirement.achievementId ? achievements[requirement.achievementId] : null;
      if (!weapon || requirement.unlockedFromStart !== weapon.unlockedFromStart
        || (!weapon.unlockedFromStart && (!achievement || achievement.name !== requirement.achievementName
          || achievement.unlocks?.weapon !== requirement.id))) {
        violations.push(`${label} has an invalid unlock requirement for ${requirement.id}`);
      }
    }
    if (!Array.isArray(build.steps) || build.steps.length !== buildSize) violations.push(`${label} does not contain one measured step per configured component`);
    let previous = [];
    for (const [index, step] of (build.steps || []).entries()) {
      const expectedStepIds = index === 0 ? step.ids : [...previous, step.added].sort();
      if (!Array.isArray(step.ids) || step.ids.length !== index + 1 || new Set(step.ids).size !== step.ids.length
        || JSON.stringify(step.ids) !== JSON.stringify([...step.ids].sort())
        || (index === 0
          ? step.added !== null || step.marginal !== null || JSON.stringify(step.ids) !== JSON.stringify(build.seededFrom)
          : !eligible.includes(step.added) || JSON.stringify(step.ids) !== JSON.stringify(expectedStepIds))) {
        violations.push(`${label} step ${index + 1} is not a legal deterministic prefix`);
      }
      distribution(step, buildsValid ? buildsSample.seeds : 0, `${label} step ${index + 1}`, { requireN: false });
      if (step.attributionLabel !== DAMAGE_ATTRIBUTION_LABEL || step.unattributedLabel !== UNATTRIBUTED_LABEL
        || JSON.stringify(Object.keys(step.byWeapon || {}).sort()) !== JSON.stringify([...(step.ids || [])].sort())) {
        violations.push(`${label} step ${index + 1} does not attribute every equipped weapon`);
      }
      distribution(step.unattributed, buildsValid ? buildsSample.seeds : 0, `${label} step ${index + 1} unattributed damage`, { full: true });
      if (step.unattributed?.max !== 0) violations.push(`${label} step ${index + 1} has non-zero unattributed controlled-sink damage`);
      for (const id of step.ids || []) {
        const component = step.byWeapon?.[id];
        distribution(component, buildsValid ? buildsSample.seeds : 0, `${label} step ${index + 1} component ${id}`, { full: true });
        distribution(component?.shareOfAttributed, buildsValid ? buildsSample.seeds : 0, `${label} step ${index + 1} share ${id}`, { requireN: false });
      }
      for (let seedIndex = 0; seedIndex < (buildsValid ? buildsSample.seeds : 0); seedIndex++) {
        const attributed = (step.ids || []).reduce((sum, id) => sum + (step.byWeapon?.[id]?.perSeed?.[seedIndex] || 0), 0);
        const shareSum = (step.ids || []).reduce((sum, id) => sum + (step.byWeapon?.[id]?.shareOfAttributed?.perSeed?.[seedIndex] || 0), 0);
        if (attributed > 0 && Math.abs(shareSum - 1) > 0.002) violations.push(`${label} step ${index + 1} seed ${seedIndex} attribution shares do not sum to one`);
      }
      if (index > 0) {
        distribution(step.marginal, buildsValid ? buildsSample.seeds : 0, `${label} step ${index + 1} marginal`);
        if (step.marginal?.unit !== build.unit || !finite(step.gain)) {
          violations.push(`${label} step ${index + 1} marginal gain does not preserve its unit and summary`);
        }
      }
      previous = step.ids || [];
    }
    if (JSON.stringify(previous) !== JSON.stringify(build.ids)) violations.push(`${label} final step differs from the published loadout`);
  }
  return violations;
}

// ================================================================ entry point
export function buildWiki(ctx) {
  const { D, T, V } = ctx;
  const evidenceViolations = tierEvidenceViolations(D, T);
  if (evidenceViolations.length) throw new Error(`Wiki evidence contract failed (${evidenceViolations.length}):\n  ${evidenceViolations.join('\n  ')}`);
  const visualViolations = visualManifestViolations(D, V);
  if (visualViolations.length) throw new Error(`Wiki visual contract failed (${visualViolations.length}):\n  ${visualViolations.join('\n  ')}`);
  const rosters = rosterSpecs(D, ctx.esc, T, V);
  const violations = [];
  if (D.schema !== 9) violations.push(`game-data.json schema 9 is required, received ${D.schema}`);
  for (const path of DISPLAY_ROOT_FIELD_PATHS) {
    const field = displayPathValue(D, path);
    if (!field.present || !displayValueIsRenderable(field.value)) {
      violations.push(`game artifact has no renderable displayed root field ${path}`);
    }
  }
  const searchTypeDomains = Object.keys(SEARCH_TYPE).sort();
  const publicDomains = [...(D.domainOrder || [])].sort();
  if (JSON.stringify(searchTypeDomains) !== JSON.stringify(publicDomains)
    || Object.values(SEARCH_TYPE).some((label) => typeof label !== 'string' || !label.trim() || /[A-Z]/.test(label))) {
    violations.push('player-facing search type labels do not exactly cover the public domain order');
  }
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
      const displayedPaths = DISPLAY_FIELD_PATHS[roster.domain];
      if (!displayedPaths) {
        violations.push(`domain ${roster.domain} has no displayed-field contract`);
      } else {
        for (const entry of roster.entries) {
          for (const path of ['id', 'name', ...displayedPaths]) {
            const field = displayPathValue(entry, path);
            if (!field.present || !displayValueIsRenderable(field.value)
              || (NONEMPTY_DISPLAY_ARRAYS.has(`${roster.domain}.${path}`)
                && (!Array.isArray(field.value) || field.value.length === 0))) {
              violations.push(`roster ${roster.slug} entry ${entry.id || '(missing id)'} has no renderable displayed field ${path}`);
            }
          }
        }
      }
      for (const rule of DISPLAY_CONDITIONAL_FIELD_PATHS[roster.domain] || []) {
        for (const entry of roster.entries) {
          if (!rule.when(entry, D)) continue;
          const field = displayPathValue(entry, rule.path);
          if (!field.present || !displayValueIsRenderable(field.value)) {
            violations.push(`roster ${roster.slug} entry ${entry.id || '(missing id)'} has no renderable conditional displayed field ${rule.path}`);
          }
        }
      }
      for (const rule of DISPLAY_REF_FIELD_PATHS[roster.domain] || []) {
        for (const entry of roster.entries) {
          const descriptor = typeof rule === 'string' ? { path: rule, when: () => true } : rule;
          if (!descriptor.when(entry, D)) continue;
          const field = displayPathValue(source.refs?.[entry.id], descriptor.path);
          if (!field.present || !displayValueIsRenderable(field.value)
            || (typeof rule !== 'string' && Array.isArray(field.value) && field.value.length === 0)) {
            violations.push(`roster ${roster.slug} entry ${entry.id || '(missing id)'} has no renderable displayed ref field ${descriptor.path}`);
          }
        }
      }
    }
  }
  for (const domain of D.domainOrder) {
    if (!byDomain.has(domain)) violations.push(`public domain ${domain} has no declared wiki route`);
  }
  for (const domain of byDomain.keys()) {
    if (!D.domainOrder.includes(domain)) violations.push(`wiki renders undeclared domain ${domain}`);
  }
  if (!T || T.schema !== 2) violations.push('tier-rankings.json schema 2 is required');
  const ultimateRuntime = D.domains.ultimates?.runtime;
  const expectedUltimateProvenance = [
    'activation', 'availabilityGate', 'botKitPolicy', 'bossReaction', 'campaignRunStart', 'coopRunStart',
    'duelKitPolicy', 'headlessRunStart', 'hubPreview', 'ownershipAndSlot', 'registry',
  ].sort();
  const ultimateSemantics = Array.isArray(ultimateRuntime?.semantics) ? ultimateRuntime.semantics : [];
  const ultimateSemanticText = ultimateSemantics.join(' ').toLocaleLowerCase();
  const ultimateSemanticSubjects = [/campaign/, /headless/, /co-?op|cooperative/, /hub/, /preview/, /duel/, /bot/];
  if (ultimateRuntime?.owner !== 'player' || ultimateRuntime?.slot !== 'Q'
    || ultimateRuntime?.availability?.fromRunStart !== true
    || ultimateRuntime?.availability?.requiresBossKill !== false
    || ultimateRuntime?.availability?.scope !== 'standard-player-run'
    || ultimateSemantics.length < 4
    || ultimateSemantics.some((line) => typeof line !== 'string' || !line.trim())
    || ultimateSemanticSubjects.some((pattern) => !pattern.test(ultimateSemanticText))
    || JSON.stringify(Object.keys(ultimateRuntime?.provenance || {}).sort()) !== JSON.stringify(expectedUltimateProvenance)
    || Object.values(ultimateRuntime?.provenance || {}).some((source) => typeof source !== 'string' || !source.trim())) {
    violations.push('ultimate runtime does not prove the scoped player-owned Q-slot availability and separate campaign, preview, duel and bot policies');
  }
  const ultimateRoster = rosters.find((roster) => roster.domain === 'ultimates');
  if (ultimateRoster?.slug !== 'ultimates' || ultimateRoster?.title !== 'WHOMP Ultimate'
    || !ultimateRoster.entries.some((entry) => entry.id === 'whomp')) {
    violations.push('WHOMP Ultimate taxonomy or stable ultimates/#e-whomp route contract has drifted');
  }
  const enemyScaling = D.domains.enemies?.scaling;
  if (!['hpPer25s', 'damagePer30s', 'speedPer50s', 'xpPer120s'].every((field) => Number.isFinite(enemyScaling?.[field]) && enemyScaling[field] >= 0)) {
    violations.push('enemy scaling does not expose separate finite health, damage, speed and XP clocks');
  }
  const characterBaseStats = D.domains.characters?.runtime?.baseStats;
  const characterRuntimeShape = [
    ['maxHp', 'run-start-health-base', 'hp', ['permanentBonus', 'registry', 'runConsumer']],
    ['speed', 'character-speed-identity-input', 'relative-input', ['movementSink', 'reference', 'registry', 'runConsumer']],
    ['might', 'multiplicative-damage-identity-input', 'multiplier', ['registry', 'runConsumer', 'statSink']],
  ];
  if (characterRuntimeShape.some(([key, role, unit, provenanceKeys]) => {
    const contract = characterBaseStats?.[key];
    return contract?.role !== role || contract?.unit !== unit
      || typeof contract.semantics !== 'string' || !contract.semantics.trim()
      || JSON.stringify(Object.keys(contract.provenance || {}).sort()) !== JSON.stringify(provenanceKeys)
      || Object.values(contract.provenance || {}).some((source) => typeof source !== 'string' || !source.trim());
  }) || characterBaseStats?.speed?.reference !== 6) {
    violations.push('character runtime does not preserve the run-start health, relative-to-6 speed and multiplicative might input semantics');
  }
  const characterWeaponIdentity = D.domains.characters?.runtime?.weaponIdentity;
  const weaponIdentityText = Array.isArray(characterWeaponIdentity?.semantics)
    ? characterWeaponIdentity.semantics.join(' ').toLocaleLowerCase()
    : '';
  if (characterWeaponIdentity?.field !== 'startWeaponId'
    || characterWeaponIdentity?.role !== 'suggested-default-loadout-weapon'
    || characterWeaponIdentity?.standardSoloCampaignGrant !== 'none-core-only'
    || !/suggest/.test(weaponIdentityText) || !/aimed core only/.test(weaponIdentityText)
    || JSON.stringify(Object.keys(characterWeaponIdentity?.provenance || {}).sort())
      !== JSON.stringify(['botConsumer', 'coopConsumer', 'progressionConsumer', 'registry', 'soloConsumer'])
    || Object.values(characterWeaponIdentity.provenance).some((source) => typeof source !== 'string' || !source.trim())) {
    violations.push('character weapon identity does not prove a suggestion-only field and aimed-core-only standard solo campaign start');
  }
  for (const character of Object.values(D.domains.characters?.entries || {})) {
    if (D.domains.characters.refs?.[character.id]?.suggestedWeapon !== character.startWeaponId) {
      violations.push(`character ${character.id} suggested-weapon relation does not match its authored identity field`);
    }
  }
  const openingEnemyHp = D.domains.runModes?.openingEnemyHpBonus;
  if (openingEnemyHp?.field !== 'openingHpBonusPct' || openingEnemyHp?.owner !== 'enemy'
    || openingEnemyHp?.appliesTo !== 'spawn-director-ordinary-wave-health' || !Array.isArray(openingEnemyHp?.excludes)
    || openingEnemyHp.excludes.length === 0 || openingEnemyHp?.fade !== 'linear'
    || openingEnemyHp?.fadeClock !== 'mode-profiled-pace-seconds' || openingEnemyHp?.startsAtPaceSec !== 0
    || openingEnemyHp?.fadesToZeroAtPaceSec !== 180 || !Number.isFinite(openingEnemyHp?.unifiedProfileElapsedSec)
    || !openingEnemyHp.provenance || Object.values(openingEnemyHp.provenance).some((source) => typeof source !== 'string' || !source.trim())) {
    violations.push('run-mode opening enemy HP contract does not prove its ordinary-wave-only owner/exclusions, 0:00-to-3:00 pace-clock fade and unified real-play equivalent');
  }
  const encounterSchedule = D.world?.encounterSchedule;
  const encounterText = Array.isArray(encounterSchedule?.semantics) ? encounterSchedule.semantics.join(' ').toLocaleLowerCase() : '';
  if (!Number.isFinite(encounterSchedule?.automaticMinibossCadenceSec) || encounterSchedule.automaticMinibossCadenceSec <= 0
    || encounterSchedule?.cadenceClock !== 'mode-profiled-cadence-seconds'
    || !Number.isFinite(encounterSchedule?.unifiedProfilePreBankIntervalElapsedSec)
    || !Number.isFinite(encounterSchedule?.unifiedProfileEndlessIntervalElapsedSec)
    || !/cadence/.test(encounterText) || !/reserv/.test(encounterText)
    || !/(?:does not add an automatic|no auto(?:matic)?|exclude)/.test(encounterText)
    || !Array.isArray(encounterSchedule?.limits) || encounterSchedule.limits.length !== 1
    || !/identity/.test(encounterSchedule.limits[0].toLocaleLowerCase()) || !/actual spawn time/.test(encounterSchedule.limits[0].toLocaleLowerCase())
    || !encounterSchedule.provenance || Object.values(encounterSchedule.provenance).some((source) => typeof source !== 'string' || !source.trim())) {
    violations.push('world encounterSchedule does not prove limited cadence evidence, unified interval and signature-slot reservation semantics');
  }
  const shrineMovement = D.domains.shrineMovement;
  const shrineText = Array.isArray(shrineMovement?.runtime?.semantics) ? shrineMovement.runtime.semantics.join(' ').toLocaleLowerCase() : '';
  if (shrineMovement?.count !== 5 || shrineMovement?.runtime?.owner !== 'world-shrine'
    || shrineMovement?.runtime?.offerSlot !== 'movement' || shrineMovement?.runtime?.normalWorldShrineMovementSlots !== 1
    || shrineMovement?.runtime?.gate?.requiresWorldShrine !== true
    || shrineMovement?.runtime?.gate?.requiresNoLegendaryReplacement !== true
    || !/blessing trio/.test(shrineText) || !/legendary/.test(shrineText)
    || !/directive/.test(shrineText) || !/merchant/.test(shrineText)
    || !/extra jump/.test(shrineText) || !/legacy/.test(shrineText)
    || !shrineMovement.runtime.provenance || Object.values(shrineMovement.runtime.provenance).some((source) => typeof source !== 'string' || !source.trim())) {
    violations.push('shrine movement runtime does not prove the five-entry gated normal-world-shrine offering pool');
  }
  const jumpAliases = D.domains.jumpAugments;
  const linkedShrineIds = (jumpAliases?.order || []).map((id) => jumpAliases.refs?.[id]?.shrineMovementOffering);
  if (jumpAliases?.count !== 2 || linkedShrineIds.some((id) => !shrineMovement?.entries?.[id])
    || new Set(linkedShrineIds).size !== linkedShrineIds.length) {
    violations.push('legacy jump augment aliases do not map one-to-one onto two live Shrine movement offerings');
  }
  const aegis = D.domains.passives?.entries?.aegisTome;
  const aegisRefs = D.domains.passives?.refs?.aegisTome;
  const aegisUnlock = aegisRefs?.runtimeUnlock;
  const aegisAchievement = Object.values(D.domains.achievements?.entries || {}).some((row) => row.unlocks?.passive === 'aegisTome');
  if (!aegis || aegis.unlockedFromStart !== false || aegisAchievement || (aegisRefs?.unlockedByAchievements || []).length
    || aegisUnlock?.kind !== 'campaignSignatureBossMilestone' || aegisUnlock?.scope !== 'anyCampaignLevel'
    || aegisUnlock?.requiredMilestones !== 1 || aegisUnlock?.permanent !== true
    || aegisUnlock?.availability !== 'future-draft-pools' || typeof aegisUnlock?.description !== 'string' || !aegisUnlock.description.trim()
    || JSON.stringify(Object.keys(aegisUnlock?.provenance || {}).sort()) !== JSON.stringify(['activation', 'persistence', 'policy'])
    || Object.values(aegisUnlock?.provenance || {}).some((source) => typeof source !== 'string' || !source.trim())) {
    violations.push('Aegis Tome does not preserve its first campaign signature-boss runtime unlock without a fresh-save or achievement fallback');
  }
  for (const weapon of Object.values(D.domains.weapons?.entries || {})) {
    const refs = D.domains.weapons.refs?.[weapon.id] || {};
    const expectedAchievements = Object.values(D.domains.achievements.entries)
      .filter((row) => row.unlocks?.weapon === weapon.id).map((row) => row.id).sort();
    const expectedQuests = Object.values(D.domains.quests.entries)
      .filter((row) => row.reward?.weaponId === weapon.id).map((row) => row.id).sort();
    const expectedSuggestions = Object.values(D.domains.characters.entries)
      .filter((row) => row.startWeaponId === weapon.id).map((row) => row.id).sort();
    if (JSON.stringify([...(refs.unlockedByAchievements || [])].sort()) !== JSON.stringify(expectedAchievements)
      || JSON.stringify([...(refs.unlockedByQuests || [])].sort()) !== JSON.stringify(expectedQuests)
      || JSON.stringify([...(refs.suggestedByCharacters || [])].sort()) !== JSON.stringify(expectedSuggestions)) {
      violations.push(`weapon ${weapon.id} backlinks do not exactly compose achievement, quest and character-suggestion relations`);
    }
  }
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
    violations.push('root powerCeiling does not expose the four-dial schema-9 contract');
  }
  if (T) {
    const tierRoster = rosters.find((r) => r.slug === 'tiers');
    if (tierRoster?.entries.length !== T.coverage?.rows) violations.push(`tier route emits ${tierRoster?.entries.length || 0} rows, artifact declares ${T.coverage?.rows}`);
    const buildsRoster = rosters.find((r) => r.slug === 'builds');
    if (buildsRoster?.entries.length !== T.measuredBuilds?.pairs?.length) violations.push(`build route emits ${buildsRoster?.entries.length || 0} pairs, artifact declares ${T.measuredBuilds?.pairs?.length}`);
  }
  if (violations.length) throw new Error(`Wiki source contract failed (${violations.length}):\n  ${violations.join('\n  ')}`);
  const pages = [renderHub(rosters, ctx), renderExplainer(rosters, ctx), ...rosters.map((r) => renderRosterPage(r, ctx))];

  const searchEntries = [];
  searchEntries.push({ type: 'wiki', title: 'WHOMP wiki', text: `All ${D.coverage.domains} source catalogs and controlled-simulation evidence guides`, anchor: '', href: 'wiki.html' });
  searchEntries.push({
    type: 'wiki',
    title: EXPLAINER_TITLE,
    text: 'How the wiki is built, what stops the build, what is deliberately missing, and who wrote which words',
    anchor: '',
    href: EXPLAINER_FILE,
  });
  for (const r of rosters) {
    searchEntries.push({ type: 'wiki page', title: r.title, text: `${r.section} ${r.tagline} ${r.lede}`, anchor: '', href: `wiki-${r.slug}.html` });
    for (const e of r.entries) {
      searchEntries.push({
        type: r.domain ? SEARCH_TYPE[r.domain] : (r.sourceKind || 'wiki'),
        title: e.name,
        text: r.searchText(e),
        anchor: `e-${e.id}`,
        href: `wiki-${r.slug}.html#e-${e.id}`,
      });
    }
  }
  /* Two non-roster routes now: the hub and the explainer. Both are real pages a
     reader can land on, so both owe the search index exactly one entry. */
  const expectedSearchEntries = 2 + rosters.length + rosters.reduce((sum, roster) => sum + roster.entries.length, 0);
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

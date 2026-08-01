/** THE WHOMP WIKI, the derived half.
 *
 *  Every number on every page in here is READ OUT OF data/game-data.json, the
 *  game repo's shared data layer, at generate time. Nothing is typed by hand.
 *  That is not a style preference, it is the only version of a wiki that
 *  survives balance moving: a page that retypes a weapon's damage is a cache
 *  with no invalidation, and it is wrong the first time somebody tunes a number
 *  and does not think to come here.
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
 *    ENEMY SPEED.  The registry value is not the value the game runs. Basic and
 *          special kinds go through bandedEnemySpeed() in src/data/enemies.ts,
 *          which multiplies by up to 1.10 before the horde ever sees it, and
 *          that function is not in the data layer. Printing the raw field would
 *          publish a speed no player ever meets, so speed is absent and the page
 *          says so rather than quietly omitting it.
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
 *  ADDING A ROSTER (this is the extension point, use it):
 *    1. add an entry to rosterSpecs() below
 *    2. write its `card(e)`
 *    3. that is all
 *  The page chrome, the filter bar, the sort control, the comparison meters,
 *  the search entries, the hub card, the "not built yet" list on the hub and
 *  the generator's own cross-link check are all driven off that one object.
 *  bin/generate.mjs does not change and neither does either deploy script: the
 *  outputs are staged from the manifest the generator writes.
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
.wside{width:210px;flex:none;position:sticky;top:20px;display:flex;flex-direction:column;gap:2px}
.wside a{display:block;padding:9px 12px;border-radius:8px;color:var(--body);text-decoration:none;font-size:.92rem}
.wside a:hover{background:rgba(255,243,207,.05);color:var(--cream)}
.wside a.is-here{color:var(--cream);background:rgba(255,243,207,.06);font-weight:700}
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
.wsoon{display:flex;flex-wrap:wrap;gap:8px}
.wsoon span{padding:7px 14px;border-radius:999px;border:var(--edge);color:var(--dim);font-size:.8rem}
.wsoon span b{color:var(--body);font-weight:700;font-variant-numeric:tabular-nums}

@media (max-width:760px){
  .wshell{flex-direction:column;gap:18px}
  .wside{width:100%;position:static;flex-direction:row;overflow-x:auto;gap:6px}
  .wside a,.wside .stat{white-space:nowrap}
  .wside-h{display:none}
  .wgrid{grid-template-columns:1fr}
  .wfact-k,.wmeter-k{width:84px}
}
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
export function rosterSpecs(D, esc) {
  const W = D.domains.weapons;
  const C = D.domains.coreWeapons;
  const E = D.domains.enemies;
  const L = D.domains.levels;
  const P = D.domains.passives;
  const CH = D.domains.characters;
  const EX = D.domains.expeditions;
  const A = D.domains.achievements;

  const levelName = (id) => L.entries[id]?.name || EX.entries[id]?.name || humanize(id);
  const charName = (id) => CH.entries[id]?.name || humanize(id);
  const passiveName = (id) => P.entries[id]?.name || humanize(id);
  const weaponName = (id) => W.entries[id]?.name || humanize(id);
  const coreName = (id) => C.entries[id]?.name || humanize(id);
  const enemyName = (id) => E.entries[id]?.name || humanize(id);

  const maxOf = (entries, of) => entries.reduce((m, e) => Math.max(m, Number(of(e)) || 0), 0);

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
      return `Take ${cardLink('weapons', r.evolvesFrom, esc(weaponName(r.evolvesFrom)))} to level <b>${base?.maxLevel ?? '?'}</b>${tome ? ` while holding the <b>${esc(passiveName(tome))}</b>` : ''}, then open a boss chest.`;
    }
    const starts = r.startingCharacters?.length
      ? `${esc(list(r.startingCharacters.map(charName)))} start${r.startingCharacters.length === 1 ? 's' : ''} with it. `
      : '';
    if (e.unlockedFromStart) return `${starts}In the level-up pool from the first run.`;
    const ach = unlockedBy.get(e.id) || [];
    if (ach.length) {
      return `${starts}Unlocked by ${esc(list(ach.map((a) => a.name)))}${ach.length === 1 ? ` (${esc(ach[0].desc)})` : ''}, then it joins the level-up pool.`;
    }
    return starts || '';
  };

  const weaponsRoster = {
    slug: 'weapons',
    domain: 'weapons',
    title: 'Weapons',
    tagline: 'The half of your build that fires itself.',
    lede: 'Weapons fire on their own. You are offered them as you level, you level them up, and eight of them turn into something else entirely if you are holding the right tome when a boss chest opens. The weapon you aim by hand is the core weapon, and it has its own page.',
    omissions: 'There is no damage-per-second column here, and that is deliberate. The game does not compute one: your might and crit multiply the damage, your attack speed divides the interval, and half of these do not have "damage times shots per second" semantics in the first place. A beam ramps the longer it holds, chain jumps land a flat share of the first hit, the shotgun pays more up close. A single number would be wrong on most of these cards, so the page gives you the base figures and the growth rule and lets you compare like with like. <b>Element is a look, not a rule</b>: it picks the effect tint and nothing in the game reads it for damage, resistance or status.',
    entries: weaponEntries,
    groups: [
      {
        key: 'base',
        title: 'Base weapons',
        note: 'What the level-up offer draws from, plus the ones a character brings with them. Ten are available on a fresh save; the rest are behind an achievement, and each card says which.',
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
          ${r.evolvesInto ? fact('Becomes', `${cardLink('weapons', r.evolvesInto, esc(weaponName(r.evolvesInto)))}${evoByBase.get(e.id)?.passiveId ? `, once you hold the <b>${esc(passiveName(evoByBase.get(e.id).passiveId))}</b> and open a boss chest` : ''}`) : ''}
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
  const coreEntries = (C.cradleOrder || C.order).map((id) => C.entries[id]).filter(Boolean);
  const coresRoster = {
    slug: 'cores',
    domain: 'coreWeapons',
    title: 'Core weapons',
    tagline: 'The one you aim yourself.',
    lede: 'A core weapon is the weapon under your hand, and picking one is the only decision that shapes a whole run before it starts. All eight are available on a fresh save, you take exactly one, and the draft can never offer you another. Every core is built around one specific thing it wants you to be good at. That word is the game’s own, and it is on every card.',
    omissions: 'No damage figures on this page, on purpose. Every clip size, reload, cooldown and damage multiplier for these eight lives as a private constant inside the combat code and is not published in the data these pages read from, so the wiki genuinely does not know them and will not guess. What it does know is the shape of each core: where its damage is anchored, what rhythm it imposes, and what it is asking you to be good at. <b>The pip count is the exception</b> and only because the test suite pins it against the real clip size.',
    entries: coreEntries,
    groups: [{ key: 'all', title: 'The cradle', note: 'In the order the cradle presents them. This is display order, not a ladder: none of them are locked and none of them are later.', has: () => true }],
    facets: [
      { key: 'cadence', label: 'Rhythm', of: (e) => e.cadence },
      { key: 'feel', label: 'Asks you for', of: (e) => e.feel },
      { key: 'meter', label: 'Meter', of: (e) => e.meter },
    ],
    sorts: [
      { key: 'roster', label: 'Cradle order', of: (e) => coreEntries.indexOf(e) },
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
        </div>`;
    },
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
  };

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
          ? list(['every campaign level', ...rest.map((l) => esc(levelName(l)))])
          : list(levels.sort((a, b) => levelRank(a) - levelRank(b)).map((l) => esc(levelName(l))));
        return `${names}${when}`;
      })
      .join('; ');
  };

  const enemyBoss = (e) => {
    const boss = (E.refs[e.id] || {}).bossIn || [];
    if (!boss.length) return '';
    const byTime = new Map();
    for (const b of boss) {
      if (!byTime.has(b.atSec)) byTime.set(b.atSec, new Set());
      byTime.get(b.atSec).add(levelName(b.levelId));
    }
    return [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([at, levels]) => {
        const play = playClock(at);
        return `<b>${play ? play : `${at} on the pace clock`}</b> into ${esc(list([...levels]))}`;
      })
      .join('; ');
  };

  const bestiaryRoster = {
    slug: 'bestiary',
    domain: 'enemies',
    title: 'Bestiary',
    tagline: 'Everything that wants to touch you.',
    lede: 'Every kind in the game, what it does, and where it turns up. Health, contact damage and XP are the values a kind starts a run with, before elapsed time, the level’s own multipliers and the opening grace period all scale them up, so read them against each other rather than as what you will meet at minute twelve.',
    omissions: `<b>Every time on this page is minutes of real play.</b> ${clockNote} <b>Speed is missing on purpose</b>: the registry carries a speed for every kind, but basic and special kinds are re-banded before the game ever uses that number, and the banding is not in the data these pages read. Publishing the raw field would be publishing a speed nobody ever meets, so it is left out and said out loud instead. <b>Boss and miniboss health and damage are missing for the same reason</b>: the boss director replaces them at spawn from its own table, so the registry values for those two tiers are documentation rather than what you actually fight.`,
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
      { key: 'hp', label: 'Health', of: (e) => e.hp, desc: true },
      { key: 'damage', label: 'Contact damage', of: (e) => e.damage, desc: true },
      { key: 'xp', label: 'XP', of: (e) => e.xp, desc: true },
    ],
    searchText: (e) => `${e.tier} ${e.behavior} enemy monster`,
    card: (e) => {
      const r = E.refs[e.id] || {};
      const where = enemyWhere(e);
      const boss = enemyBoss(e);
      const showStats = statTiers.has(e.tier);
      const showBehaviour = showStats && BEHAVIOR_NOTE[e.behavior];
      return `
        <div class="wtags">
          ${tag(esc(humanize(e.tier)), e.tier === 'boss' ? 'pink' : e.tier === 'miniboss' ? 'gold' : e.tier === 'special' ? 'violet' : '')}
          ${tag(esc(humanize(e.behavior)), 'cyan')}
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
          ${!showStats ? fact('Numbers', 'Set by the boss director at spawn, not by the roster.') : ''}
        </div>
        ${showStats ? `<div class="wmeters">
          ${meter('Health', e.hp, eMax.hp)}
          ${meter('Contact', e.damage, eMax.damage)}
          ${meter('XP', e.xp, eMax.xp)}
        </div>` : ''}`;
    },
  };

  return [weaponsRoster, coresRoster, bestiaryRoster];
}

// ================================================================ page shell
const groupOf = (roster, e) => roster.groups.find((g) => g.has(e)) || roster.groups[roster.groups.length - 1];

function facetValues(roster, facet) {
  const seen = new Map();
  for (const e of roster.entries) {
    const v = facet.of(e);
    if (v === undefined || v === null || v === '') continue;
    seen.set(v, (seen.get(v) || 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

const datasetKey = (k) => `s${k.charAt(0).toUpperCase()}${k.slice(1)}`;

function renderRosterPage(roster, ctx) {
  const { esc, chrome, D } = ctx;
  const noted = D.domains[roster.domain].noted || 0;
  const total = roster.entries.length;

  const facetBar = roster.facets.map((f) => {
    const values = facetValues(roster, f);
    if (values.length < 2) return '';
    const label = f.name || humanize;
    return `
      <div class="wfacet">
        <span class="wfacet-h">${esc(f.label)}</span>
        <div class="wfacet-row" data-facet="${esc(f.key)}">
          <button class="wf is-active" type="button" data-value="all">All</button>
          ${values.map(([v, n]) => `<button class="wf" type="button" data-value="${esc(v)}">${esc(label(v))} <span style="opacity:.5">${n}</span></button>`).join('')}
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
      const facetAttrs = roster.facets.map((f) => `data-${f.key}="${esc(String(f.of(e) ?? ''))}"`).join(' ');
      const sortAttrs = roster.sorts.map((s) => {
        const raw = s.of(e);
        return `data-${datasetKey(s.key).replace(/([A-Z])/g, '-$1').toLowerCase()}="${esc(String(s.text ? String(raw).toLowerCase() : (Number(raw) || 0)))}"`;
      }).join(' ');
      const accent = roster.accent ? roster.accent(e) : null;
      const note = (D.domains[roster.domain].notes || {})[e.id];
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
      ${chrome.wordmark(48, `w${roster.slug}`)}
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
    <div class="stat">${total} entries, read straight out of the game</div>
  </nav>
  <main class="wmain">
    <div class="rule"></div>
    <h2 class="chroma">${esc(roster.title)}</h2>
    <p class="lede">${esc(roster.lede)}</p>

    <p class="wprov">Every value on this page is read out of the game’s own registries at build time, from
      <b>main@${esc(chrome.headSha)}</b>. Nothing here is retyped by hand, so it cannot fall behind a balance
      change. Bars compare an entry against the largest value in <b>this roster</b>, never an absolute ceiling,
      and the real number is always printed beside the bar.
      ${noted === 0
    ? `Written flavour notes are the director’s to write and <b>0 of ${total}</b> exist so far, so these cards are mechanics only.`
    : `<b>${noted} of ${total}</b> carry a written note.`}</p>

    ${roster.omissions ? `<p class="womit">${roster.omissions}</p>` : ''}

    <div class="wbar">${facetBar}${sortBar}</div>
    <p class="wcount" id="wcount"></p>

    ${groupsHtml}
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(chrome.buildStamp)} from <code>main@${esc(chrome.headSha)}</code>,
  content derived from <code>data/game-data.json</code>.
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
    row.querySelectorAll('.wf').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    active[facet] = btn.dataset.value;
    apply();
  }));
});
function apply() {
  let shown = 0;
  for (const c of cards) {
    const ok = Object.entries(active).every(([k, v]) => v === 'all' || c.dataset[k] === v);
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
}
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
        row.querySelectorAll('.wf').forEach((b) => b.classList.toggle('is-active', b.dataset.value === 'all'));
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
  const { esc, chrome, D } = ctx;
  const built = new Set(rosters.map((r) => r.domain));
  /* THE ROADMAP IS DERIVED TOO. Every domain in the data layer with no page yet,
     with its live entry count, so the hub says what is missing without anybody
     maintaining a list of what is missing. It shrinks by itself as pages land. */
  const notYet = D.domainOrder
    .filter((d) => !built.has(d) && (D.domains[d]?.count || 0) > 0)
    .map((d) => ({ key: d, n: D.domains[d].count }));

  const body = `
<div class="wtopbar">
  ${chrome.AUTHBAR}
  <div class="wtopbar-row">
    <a class="brand" href="index.html">
      ${chrome.wordmark(48, 'whub')}
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
    <p class="lede">Everything in the game, as the game itself defines it.</p>

    <p class="wprov">This wiki is <b>generated</b>. Every damage figure, spawn time, level name and relation on
      these pages is read out of the registries the game actually runs on, at build time, from
      <b>main@${esc(chrome.headSha)}</b>. Nobody retypes a number here, which is why nothing on these pages can
      quietly fall out of date the next time balance moves. <b>${D.coverage.entries}</b> entries across
      <b>${D.coverage.domains}</b> registries are indexed; the rosters below are the ones with pages so far.</p>

    <p class="womit">Where the game has no answer, these pages say so instead of guessing. Several numbers that a
      normal wiki would print are deliberately absent, and each roster explains which ones and why at the top of
      its own page. A missing column here means the value the game runs on is not the value the registry
      carries, so printing it would be a confident lie rather than a gap.</p>

    <div class="whub">
      ${rosters.map((r) => `
      <a class="whubcard" href="wiki-${esc(r.slug)}.html">
        <span class="n">${r.entries.length} entries</span>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.tagline)}</p>
      </a>`).join('')}
    </div>

    <section style="margin-top:44px">
      <div class="rule"></div>
      <h2 class="chroma" style="font-size:1.3rem">Not built yet</h2>
      <p class="lede">These registries are already indexed and pinned against the game, they just do not have a
        page. The counts are live, so this list shrinks by itself.</p>
      <div class="wsoon">
        ${notYet.map((d) => `<span>${esc(humanize(d.key))} <b>${d.n}</b></span>`).join('')}
      </div>
    </section>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(chrome.buildStamp)} from <code>main@${esc(chrome.headSha)}</code>,
  content derived from <code>data/game-data.json</code>.
  <a href="log.html#views">Dev log</a>
</footer>`;

  return {
    file: 'wiki.html',
    html: ctx.page({
      title: 'WHOMP wiki',
      description: 'The WHOMP wiki: weapons, core weapons and the bestiary, every value generated from the game’s own data.',
      body,
      script: chrome.SEARCH_SCRIPT(''),
    }),
  };
}

// ================================================================ entry point
export function buildWiki(ctx) {
  const { D } = ctx;
  const rosters = rosterSpecs(D, ctx.esc);
  const pages = [renderHub(rosters, ctx), ...rosters.map((r) => renderRosterPage(r, ctx))];

  const TYPE = { enemies: 'enemy', coreWeapons: 'core weapon', weapons: 'weapon' };
  const searchEntries = [];
  for (const r of rosters) {
    for (const e of r.entries) {
      searchEntries.push({
        type: TYPE[r.domain] || r.domain,
        title: e.name,
        text: r.searchText(e),
        anchor: `e-${e.id}`,
        href: `wiki-${r.slug}.html#e-${e.id}`,
      });
    }
  }

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

/** THE LANDING PAGE'S OWN DERIVATIONS, split out so they can be tested.
 *
 *  bin/generate.mjs is a script: importing it runs it, verifies three game
 *  artifacts, and writes forty files. Nothing in it can be unit tested. Every
 *  rule below is a rule about TEXT, and text rules are exactly the ones that rot
 *  quietly, so they live here beside bin/patch-notes.mjs and bin/live-version.mjs
 *  as pure functions with a suite of their own.
 *
 *  WHAT ROTTED, AND WHY THESE FUNCTIONS EXIST. Measured on the page as generated
 *  at game@bc134616 and read on 2026-08-06:
 *
 *    A3 - Wed 7/30      a date a week in the past, printed as a schedule
 *    A4 - Thu 7/31      the same
 *    A6 - Fri+          a weekday with no year, no anchor and no meaning
 *    A8 - next week     a relative date on a static page, so it is always wrong
 *    A6 ended with      "zone-gated new characters (7 themed),"
 *    A9 ended with      "dev tools graduate to player features. Photo mode +"
 *
 *  The last two were not authoring mistakes. docs/CAMPAIGN.md wraps long arc
 *  lines at a readable width and the old regex matched a single line, so the
 *  continuation was dropped and the sentence ended on a comma. docs/VOICE.md
 *  rule 9 forbids trailing off outright, and the page had been doing it since the
 *  arc was written.
 *
 *  THE SPLIT OF RESPONSIBILITY. This module fixes what the SITE owns: folding the
 *  wrapped line back together, refusing a sentence that trails off, and never
 *  printing a schedule that has already happened. It does not rewrite the game's
 *  roadmap prose, because that is the game repo's copy and a site that edits it
 *  is a second source of truth by another name. What it cannot fix it REPORTS,
 *  and bin/regenerate-and-verify.sh turns those reports into a failed gate.
 */

/* ------------------------------------------------------------------ the clock */

/** Local-clock YYYY-MM-DD. Local, not toISOString(), for the same reason the
 *  feed window is reckoned locally in bin/generate.mjs: a UTC boundary is a
 *  different day for most of the evening in this timezone, and "is this date in
 *  the past" is a question that has to be asked in one clock or the other. */
export function localDay(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/** Weekday names, whole or abbreviated. A weekday printed on a static page names
 *  one of the last seven days or one of the next seven and gives a reader no way
 *  to tell which, so it is treated as expired the moment it is generated rather
 *  than seven days later. */
const WEEKDAY = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(day|nesday|rsday|urday|day)?\b/i;

/** Relative anchors with nothing to anchor to. "next week" was true on the day
 *  it was written and has been false ever since. */
const UNANCHORED = /\b(today|tomorrow|yesterday|tonight|this week|next week|last week|this month|next month|end of week|eow|soon)\b/i;

/** M/D or M/D/YY(YY). The year is optional in docs/CAMPAIGN.md and absent in
 *  every instance it has ever carried, so an absent year resolves to the year
 *  that puts the date nearest the reference day: 12/28 read on 2026-01-02 means
 *  the December just gone, not the one eleven months out. */
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const MONTH_DAY = new RegExp(`\\b(${MONTHS.join('|')})\\.?\\s+(\\d{1,2})\\b`, 'i');

const dayNumber = (year, month, day) => Date.UTC(year, month - 1, day);

/** Resolves whatever calendar date `text` carries into a comparable day number,
 *  or null when it carries none. Reference day decides the century and, for a
 *  bare M/D, the year. */
export function resolveDate(text, referenceDay) {
  const [refY, refM, refD] = referenceDay.split('-').map(Number);
  const reference = dayNumber(refY, refM, refD);

  const iso = ISO_DATE.exec(text);
  if (iso) return dayNumber(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = MONTH_DAY.exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase()) + 1;
    return nearestYear(month, Number(named[2]), refY, reference);
  }

  const numeric = NUMERIC_DATE.exec(text);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (numeric[3]) {
      const raw = Number(numeric[3]);
      return dayNumber(raw < 100 ? 2000 + raw : raw, month, day);
    }
    return nearestYear(month, day, refY, reference);
  }
  return null;
}

function nearestYear(month, day, referenceYear, reference) {
  let best = null;
  for (const year of [referenceYear - 1, referenceYear, referenceYear + 1]) {
    const candidate = dayNumber(year, month, day);
    if (best === null || Math.abs(candidate - reference) < Math.abs(best - reference)) best = candidate;
  }
  return best;
}

/** True when this fragment names a schedule a reader can no longer act on: a
 *  calendar date that has passed, a bare weekday, or a relative anchor. */
export function isExpiredSchedule(text, referenceDay = localDay()) {
  if (!text) return false;
  if (UNANCHORED.test(text)) return true;
  if (WEEKDAY.test(text)) return true;
  const resolved = resolveDate(text, referenceDay);
  if (resolved === null) return false;
  const [y, m, d] = referenceDay.split('-').map(Number);
  return resolved < dayNumber(y, m, d);
}

/* ---------------------------------------------------------------- the sentence */

/** docs/VOICE.md rule 9: every line is a finished sentence with terminal
 *  punctuation, no trailing off. House law bans the exclamation mark, so a
 *  finished sentence here ends in a full stop or a question mark. */
export function trailsOff(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return true;
  return !/[.?]$/.test(trimmed);
}

/** A landing page never prints the name of a file in the repo it was built from
 *  (docs/VOICE.md rule 12). docs/CAMPAIGN.md ends one arc by citing the design
 *  doc it is tracked in, which is correct in the roadmap and machinery on a page
 *  a stranger reads. The trailing citation is removed and the sentence is closed;
 *  an arrow between two stages becomes the word it was standing in for. */
export function withoutSourceRefs(text) {
  const original = String(text).trim();
  const stripped = original
    .replace(/\s*[,;]?\s*\b(?:per|see|in)\s+[A-Za-z0-9_./-]+\.(?:md|ts|mjs|json)\b\.?/gi, '')
    .replace(/\s*-+>\s*/g, ' to ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim();
  /* The citation is usually the last clause, so removing it takes the full stop
   * with it and turns a finished sentence into one that trails off, which is the
   * defect one line up from here. A sentence that ENDED before is still ended
   * after; one that never ended is left alone so renderableArcs can refuse it. */
  return stripped && /[.?]$/.test(original) ? finished(stripped) : stripped;
}

const finished = (text) => (/[.?]$/.test(text) ? text : `${text}.`);

/** docs/CAMPAIGN.md continues the arc title into its description, so half the
 *  descriptions begin in lower case ("own campaign. Every ratified visual beat
 *  gets its sound twin."). That reads as a fragment on a page where the title is
 *  a heading above it rather than the first half of the sentence. Capitalising
 *  the first letter is typography, not rewriting: no word changes and no claim
 *  moves, which is the line this module does not cross. */
export function openingCapital(text) {
  const trimmed = String(text).trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

/* -------------------------------------------------------------------- the arcs */

/** THE FOLD IS THE FIX. docs/CAMPAIGN.md wraps an arc across lines when it runs
 *  long, so a per-line match reads half of A6 and half of A9 and ends both on
 *  punctuation the author never intended as an ending. Continuation lines are
 *  folded onto the arc above them before anything is matched, which is why the
 *  truncation cannot come back by someone rewrapping the file. */
export function parseArcs(campaignSource) {
  const block = String(campaignSource).split(/^## ARCS$/m)[1]?.split(/^## /m)[0] ?? '';
  const folded = [];
  for (const line of block.split('\n')) {
    if (/^\s*-\s+A\d+\b/.test(line)) folded.push(line.trim());
    else if (folded.length && line.trim() && !/^#/.test(line)) folded[folded.length - 1] += ` ${line.trim()}`;
  }
  return folded
    .map((line) => line.match(/^-\s+(A\d+)\s+([^:(]+?)(?:\s*\(([^)]+)\))?:\s*(.+)$/))
    .filter(Boolean)
    .map((m) => ({ id: m[1], name: m[2].trim(), when: (m[3] || '').trim(), what: m[4].trim() }));
}

/** Splits an arc's schedule note into parts and keeps only the ones that still
 *  mean something. "next week, 0.7" keeps the version and drops the week; "Wed
 *  7/30" keeps nothing at all. Dropping the expired part rather than the whole
 *  note is what stops A8 losing the only durable fact it carries. */
export function liveSchedule(when, referenceDay = localDay()) {
  const kept = String(when || '')
    .split(/\s*[,;]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isExpiredSchedule(part, referenceDay));
  return kept.join(', ');
}

/**
 * Turns parsed arcs into what the page may print.
 *
 * WHY A DROP AND NOT A THROW. Every other refusal in this generator stops the
 * build, and that is right when the thing being refused is a dead link or a
 * stale artifact: the whole site is wrong until it is fixed. An arc whose
 * sentence trails off is one card on one section of one page, and the blast
 * radius of refusing is the wiki, the dev log and both play buttons going dark
 * over a comma in a roadmap this repo is not allowed to edit. So the arc is
 * dropped, the reason is returned, and bin/regenerate-and-verify.sh fails the
 * GATE on a non-empty `dropped`. The deploy survives; the lane does not.
 */
export function renderableArcs(arcs, referenceDay = localDay()) {
  const cards = [];
  const dropped = [];
  const expiredBody = [];
  for (const arc of arcs) {
    const what = openingCapital(withoutSourceRefs(arc.what));
    if (trailsOff(what)) {
      dropped.push({ id: arc.id, name: arc.name, reason: `its description trails off: "${what}"` });
      continue;
    }
    if (isExpiredSchedule(what, referenceDay)) {
      expiredBody.push({ id: arc.id, name: arc.name, what });
    }
    cards.push({ id: arc.id, name: arc.name, when: liveSchedule(arc.when, referenceDay), what });
  }
  return { cards, dropped, expiredBody };
}

/* --------------------------------------------------------------- the pipeline */

/**
 * WHAT IS COMING, WITHOUT INVENTING IT.
 *
 * docs/train/WISHLIST.md is the game repo's own queue of wants: one row per
 * brief, each row linking the brief it was filed as. The rows are the derived
 * half, and they are what makes this section retire itself, which is the only
 * half that actually matters. A teaser for work that already shipped is worse
 * than no teaser, and the row leaving the wishlist is the event that removes it
 * here with nobody remembering to.
 *
 * The authored half is one line per want, written in the game's voice against
 * docs/VOICE.md, and it is authored for the same reason parseBacklogTeasers
 * above it is: the row titles are lane names ("QUEUED W1 - PORT CORE WEAPON
 * FUNCTIONALITY TO EVERY MODE"), some of them are defect reports rather than
 * features, and a page that publishes those has published an engineering
 * backlog to strangers. A want with no line is SKIPPED and counted, never
 * guessed at, exactly as an unrecognised backlog category is.
 */
export const PIPELINE_TEASERS = {
  'W2-tutorial-build.md': {
    title: 'A first room that teaches',
    line: 'The verbs get taught by making you use them. Nothing stops to explain the jump.',
  },
  'VISUAL-snow-roster.md': {
    title: 'Enemies that belong in the snow',
    line: 'The snow worlds still spawn desert enemies. They get a roster of their own, and their bosses after that.',
  },
  'W1-five-weapons-design-session.md': {
    title: 'Five more weapons, and earth',
    line: 'Both pickers have empty rows in them. Five weapons go in, and earth arrives as an element.',
  },
  'W1-core-weapon-arc.md': {
    title: 'The aimed weapon grows up',
    line: 'The one weapon you aim gets upgrades as it levels. There is an evolution waiting at the end of them.',
  },
  'W1-mouse-look-verbs-and-melee.md': {
    title: 'A melee verb',
    line: 'Mouse look opened a slot the keyboard never had. Something heavy goes in it.',
  },
  'W1-remaining-menu-glowups.md': {
    title: 'The last two menus get their coat',
    line: 'The tailor and the upgrade shop never got the pass every other screen got. They get it.',
  },
};

/** Reads the wishlist table and returns one entry per row: the brief file it
 *  links, and the row's own title with the lane machinery taken off the front. */
export function parseWishlistWants(wishlistSource) {
  const wants = [];
  for (const line of String(wishlistSource).split('\n')) {
    if (!/^\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (/^-+$/.test(cells[0]) || /^want$/i.test(cells[0])) continue;
    const link = /\(wishlist\/([A-Za-z0-9._-]+\.md)\)/.exec(cells[2]);
    if (!link) continue;
    wants.push({ file: link[1], title: cells[0] });
  }
  return wants;
}

/**
 * Joins the derived rows to the authored lines.
 *
 * Both directions are reported, because both are how this section goes wrong.
 * `unwritten` is a want nobody has written a line for yet, so the page is
 * quieter than the queue. `orphaned` is a line whose want has left the wishlist,
 * which means the page is claiming something is coming that is not, and that is
 * the one this section exists to make impossible.
 */
export function buildPipelineTeasers(wishlistSource, teasers = PIPELINE_TEASERS) {
  const wants = parseWishlistWants(wishlistSource);
  if (wants.length === 0) {
    throw new Error('docs/train/WISHLIST.md parsed to zero wants. The queue table moved or its shape changed; fix parseWishlistWants rather than publishing a landing page that says nothing is coming.');
  }
  const listed = new Set(wants.map((w) => w.file));
  const cards = [];
  const unwritten = [];
  for (const want of wants) {
    const teaser = teasers[want.file];
    if (!teaser) { unwritten.push(want.file); continue; }
    cards.push({ file: want.file, title: teaser.title, line: finished(teaser.line) });
  }
  const orphaned = Object.keys(teasers).filter((file) => !listed.has(file));
  return { cards, unwritten, orphaned, queued: wants.length };
}

/* ------------------------------------------------------------- what a run is */

const MINUTES = (seconds) => {
  const whole = Math.round(seconds / 60);
  return whole;
};
const CLOCK = (seconds) => {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * THE RUN'S SHAPE, READ OUT OF THE GAME RATHER THAN OFF A DESIGN DOC.
 *
 * docs/GAME_SPEC.md still describes a 28-minute Classic run. The registry the
 * game actually plays on does not: runModes classic banks at 1200 elapsed
 * seconds, which is twenty minutes, and the wiki has been publishing 20:00 and
 * 18:00 from that same artifact for weeks. A landing page that quoted the spec
 * would have shipped a number eight minutes wrong next to a wiki page carrying
 * the right one, which is the whole reason this repo derives instead of quoting.
 *
 * LOUD ON MISSING, same law as everything else here: a moved field stops the
 * build rather than rendering a run with no length.
 */
export function runShape(gameData) {
  const classic = gameData?.domains?.runModes?.entries?.classic;
  if (!classic) {
    throw new Error('data/game-data.json has no runModes entry for "classic". The landing page states the length of a run from that profile and will not guess it.');
  }
  const need = (field) => {
    const value = classic[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`runModes.classic.${field} is not a positive number. The landing page derives the run clock from it and refuses to publish an invented one.`);
    }
    return value;
  };
  const paceScale = need('paceScale');
  const bankSec = need('bankAtElapsedSec');
  const finalHordeSec = need('finalHordeAtPaceSec') / paceScale;
  const holdSec = need('clearHoldPaceSec') / paceScale;
  if (Math.abs(finalHordeSec + holdSec - bankSec) > 1) {
    throw new Error(`The run clock does not close: the final horde at ${CLOCK(finalHordeSec)} plus a ${CLOCK(holdSec)} hold does not reach the bank at ${CLOCK(bankSec)}. Read the mode profile before publishing a sentence about it.`);
  }
  const count = (domain) => {
    const value = gameData?.domains?.[domain]?.count;
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`data/game-data.json has no positive count for domain "${domain}". The landing page will not print a roster size it did not read.`);
    }
    return value;
  };
  return {
    minutes: MINUTES(bankSec),
    bank: CLOCK(bankSec),
    finalHorde: CLOCK(finalHordeSec),
    holdMinutes: MINUTES(holdSec),
    endless: classic.offersVictoryChoice === true,
    weapons: count('weapons'),
    cores: count('coreWeapons'),
    characters: count('characters'),
    enemies: count('enemies'),
    worlds: count('levels'),
    tomes: count('passives'),
  };
}

/* --------------------------------------------------------------- what you carry */

/**
 * THE SLOT COUNTS LIVE IN THE GAME'S CODE, NOT IN ITS DATA LAYER.
 *
 * data/game-data.json carries every registry the game plays on, so the size of
 * every roster is already derived. The size of a BUILD is not in it: how many
 * weapons and tomes you may hold at once, and how many upgrades a level up puts
 * in front of you, are constants in src/sim/progression.ts and appear in no
 * domain. The site reads them the same way it reads the play buttons out of
 * src/core/releaseChannel.ts, because the alternative is typing "four" into a
 * sentence and finding out it moved when a player counts the slots.
 *
 * LOUD ON MISSING, so a renamed constant stops the build instead of quietly
 * publishing the last number anybody typed.
 */
export function parseBuildSlots(source) {
  const text = String(source);
  const read = (name) => {
    const found = new RegExp(`export const ${name}\\s*=\\s*(\\d+)`).exec(text);
    if (!found) {
      throw new Error(`whomp/src/sim/progression.ts did not yield ${name}. The kit section states how big a build is and will not hand-type a slot count.`);
    }
    const value = Number(found[1]);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} read as ${found[1]}, which is not a build. The kit section refuses to publish an invented slot count.`);
    }
    return value;
  };
  return { weapons: read('WEAPON_SLOTS'), tomes: read('PASSIVE_SLOTS'), offer: read('OFFER_SIZE') };
}

/**
 * WHAT A PLAYER ACTUALLY WALKS IN HOLDING.
 *
 * Five things, and the page says so as five cards. Every number in them comes
 * from here: the roster sizes off the domain counts, the slot sizes off
 * parseBuildSlots, the WHOMP's cooldown off the ultimate registry. Nothing in
 * the authored copy above it may type a figure of its own.
 *
 * THREE REFUSALS, and each one is a sentence the page would otherwise get
 * wrong. A second ultimate means "the button the game is named after" is no
 * longer one button, and a card that names one is a lie the moment the registry
 * grows. A character with no innate or no signature means "each one cheats
 * differently" is describing somebody else's roster. A cooldown that is not a
 * positive number means the page has nothing to say about when the WHOMP comes
 * back, and saying it anyway is the failure this whole module exists to stop.
 */
export function kitShape(gameData, slots) {
  const count = (domain) => {
    const value = gameData?.domains?.[domain]?.count;
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`data/game-data.json has no positive count for domain "${domain}". The kit section will not print a roster size it did not read.`);
    }
    return value;
  };

  const ultimates = gameData?.domains?.ultimates;
  const held = Object.values(ultimates?.entries || {});
  if (held.length !== 1) {
    throw new Error(`data/game-data.json holds ${held.length} ultimates. The kit card calls the WHOMP the one button the game is named after, and that sentence is only true while there is exactly one. Rewrite the card before the roster grows.`);
  }
  const [whomp] = held;
  if (typeof whomp.cooldownMs !== 'number' || !(whomp.cooldownMs > 0)) {
    throw new Error('The held ultimate has no positive cooldown. The kit card says how often the WHOMP comes back and refuses to guess at it.');
  }
  const slot = ultimates?.runtime?.slot;
  if (!slot) {
    throw new Error('The ultimate registry names no input slot. The kit card tells a reader which key the WHOMP is on and will not invent one.');
  }
  const availability = ultimates?.runtime?.availability || {};

  const characters = Object.values(gameData?.domains?.characters?.entries || {});
  const bare = characters.filter((c) => !c.innateId || !c.signatureId).map((c) => c.id);
  if (bare.length) {
    throw new Error(`These characters carry no innate or no signature: ${bare.join(', ')}. The kit card says every one of them cheats differently, so it stops rather than overstating the roster.`);
  }

  return {
    cores: count('coreWeapons'),
    weapons: count('weapons'),
    relics: count('relics'),
    weaponSlots: slots.weapons,
    tomes: count('passives'),
    tomeSlots: slots.tomes,
    evolutions: count('evolutions'),
    characters: count('characters'),
    offer: slots.offer,
    whomp: {
      slot,
      seconds: Math.round(whomp.cooldownMs / 1000),
      armedFromStart: availability.fromRunStart === true && availability.requiresBossKill !== true,
    },
  };
}

/**
 * THE SIX CARDS, IN THE GAME'S OWN OFFER LANGUAGE.
 *
 * src/ui/offerCard.ts is the one card anatomy every in-run offer rides: a meta
 * row of two small labels, a title, the line under it, and a footer that says
 * what changes. A reader who has played the game has read that card a hundred
 * times, so the landing page hands them the same shape rather than a fourth
 * kind of box invented here.
 *
 * The numbers are `kit`. The words are authored against docs/VOICE.md, and the
 * only reason they are authored at all is the reason PIPELINE_TEASERS is: a
 * generated sentence about a roster reads like a field name, and this section
 * is the first thing a stranger learns about what they would be holding.
 *
 * THE SIXTH CARD IS THE RELICS (director, 2026-08-25: "another card here as well
 * to make it present as an even 6"). Five cards land three and two, and the hole
 * in the second row was the visible half of a hole in the section: the five
 * covered every build pillar the DRAFT hands you and left out the one the MAP
 * does. A stranger read the whole of what they would be holding and was never
 * told that a third of it is found rather than chosen.
 *
 * It goes last because that is when a run gives it to you, and it is the only
 * card whose kicker says what it is NOT: everything above it arrives at the door
 * or at a level up, and this one arrives out of a chest or a machine. Its body
 * is deliberately not the tomes card's sentence about being worth more than a
 * weapon said twice; two cards that end on the same sentence are one card.
 *
 * SIX BODIES OF ONE WEIGHT (director, 2026-08-26 23:11: "about the same amount
 * of content in each card so they take up roughly the same amount of space").
 * The pass before this one left the arsenal at 226 characters and the relics at
 * 300 against a core of 154, which at the rendered column width is a nine-line
 * card sitting beside a four-line one and two rows that do not line up. The six
 * now run 175 to 196, inside one rendered line of each other, and the kicker
 * lines are all short enough to hold one line so the bodies start level too. A
 * seventh card, or a rewrite of one of these, holds that band or it puts the
 * hole back. The vertical centring in bin/generate.mjs is the other half of the
 * ask and it corrects the remainder; it does not excuse a wall of text.
 *
 * The voice is docs/VOICE.md read as a person rather than a style guide: this is
 * the first thing a stranger learns about what they would be holding, so it is
 * a friend explaining the game across a table. Blunt, concrete, uncontracted, no
 * dashes and no exclamations, and never more than two sentences a card. */
export function kitCards(kit) {
  return [
    {
      id: 'core',
      count: `One of ${kit.cores}`,
      kind: 'Aimed',
      title: 'THE CORE',
      line: 'The one you aim.',
      body: 'You pick your core at the door, and it sits in a slot the draft can never touch. Everything else you carry fires on its own, and this is the one weapon that waits for you to point it.',
    },
    {
      id: 'arsenal',
      count: `${kit.weaponSlots} slots`,
      kind: 'Automatic',
      title: 'THE ARSENAL',
      line: `${kit.weaponSlots} that fire themselves.`,
      body: `Room for ${kit.weaponSlots}, pulled from ${kit.weapons} weapons that keep their own time and never ask permission. ${kit.evolutions} of them have an end form, and getting there takes a maxed weapon, its paired tome, and a boss chest.`,
    },
    {
      id: 'tomes',
      count: `${kit.tomeSlots} slots`,
      kind: 'Passive',
      title: 'THE TOMES',
      line: `${kit.tomeSlots} that bend the math.`,
      body: `${kit.tomeSlots} more slots, filled out of ${kit.tomes} tomes. None of them fires at anything. They decide how hard the rest of your build hits and how often, and the right stack is worth more than another weapon.`,
    },
    {
      id: 'whomp',
      count: `Every ${kit.whomp.seconds} seconds`,
      kind: `On ${kit.whomp.slot}`,
      title: 'THE WHOMP',
      line: 'The button the game is named after.',
      body: `You come down on ${kit.whomp.slot} and the ground does the arguing. ${kit.whomp.armedFromStart ? 'It is yours from the first second of the run, it comes back' : 'It comes back'} every ${kit.whomp.seconds} seconds on a bare build, and plenty of what you pick up shortens that wait.`,
    },
    {
      id: 'character',
      count: `One of ${kit.characters}`,
      kind: 'Picked first',
      title: 'YOUR CHARACTER',
      line: 'Each one cheats differently.',
      body: `All ${kit.characters} are open on a fresh save, so the first pick of the run is a real one. Every one of them carries a rule that is always on and a signature move nobody else gets to press.`,
    },
    {
      id: 'relics',
      count: `${kit.relics} to find`,
      kind: 'Not drafted',
      title: 'THE RELICS',
      line: 'The run picks these, not you.',
      body: `Not one of the ${kit.relics} ever shows up on a level up card. They come out of chests, and out of the machines that eat one relic and vend a better one, so a run can hand you a build you never drafted.`,
    },
  ];
}

/* ----------------------------------------------------------- the release tracks */

/** Both play buttons point at URLs the GAME owns. src/core/releaseChannel.ts
 *  holds them in AUDITED_RELEASE_CHANNEL_URLS, audited there because the game
 *  itself links between tracks; a second hand-typed copy on the site is a second
 *  thing to get wrong the next time a track moves. */
export function parseReleaseChannelUrls(source) {
  const block = String(source).split(/AUDITED_RELEASE_CHANNEL_URLS\s*=\s*Object\.freeze\(\{/)[1]?.split(/\}\s*as const/)[0] ?? '';
  const urls = {};
  for (const m of block.matchAll(/(\w+)\s*:\s*'([^']+)'/g)) urls[m[1]] = m[2];
  for (const channel of ['stable', 'preview']) {
    if (!/^https:\/\/[^\s']+\/$/.test(urls[channel] || '')) {
      throw new Error(`whomp/src/core/releaseChannel.ts did not yield an https ${channel} URL. The play buttons are read from the game's audited channel table and will not be hand-typed here.`);
    }
  }
  return { stable: urls.stable, preview: urls.preview };
}

/** The channel MODE is the game's own flag (whomp/src/core/channelMode.ts,
 *  director 2026-08-07 15:57: one deploy for a while, feature off, not
 *  removed). The site reads the flag from the same tree the play URLs come
 *  from, for the same reason: a second copy of a studio posture is a second
 *  thing to forget to flip. */
export function parseChannelMode(source) {
  const m = String(source).match(/CHANNEL_MODE:\s*ChannelMode\s*=\s*'(\w+)'/);
  if (!m || (m[1] !== 'single' && m[1] !== 'dual')) {
    throw new Error('whomp/src/core/channelMode.ts did not yield a channel mode. The site reads the game\'s own flag and will not assume one.');
  }
  return m[1];
}

/** The landing page's derivations, tested against fixture text rather than
 *  against whichever game checkout happens to sit beside this repo, so the suite
 *  is deterministic and runs with no game present.
 *
 *  WHAT THIS SUITE IS ACTUALLY PROTECTING. Every case below is a thing the page
 *  was doing on 2026-08-06, not a hypothetical. It printed "A3 - Wed 7/30" for a
 *  week after that Wednesday, it printed "A8 - next week" on a static page, and
 *  it ended two of nine arcs mid-list because docs/CAMPAIGN.md wraps a long line
 *  and the old parser read one line. None of that was noticed by anything: the
 *  generator exited zero every time, the deploy reported success, and the rot was
 *  found by a person reading the page. These are the eyes that replace that.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPipelineTeasers,
  isExpiredSchedule,
  kitCards,
  kitShape,
  liveSchedule,
  localDay,
  openingCapital,
  parseArcs,
  parseBuildSlots,
  parseReleaseChannelUrls,
  parseWishlistWants,
  renderableArcs,
  resolveDate,
  runShape,
  trailsOff,
  withoutSourceRefs,
} from '../bin/landing.mjs';

const TODAY = '2026-08-06';

/* ------------------------------------------------------------------ the clock */

test('the reference day is read off the local clock, never off UTC', () => {
  // 2026-08-06 at 23:30 local is already 2026-08-07 in UTC for this timezone's
  // offset, and the arcs are dated in local time, so the comparison has to be.
  assert.equal(localDay(new Date(2026, 7, 6, 23, 30)), '2026-08-06');
  assert.equal(localDay(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
});

test('a bare month/day resolves to the year that puts it nearest the reference day', () => {
  assert.equal(resolveDate('Wed 7/30', TODAY), Date.UTC(2026, 6, 30));
  // Read on the second of January, "12/28" is the December just gone.
  assert.equal(resolveDate('12/28', '2027-01-02'), Date.UTC(2026, 11, 28));
  assert.equal(resolveDate('2026-09-01', TODAY), Date.UTC(2026, 8, 1));
  assert.equal(resolveDate('August 12', TODAY), Date.UTC(2026, 7, 12));
  assert.equal(resolveDate('0.7', TODAY), null);
});

test('every schedule the page was still printing in August reads as expired', () => {
  for (const dead of ['Wed 7/30', 'Thu 7/31', 'Fri+', 'next week', 'next week, 0.7', 'today', 'soon']) {
    assert.equal(isExpiredSchedule(dead, TODAY), true, `${dead} should be expired`);
  }
});

test('a version, a status and a date still ahead of the reader survive', () => {
  for (const live of ['0.7', 'live', 'nearly closed', 'pillar, rolling', '2026-09-01', '9/30']) {
    assert.equal(isExpiredSchedule(live, TODAY), false, `${live} should survive`);
  }
});

test('an expired part is dropped without taking the durable part with it', () => {
  assert.equal(liveSchedule('next week, 0.7', TODAY), '0.7');
  assert.equal(liveSchedule('Wed 7/30', TODAY), '');
  assert.equal(liveSchedule('pillar, rolling', TODAY), 'pillar, rolling');
  assert.equal(liveSchedule('', TODAY), '');
});

/* ---------------------------------------------------------------- the sentence */

test('a sentence that stops on a comma, a plus or nothing at all is trailing off', () => {
  assert.equal(trailsOff('zone-gated new characters (7 themed),'), true);
  assert.equal(trailsOff('dev tools graduate to player features. Photo mode +'), true);
  assert.equal(trailsOff('Rolling'), true);
  assert.equal(trailsOff(''), true);
  assert.equal(trailsOff('   '), true);
  assert.equal(trailsOff('junction law, sprite bar, taste-law enforcement. Rolling.'), false);
  assert.equal(trailsOff('Is it though?'), false);
});

test('a citation of a repo file never reaches the page, and an arrow becomes a word', () => {
  assert.equal(
    withoutSourceRefs('L0 secret entry -> L3 community pipeline per THE_LAB_ARC.md.'),
    'L0 secret entry to L3 community pipeline.',
  );
  assert.equal(withoutSourceRefs('Second Seat registry seeds it.'), 'Second Seat registry seeds it.');
  assert.equal(withoutSourceRefs('Read the design, see docs/design/TUTORIAL.md.'), 'Read the design.');
});

test('a description that continues its own title still opens like a sentence', () => {
  // docs/CAMPAIGN.md writes "A4 AUDIO (Thu 7/31): own campaign." and the site
  // renders the title as a heading above it, so the description has to stand up
  // on its own. Capitalising is typography; no word changes.
  assert.equal(openingCapital('own campaign. Every ratified visual beat gets its sound twin.'),
    'Own campaign. Every ratified visual beat gets its sound twin.');
  assert.equal(openingCapital('Already fine.'), 'Already fine.');
  assert.equal(openingCapital('   '), '');
});

/* -------------------------------------------------------------------- the arcs */

/** The exact shape docs/CAMPAIGN.md carried on 2026-08-06, wrapped lines and
 *  all. A6 and A9 are the two that wrap. */
const CAMPAIGN = `# Campaign

## ARCS
- A1 QUALITY BAR (live): junction law, sprite bar, taste-law enforcement. Rolling.
- A3 CO-OP (Wed 7/30): the quality push campaign. Second Seat registry seeds it.
- A6 CHARACTER PROGRESSION (Fri+): starters trio, zone-gated new characters (7 themed),
  Whompus crown, Orbital Mechanic v2, pedestal rework, unlock ceremonies wired.
- A8 ACCOUNTS (next week, 0.7): wrangler tap + sync; SAVE COMPAT fixtures first.
- A9 THE LAB ARC (pillar, rolling): dev tools graduate to player features. Photo mode +
  free roam, codex, gallery; L0 secret entry -> L3 community pipeline per THE_LAB_ARC.md.

## STANDING DEBTS
- something else entirely
`;

test('a wrapped arc is folded back together instead of ending mid-list', () => {
  const arcs = parseArcs(CAMPAIGN);
  assert.deepEqual(arcs.map((a) => a.id), ['A1', 'A3', 'A6', 'A8', 'A9']);
  const a6 = arcs.find((a) => a.id === 'A6');
  assert.equal(a6.name, 'CHARACTER PROGRESSION');
  assert.equal(a6.when, 'Fri+');
  assert.equal(
    a6.what,
    'starters trio, zone-gated new characters (7 themed), Whompus crown, Orbital Mechanic v2, pedestal rework, unlock ceremonies wired.',
  );
  assert.equal(trailsOff(a6.what), false);
});

test('the ARCS block stops at the next heading', () => {
  assert.equal(parseArcs(CAMPAIGN).some((a) => /something else/.test(a.what)), false);
});

test('the rendered arcs carry no expired schedule and no unfinished sentence', () => {
  const { cards, dropped } = renderableArcs(parseArcs(CAMPAIGN), TODAY);
  assert.equal(dropped.length, 0);
  // A3's Wednesday and A6's "Fri+" leave nothing behind; A8's "next week, 0.7"
  // keeps the half of itself that is still true.
  assert.deepEqual(cards.map((c) => c.when), ['live', '', '', '0.7', 'pillar, rolling']);
  for (const card of cards) {
    assert.equal(isExpiredSchedule(card.when, TODAY), false, `${card.id} kept an expired schedule`);
    assert.equal(trailsOff(card.what), false, `${card.id} trails off`);
    assert.equal(/\.(md|ts|mjs|json)\b/.test(card.what), false, `${card.id} names a repo file`);
  }
});

test('an arc whose description trails off is dropped with its reason, never published', () => {
  const broken = `## ARCS
- A1 FINE (live): a whole sentence.
- A2 BROKEN (live): this one ends on a comma,
`;
  const { cards, dropped } = renderableArcs(parseArcs(broken), TODAY);
  assert.deepEqual(cards.map((c) => c.id), ['A1']);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].id, 'A2');
  assert.match(dropped[0].reason, /trails off/);
});

test('an arc whose body still carries a dead weekday is reported rather than mangled', () => {
  const body = `## ARCS
- A5 CONTROLLER: S1 Thu, S2 Fri/weekend, Deck later.
`;
  const { cards, expiredBody } = renderableArcs(parseArcs(body), TODAY);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].what, 'S1 Thu, S2 Fri/weekend, Deck later.');
  assert.deepEqual(expiredBody.map((a) => a.id), ['A5']);
});

/* --------------------------------------------------------------- the pipeline */

const WISHLIST = `# THE WISHLIST

| want | hook | source |
|---|---|---|
| QUEUED W2 - BUILD THE TUTORIAL LEVEL | The design is done. | [W2-tutorial-build.md](wishlist/W2-tutorial-build.md) |
| QUEUED - THE SNOW WORLDS GET THEIR OWN ENEMIES | Roster now, bosses later. | [VISUAL-snow-roster.md](wishlist/VISUAL-snow-roster.md) |
| QUEUED W1 - CO-OP DRAFTS OFFER NO TOMES, AT ALL | Found incidentally. | [W1-coop-tome-drought.md](wishlist/W1-coop-tome-drought.md) |
`;

test('the wishlist table yields one want per row, keyed by the brief it links', () => {
  assert.deepEqual(parseWishlistWants(WISHLIST).map((w) => w.file), [
    'W2-tutorial-build.md', 'VISUAL-snow-roster.md', 'W1-coop-tome-drought.md',
  ]);
});

test('a want with no authored line is skipped and counted, never guessed at', () => {
  const { cards, unwritten, queued } = buildPipelineTeasers(WISHLIST);
  assert.deepEqual(cards.map((c) => c.file), ['W2-tutorial-build.md', 'VISUAL-snow-roster.md']);
  // The defect report in the queue is exactly what must not become a teaser.
  assert.deepEqual(unwritten, ['W1-coop-tome-drought.md']);
  assert.equal(queued, 3);
});

test('a teaser whose want has left the queue is reported as orphaned', () => {
  const shipped = WISHLIST.split('\n').filter((l) => !/snow-roster/.test(l)).join('\n');
  const { cards, orphaned } = buildPipelineTeasers(shipped);
  assert.equal(cards.some((c) => /snow/.test(c.file)), false);
  assert.ok(orphaned.includes('VISUAL-snow-roster.md'));
});

test('every authored teaser line is a finished sentence in the house voice', () => {
  const { cards } = buildPipelineTeasers(WISHLIST);
  for (const card of cards) {
    assert.equal(trailsOff(card.line), false);
    assert.equal(/[—–!]/.test(`${card.title} ${card.line}`), false, `${card.file} breaks house law`);
  }
});

test('a wishlist that parses to nothing is an error, not an empty section', () => {
  assert.throws(() => buildPipelineTeasers('# THE WISHLIST\n\nno table here\n'), /zero wants/);
});

/* ------------------------------------------------------------- what a run is */

const gameData = (over = {}) => ({
  domains: {
    runModes: {
      entries: {
        classic: {
          paceScale: 5 / 3,
          bankAtElapsedSec: 1200,
          finalHordeAtPaceSec: 1800,
          clearHoldPaceSec: 200,
          offersVictoryChoice: true,
          ...over,
        },
      },
    },
    weapons: { count: 33 },
    coreWeapons: { count: 8 },
    relics: { count: 29 },
    characters: {
      count: 11,
      entries: { bonkrat: { id: 'bonkrat', innateId: 'boosterSchool', signatureId: 'megaDash' } },
    },
    enemies: { count: 58 },
    levels: { count: 12 },
    passives: { count: 17 },
    evolutions: { count: 8 },
    ultimates: {
      count: 1,
      entries: { whomp: { id: 'whomp', name: 'The Whomp', cooldownMs: 50000 } },
      runtime: { slot: 'Q', availability: { fromRunStart: true, requiresBossKill: false } },
    },
  },
});

test('the run clock comes off the mode profile, not off the design doc', () => {
  const shape = runShape(gameData());
  // docs/GAME_SPEC.md still says "28-minute Classic runs". The registry says 20.
  assert.equal(shape.minutes, 20);
  assert.equal(shape.bank, '20:00');
  assert.equal(shape.finalHorde, '18:00');
  assert.equal(shape.holdMinutes, 2);
  assert.equal(shape.endless, true);
  assert.equal(shape.weapons, 33);
  assert.equal(shape.cores, 8);
});

test('a moved or missing field stops the page rather than inventing a run length', () => {
  const stripped = gameData();
  delete stripped.domains.runModes.entries.classic;
  assert.throws(() => runShape(stripped), /no runModes entry/);
  assert.throws(() => runShape(gameData({ bankAtElapsedSec: 0 })), /bankAtElapsedSec/);
  const noCount = gameData();
  delete noCount.domains.weapons;
  assert.throws(() => runShape(noCount), /weapons/);
});

test('a run clock whose parts do not add up refuses to describe itself', () => {
  assert.throws(() => runShape(gameData({ clearHoldPaceSec: 20 })), /does not close/);
});

/* --------------------------------------------------------------- what you carry */

/** The shape of whomp/src/sim/progression.ts on 2026-08-07, comment and all,
 *  because the comment beside WEAPON_SLOTS is exactly the kind of thing a naive
 *  match swallows. */
const PROGRESSION = `
export const WEAPON_SLOTS = 4;   // GAME_SPEC doesn't fix a number; locked to BOO's shape per brief
export const PASSIVE_SLOTS = 4;
export const OFFER_SIZE = 3;
export const DRAFT_MAX_CARDS = 4;
`;

const SLOTS = { weapons: 4, tomes: 4, offer: 3 };

test('the size of a build is read out of the game, not typed into a sentence', () => {
  assert.deepEqual(parseBuildSlots(PROGRESSION), SLOTS);
});

test('a renamed or emptied slot constant stops the page rather than guessing', () => {
  assert.throws(() => parseBuildSlots('export const BUILD_SLOTS = 4;'), /WEAPON_SLOTS/);
  assert.throws(() => parseBuildSlots('export const WEAPON_SLOTS = 4;\nexport const OFFER_SIZE = 3;'), /PASSIVE_SLOTS/);
  assert.throws(() => parseBuildSlots('export const WEAPON_SLOTS = 0;'), /not a build/);
});

test('the kit is six things, counted off the registries the game plays on', () => {
  const kit = kitShape(gameData(), SLOTS);
  assert.equal(kit.cores, 8);
  assert.equal(kit.weapons, 33);
  assert.equal(kit.relics, 29);
  assert.equal(kit.weaponSlots, 4);
  assert.equal(kit.tomes, 17);
  assert.equal(kit.tomeSlots, 4);
  assert.equal(kit.evolutions, 8);
  assert.equal(kit.characters, 11);
  assert.equal(kit.offer, 3);
  assert.deepEqual(kit.whomp, { slot: 'Q', seconds: 50, armedFromStart: true });
});

test('a second ultimate retires the sentence rather than quietly joining it', () => {
  // "The button the game is named after" is true while there is one button.
  const two = gameData();
  two.domains.ultimates.entries.encore = { id: 'encore', cooldownMs: 30000 };
  assert.throws(() => kitShape(two, SLOTS), /exactly one/);
});

test('a character with no innate or no signature stops the claim that every one cheats', () => {
  const plain = gameData();
  plain.domains.characters.entries.drifter = { id: 'drifter', innateId: 'quickFeet' };
  assert.throws(() => kitShape(plain, SLOTS), /drifter/);
});

test('a WHOMP with no cooldown and a WHOMP with no key both refuse to be described', () => {
  const noCooldown = gameData();
  noCooldown.domains.ultimates.entries.whomp.cooldownMs = 0;
  assert.throws(() => kitShape(noCooldown, SLOTS), /positive cooldown/);
  const noSlot = gameData();
  delete noSlot.domains.ultimates.runtime.slot;
  assert.throws(() => kitShape(noSlot, SLOTS), /input slot/);
});

test('the six cards are the six things, in the order a run hands them to you', () => {
  const cards = kitCards(kitShape(gameData(), SLOTS));
  assert.deepEqual(cards.map((c) => c.id), ['core', 'arsenal', 'tomes', 'whomp', 'character', 'relics']);
  assert.deepEqual(cards.map((c) => c.title),
    ['THE CORE', 'THE ARSENAL', 'THE TOMES', 'THE WHOMP', 'YOUR CHARACTER', 'THE RELICS']);
  /* AN EVEN GRID IS THE ASK, so the count is pinned rather than left to whoever
     writes the seventh card (director, 2026-08-25: "make it present as an even
     6"). The track sizing lands three across at the landing page's width, so an
     odd number of cards is a row with a hole in it. */
  assert.equal(cards.length % 3, 0, 'the kit grid is three across and this many cards leaves a hole in the last row');
});

/* THE RELICS CARD IS THE ONE THAT IS NOT DRAFTED, and every clause of it that a
   reader could check is checked here, because it is the only card making a claim
   about where something comes FROM rather than what it does. */
test('the relics card says found, not drafted, and never contradicts the draft', () => {
  const card = kitCards(kitShape(gameData(), SLOTS)).find((c) => c.id === 'relics');
  assert.equal(card.kind, 'Not drafted');
  assert.match(card.body, /never|not one of/i);
  assert.match(card.body, /chest/i);
  assert.match(card.body, /level up/i);
  // The tomes card already ends on what the rest of the build is worth. Two
  // cards closing on one sentence is one card printed twice.
  const tomes = kitCards(kitShape(gameData(), SLOTS)).find((c) => c.id === 'tomes');
  assert.match(tomes.body, /worth/);
  assert.equal(/what the rest of your build is worth/.test(card.body), false,
    'the relics card repeats the tomes card word for word');
});

test('every card is finished sentences in the house voice, and no card shouts', () => {
  for (const card of kitCards(kitShape(gameData(), SLOTS))) {
    assert.equal(trailsOff(card.line), false, `${card.id} has a line that trails off`);
    assert.equal(trailsOff(card.body), false, `${card.id} has a body that trails off`);
    const all = `${card.count} ${card.kind} ${card.title} ${card.line} ${card.body}`;
    assert.equal(/[—–!]/.test(all), false, `${card.id} breaks house law`);
    // Rule 12: the machinery has its own words and they are not these.
    assert.equal(/\b(registry|artifact|schema|field|contract|domain)\b/i.test(all), false,
      `${card.id} names the machinery`);
  }
});

test('not one number in the kit copy is typed, and moving the game moves the page', () => {
  /* THE PIN THAT MATTERS. Every figure in these five cards has to arrive from
   * the game, so the page cannot be right today and wrong the morning somebody
   * adds a weapon. A doctored kit is the cheapest proof there is: if a number
   * below survives it, it was typed into prose. */
  const kit = kitShape(gameData(), SLOTS);
  const moved = kitCards({
    ...kit,
    relics: 90,
    cores: 91,
    weapons: 92,
    weaponSlots: 93,
    tomes: 94,
    tomeSlots: 95,
    evolutions: 96,
    characters: 97,
    whomp: { slot: 'Z', seconds: 98, armedFromStart: true },
  });
  const text = moved.map((c) => `${c.count} ${c.kind} ${c.line} ${c.body}`).join(' ');
  for (const stale of ['8', '33', '17', '11', '50', '29']) {
    assert.equal(new RegExp(`\\b${stale}\\b`).test(text), false, `the copy still carries ${stale} by hand`);
  }
  for (const fresh of ['90', '91', '92', '93', '94', '95', '96', '97', '98']) {
    assert.match(text, new RegExp(`\\b${fresh}\\b`), `the copy never prints ${fresh}`);
  }
  assert.match(text, /\bZ\b/, 'the WHOMP card hand-types its own key');
});

test('a WHOMP nobody has to earn says so, and one that must be earned does not', () => {
  const kit = kitShape(gameData(), SLOTS);
  const armed = kitCards(kit).find((c) => c.id === 'whomp');
  assert.match(armed.body, /first second of the run/);
  const earned = kitCards({ ...kit, whomp: { ...kit.whomp, armedFromStart: false } })
    .find((c) => c.id === 'whomp');
  assert.equal(/first second of the run/.test(earned.body), false);
  assert.match(earned.body, /50 seconds/);
});

/* ----------------------------------------------------------- the release tracks */

test('both play buttons are read out of the game\'s audited channel table', () => {
  const source = `
const AUDITED_RELEASE_CHANNEL_URLS = Object.freeze({
  stable: 'https://kiwimaddog2020.github.io/whomp-play/',
  preview: 'https://whomp-preview.pages.dev/',
} as const satisfies Readonly<Record<ReleaseChannel, string>>);
`;
  assert.deepEqual(parseReleaseChannelUrls(source), {
    stable: 'https://kiwimaddog2020.github.io/whomp-play/',
    preview: 'https://whomp-preview.pages.dev/',
  });
});

test('a channel table that moved or lost a track stops the build', () => {
  assert.throws(() => parseReleaseChannelUrls('const OTHER = {};'), /audited channel table/);
  assert.throws(() => parseReleaseChannelUrls(`
const AUDITED_RELEASE_CHANNEL_URLS = Object.freeze({
  stable: 'http://insecure.example/',
  preview: 'https://whomp-preview.pages.dev/',
} as const satisfies X);
`), /stable URL/);
});

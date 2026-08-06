/** THE LANDING PAGE, rendered from fixtures and read back.
 *
 *  This is the suite the inline template could not have. Before the split,
 *  every claim about index.html was a claim about a 2000-line script that
 *  refuses to run at all unless three verified game artifacts are fresh and a
 *  game checkout sits beside this repo, so in practice nobody checked the page
 *  and the deploy was the first reader.
 *
 *  WHAT IT PROTECTS, in order of how much it would cost to get wrong:
 *
 *    1. The Upcoming section is the only place on this site that talks about the
 *       future. Each of the four states has a sentence, and three of the four
 *       sentences are wrong in the other three states. The state-to-sentence
 *       mapping is therefore pinned in both directions: the right line appears
 *       AND the wrong lines do not.
 *    2. The report pitch describes a loop whose second half is not built. The
 *       pin is that the page keeps saying so.
 *    3. The house rule: no em dashes, no en dashes, no exclamation marks, on the
 *       most public page in the project. Mutation-verified below.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { indexPage } from '../bin/index-page.mjs';
import { selectUpcomingReleases } from '../bin/upcoming.mjs';

const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);

// ── the fixture chrome, standing in for what bin/generate.mjs measures ──────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Copied verbatim from bin/generate.mjs, because the fixture is standing in for
 * the real caller and a looser stand-in would prove less than nothing. */
const noEmDash = (s) => String(s)
  .replace(new RegExp(`\\s*${EM_DASH}\\s*`, 'g'), ', ')
  .replace(new RegExp(`\\s*${EN_DASH}\\s*`, 'g'), '-')
  .replace(new RegExp(EM_DASH, 'g'), '-')
  .replace(new RegExp(EN_DASH, 'g'), '-');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

const wordmark = (size, id) => `<svg class="wm" data-size="${size}" data-id="${id}" aria-hidden="true"></svg>`;
const arcCards = (list, { showWhen = true } = {}) => list.map((a) => `
    <div class="arc" id="flight-${slug(a.name)}">
      <div class="id">${esc(a.id)}${showWhen && a.when ? ` &middot; ${esc(a.when)}` : ''}</div>
      <h4>${esc(a.name)}</h4>
      <p>${esc(a.what)}</p>
    </div>`).join('');

const ARCS = [
  { id: 'A3', name: 'CO-OP', when: 'Wed 7/30', what: 'the quality push campaign.' },
  { id: 'A7', name: 'SNOW TIER', when: '0.7', what: 'Borealisk build, S1 maps.' },
];

const RELEASE = {
  version: '0.6.2',
  date: '2026-08-05',
  headline: 'The scattergun learns what the rest of your build already knew.',
  keyChanges: [
    'Your core weapon now reads more of your build.',
    'Cores declare an element, and a build can commit to one.',
  ],
  bugFixes: [],
};

const render = ({ liveVersion = '0.6.1', releases = [RELEASE], live = undefined } = {}) => indexPage({
  TAGLINE: 'A 3D horde-survivor where one weapon is yours to aim.',
  FAVICON: 'whomp-icon.svg',
  SHARED_CSS: '.chip{}',
  AUTHBAR: '<div class="authbar"><button id="ab-signin">Sign in</button></div>',
  AUTH_SCRIPT: () => '<script type="module"></script>',
  wordmark,
  liveChip: () => '<span class="chip">live</span>',
  arcCards,
  arcs: ARCS,
  gameTaglines: ["It's a hammer.", 'Politely violent.'],
  upcoming: selectUpcomingReleases({ releases, liveVersion }),
  live: live !== undefined ? live : (liveVersion ? { sha: '0cb53bbe', version: liveVersion } : null),
  LIVE_URL: 'https://kiwimaddog2020.github.io/whomp-play',
  buildStamp: '2026-08-06 00:00 UTC',
  headSha: 'bcff1d6e',
  esc,
  noEmDash,
});

/** The chunk of markup between <nav class="topnav"> and </nav>. */
const navOf = (html) => html.slice(html.indexOf('<nav class="topnav"'), html.indexOf('</nav>'));
/** The chunk between <header> and </header>. */
const headerOf = (html) => html.slice(html.indexOf('<header>'), html.indexOf('</header>'));

// ── 1. THE LOGO MOVED ──────────────────────────────────────────────────────
test('the W sits in the nav bar, at the left, and no longer sits above the title', () => {
  const html = render();
  const nav = navOf(html);
  const header = headerOf(html);

  assert.match(nav, /class="wm"/, 'the mark is in the nav');
  assert.doesNotMatch(header, /class="wm"/, 'the mark is NOT above the title any more');

  // "at the left" is a claim about order inside the bar, so read the order.
  assert.ok(nav.indexOf('class="wm"') < nav.indexOf('href="wiki.html"'), 'the mark comes before the nav links');
  assert.ok(nav.indexOf('class="wm"') < nav.indexOf('authbar'), 'the mark comes before the sign-in control');
});

test('there is exactly one mark on the page, so nothing was moved by copying it', () => {
  const html = render();
  assert.equal(html.split('class="wm"').length - 1, 1);
});

test('the hero now opens on the title itself', () => {
  const header = headerOf(render());
  assert.match(header, /^<header>\s*<h1 class="whomp-wordmark"/);
});

test('the nav is a nav, and the mark inside it is not announced twice', () => {
  const nav = navOf(render());
  assert.match(nav, /aria-label="Site"/);
  assert.match(nav, /aria-hidden="true"/, 'the svg stays decorative; the h1 carries the name');
});

// ── 2. UPCOMING: the right sentence, and none of the wrong ones ─────────────
const LEDES = {
  waiting: 'Finished work that is not in the build behind the play button yet',
  current: 'The next version is not written yet',
  unknown: 'could not be reached when this page was built',
  ahead: 'Everything that is finished is in the build behind the play button',
};

test('a cut release ahead of live is published, in the words the release notes used', () => {
  const html = render({ liveVersion: '0.6.1' });
  assert.match(html, /What is coming next/);
  assert.match(html, new RegExp(LEDES.waiting));
  assert.match(html, /That build is version 0\.6\.1\./);
  assert.match(html, /version <b>0\.6\.2<\/b>/);
  assert.ok(html.includes(RELEASE.headline), 'the headline is carried across verbatim');
  for (const c of RELEASE.keyChanges) assert.ok(html.includes(c), `key change carried across: ${c}`);
});

test('with nothing waiting the page says so, and does not print an empty list under a promise', () => {
  const html = render({ liveVersion: '0.6.2' });
  assert.match(html, new RegExp(LEDES.current));
  assert.doesNotMatch(html, new RegExp(LEDES.waiting));
  assert.doesNotMatch(html, /class="coming"/, 'no release card is rendered');
});

test('an unreachable live build never produces a claim about what is coming', () => {
  const html = render({ liveVersion: null, live: null });
  assert.match(html, new RegExp(LEDES.unknown));
  assert.doesNotMatch(html, new RegExp(LEDES.waiting));
  assert.doesNotMatch(html, new RegExp(LEDES.current));
  assert.doesNotMatch(html, /class="coming"/);
});

test('a live build ahead of the written notes says nothing it cannot back', () => {
  const html = render({ liveVersion: '0.7.0' });
  assert.match(html, new RegExp(LEDES.ahead));
  assert.doesNotMatch(html, new RegExp(LEDES.current), 'it must not claim the next version is unwritten');
  assert.doesNotMatch(html, /class="coming"/);
});

test('releases past the cap are counted out loud rather than dropped', () => {
  const many = ['0.7.4', '0.7.3', '0.7.2', '0.7.1'].map((version) => ({ ...RELEASE, version }));
  const html = render({ liveVersion: '0.6.9', releases: many });
  assert.match(html, /1 more version is waiting and not shown here/);
});

test('the arcs are still on the page, and their hand-typed dates are not', () => {
  const html = render();
  assert.match(html, /Further out/);
  assert.match(html, /SNOW TIER/);
  assert.match(html, /directions and not dates/);
  assert.doesNotMatch(html, /Wed 7\/30/, 'a date a week in the past must not read as a plan');
  // and the shared renderer still prints them for callers that want them
  assert.match(arcCards(ARCS), /Wed 7\/30/);
});

// ── 3. THE REPORT PITCH: honest about the half that is not built ───────────
test('the report pitch describes the loop that exists', () => {
  const html = render();
  assert.match(html, /Report it, then watch it land/);
  assert.match(html, /Pause the game and pick REPORT/);
  assert.match(html, /draw on the screenshot/);
  assert.match(html, /log\.html#bugs/);
});

test('the report pitch keeps saying the per-report lookup does not exist', () => {
  // The one sentence on this page that a visitor can disprove by going and
  // looking. If a future edit takes it out, the heading starts promising a
  // feature nobody built.
  assert.match(render(), /There is no page yet where you look up your own report by number/);
});

// ── 4. HOUSE RULES, mutation-verified ──────────────────────────────────────
/** The rule is about copy a visitor READS, so this reduces the document to its
 *  text nodes first. Script, style, comments, the doctype and the tags
 *  themselves are markup: `<!doctype html>` and `!important` are not
 *  punctuation anybody chose. */
const readableText = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<![^>]*>/g, ' ')
  .replace(/<[^>]*>/g, ' ');

const houseViolations = (html) => {
  const text = readableText(html);
  const bad = [];
  if (text.includes(EM_DASH)) bad.push('em dash');
  if (text.includes(EN_DASH)) bad.push('en dash');
  if (text.includes('!')) bad.push('exclamation mark');
  return bad;
};

test('the page carries no em dash, no en dash and no exclamation mark', () => {
  assert.deepEqual(houseViolations(render()), []);
});

test('the house-rule check goes red on purpose', () => {
  // A guard that has never failed on purpose is not known to work.
  const withEm = render({ releases: [{ ...RELEASE, headline: `broken ${EM_DASH} headline` }] });
  assert.ok(withEm.includes(', headline'), 'noEmDash is what the page runs game copy through');

  assert.deepEqual(houseViolations(`<p>a ${EM_DASH} b</p>`), ['em dash']);
  assert.deepEqual(houseViolations(`<p>a ${EN_DASH} b</p>`), ['en dash']);
  assert.deepEqual(houseViolations('<p>Wow!</p>'), ['exclamation mark']);
});

test('game copy is escaped, not injected', () => {
  const html = render({ releases: [{ ...RELEASE, headline: '<img src=x onerror=alert(1)>' }] });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

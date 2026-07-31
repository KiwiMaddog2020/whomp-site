#!/usr/bin/env node
/** THE WHOMP SITE GENERATOR, the generated spine.
 *
 *  "Generated spine, authored highlights": a job derives deploys, the live sha,
 *  the campaign arcs and the known-bug counts FROM THE REPO, so the site cannot
 *  go stale or lie, and Kevin writes short human notes on top for the part a
 *  machine cannot pick: which changes actually mattered to a player.
 *
 *  IT NEVER TOUCHES THE GAME REPO. It reads. The site lives in its own repo on
 *  GitHub Pages precisely so a site edit can never bump the game's build sha,
 *  which the net handshake compares EXACTLY and which would lock out every peer
 *  mid-session.
 *
 *  TWO SURFACES, from one run:
 *    index.html  : the short public landing page. Mark, tagline, live build
 *                  chip, play button, arcs. Never grows.
 *    log.html    : the real dev log, sidebar, search, filters, and the two-view
 *                  toggle (Kevin's authored CONCISE notes vs the generated FULL
 *                  raw engineering log).
 *  Both read a shared search-index.json written alongside them, built at
 *  generate time from everything on the page: notes, commits, known bugs, arcs.
 *
 *  KNOWN BUGS, director change 2026-07-30: publishing individual tester reports
 *  verbatim on a public URL is not the same thing as publishing a changelog, and
 *  testers did not sign up for that. The public page gets an AGGREGATE ONLY
 *  summary (fixed/open totals, an area breakdown, a severity shape, one or two
 *  authored sentences), all counts derived by keyword classifier over the
 *  OPEN table, never a hand list of report ids. The real per-report text stays
 *  out of both log.html's public section and search-index.json. See
 *  parseOpenBugs / classifyBugArea / classifyBugSeverity below.
 *
 *  GATING, director change 2026-07-30: the log is PUBLIC for now (testers should
 *  be able to just reach it), but the sign-in control still works and a single
 *  GATING_ENABLED flag right below (not in log.html's own script anymore, this
 *  file is now the one place to flip it) turns real gating back on later, AND
 *  controls whether the OWNER-ONLY per-report bug section even gets generated.
 *  See the comment on that constant and on ownerBugSection further down.
 *
 *  USAGE: node bin/generate.mjs [--repo ../whomp] [--outdir .] [--offline]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const REPO = resolve(arg('--repo', '../whomp'));
const OUTDIR = resolve(arg('--outdir', SITE_ROOT));
const OFFLINE = args.includes('--offline');
const LIVE_URL = 'https://kiwimaddog2020.github.io/whomp-play';

/* GATING, single flag, one place to flip. Director change 2026-07-30: the log
 * is public today, so this is false. It drives two things at once:
 *   1. the runtime switch in log.html's own script (interpolated in below),
 *      which is what real reader gating turns on later.
 *   2. whether the OWNER-ONLY per-report bug detail is generated AT ALL. When
 *      this is false, the generator never builds that section's markup or
 *      data, so there is nothing to hide with CSS, it is genuinely absent
 *      from log.html and search-index.json. See the ownerBugSection comment
 *      near the bugs section below for how it turns on later, and the real
 *      caveat about static hosting once it does. */
const GATING_ENABLED = false;
const OWNER_EMAIL = 'kevinmadson@protonmail.com';

const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();

// ---------------------------------------------------------------- text helpers
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** Source docs in the game repo were written for engineers and sometimes carry
 *  an em dash. NO EM DASHES ANYWHERE is a site law, so any text pulled from a
 *  source doc goes through this before it reaches HTML. */
const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);
const noEmDash = (s) => String(s)
  .replace(new RegExp(`\\s*${EM_DASH}\\s*`, 'g'), ', ')
  .replace(new RegExp(`\\s*${EN_DASH}\\s*`, 'g'), '-')
  .replace(new RegExp(EM_DASH, 'g'), '-')
  .replace(new RegExp(EN_DASH, 'g'), '-');

/** Strips markdown decoration (bold, backticks) from text lifted out of a repo
 *  doc, then runs it through noEmDash. Used for bug-inventory / backlog text
 *  that was authored for engineers, not for the inline markdown in notes/. */
const cleanDoc = (s) => noEmDash(String(s).replace(/\*\*/g, '').replace(/`([^`]*)`/g, '$1').replace(/\s+/g, ' ').trim());

/** Minimal inline markdown for notes/*.md body text: escape first, then apply
 *  **bold** and ||spoiler|| on the escaped (safe) string. No other markdown is
 *  supported on purpose: notes are prose, not documents. */
const mdInline = (s) => noEmDash(esc(s))
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" tabindex="0" role="button" aria-label="Spoiler, click to reveal">$1</span>');

// ---------------------------------------------------------------- derive: identity
const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
/* AUTHORED, deliberately NOT derived from package.json. The repo description is
 * written for developers and name-drops the two games WHOMP gets compared to,
 * which the director cut as "a bit much" for a public page: leading with someone
 * else's games sells theirs, not ours. This is the one string on the site that is
 * marketing copy rather than repo truth, so it lives here and Kevin owns it. */
const TAGLINE = 'A 3D horde-survivor where you aim it yourself.';

const headSha = git('rev-parse', '--short', 'main');

// ---------------------------------------------------------------- derive: title screen wordmark + slogans
/* Director change 2026-07-30: "copy the title from the title screen EXACTLY"
 * and "use the same rotating slogans... under the title". Both come straight
 * out of whomp/src/ui/mainMenu.ts, the game's own source of truth, so this
 * page can never drift from what the title screen actually says or does.
 * TAGLINES is parsed out of the exported array rather than hand-copied, same
 * derive-not-duplicate reasoning as arcs/bugs above: the strings are the
 * game's own authored copy, and a hand-copy is exactly the kind of thing that
 * goes stale the next time someone tunes a line in the game. */
function parseGameTaglines() {
  const path = join(REPO, 'src/ui/mainMenu.ts');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const block = raw.split(/export const TAGLINES: readonly string\[\] = \[/)[1]?.split(/\n\];/)[0] ?? '';
  return [...block.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
}
const gameTaglines = parseGameTaglines();
if (gameTaglines.length === 0) {
  throw new Error('No TAGLINES parsed from whomp/src/ui/mainMenu.ts. The title screen file moved or its export shape changed, fix parseGameTaglines rather than shipping an empty rotation.');
}

// ---------------------------------------------------------------- derive: what is actually live
/* The live sha is the ONLY proof of live (deploy-verification law), so the site
 * reports it as measured, and says so plainly when it could not measure it. */
let live = null;
if (!OFFLINE) {
  try {
    const r = await fetch(`${LIVE_URL}/version.json`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) live = await r.json();
  } catch { /* offline build; the page says so rather than inventing a sha */ }
}

// ---------------------------------------------------------------- derive: the full shipped feed
/* Conventional-commit subjects are the source. Docs/chore/test commits are not
 * player-visible and are filtered out, so the feed reads as changes rather than
 * as a commit log. The count of what was filtered is kept and shown, because a
 * silently truncated feed reads as "that was everything" when it was not
 * (no-silent-caps law). This is the FULL view's raw material; log.html labels
 * it honestly as the raw engineering log, unedited. */
const RAW = git('log', 'main', '--date=short', '--pretty=%h\x1f%ad\x1f%s', '-n', '2000').split('\n');
const PLAYER_VISIBLE = /^(feat|fix|balance|perf|style)(\(|:)/;
const NOISE = /^(docs|chore|test|refactor|merge|revert)(\(|:)/i;
const KIND_LABEL = { feat: 'New', fix: 'Fixed', balance: 'Balance', perf: 'Performance', style: 'Polish' };
const KIND_INK = { feat: '--cyan', fix: '--pink', balance: '--violet', perf: '--gold', style: '--gold' };

const days = new Map();
let filtered = 0;
for (const line of RAW) {
  const [sha, date, subject] = line.split('\x1f');
  if (!subject) continue;
  if (!PLAYER_VISIBLE.test(subject)) { if (NOISE.test(subject)) filtered++; continue; }
  const m = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!m) continue;
  if (!days.has(date)) days.set(date, []);
  days.get(date).push({ sha, kind: m[1], scope: noEmDash(m[2] || ''), text: noEmDash(m[3]) });
}
const allDays = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));
const totalShipped = [...days.values()].reduce((n, d) => n + d.length, 0);

/* index.html only needs the headline numbers. log.html's full view gets the
 * real feed, capped per day so a burst day (150+ commits) reads as a feed
 * rather than a wall, with the drop count said out loud. */
const LOG_DAYS_CAP = 30;
const PER_DAY_CAP = 20;
const fullFeed = allDays.slice(0, LOG_DAYS_CAP);

// ---------------------------------------------------------------- derive: the arcs, from CAMPAIGN
/* CAMPAIGN.md IS the train. Parsing its ARCS block keeps one source of truth
 * rather than a second hand-maintained roadmap that drifts within a week. */
let arcs = [];
const campaignPath = join(REPO, 'docs/CAMPAIGN.md');
if (existsSync(campaignPath)) {
  const c = readFileSync(campaignPath, 'utf8');
  const block = c.split(/^## ARCS$/m)[1]?.split(/^## /m)[0] ?? '';
  arcs = [...block.matchAll(/^- (A\d+) ([^:(]+?)(?:\s*\(([^)]+)\))?:\s*(.+)$/gm)]
    .map((m) => ({ id: m[1], name: cleanDoc(m[2]), when: cleanDoc(m[3] || ''), what: cleanDoc(m[4]) }));
}

// ---------------------------------------------------------------- derive: known bugs, OPEN only
/* docs/BUG_INVENTORY.md is a VERIFIED per-item triage, not a hand-list of
 * standing debts, CAMPAIGN's old debt list is what went stale (reports
 * 141/142 marked open when both were fixed and wired), which is exactly the
 * failure mode this file exists to stop repeating. Only the OPEN table is
 * parsed; NOT-A-BUG / SUPERSEDED / NEEDS-KEVIN rows are not player-facing bugs. */
function parseOpenBugs() {
  const path = join(REPO, 'docs/BUG_INVENTORY.md');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const block = raw.split(/^## OPEN\b[^\n]*\n/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = [...block.matchAll(/^\|([^\n|]+)\|([^\n|]+)\|([^\n|]+)\|([^\n|]+)\|\s*$/gm)];
  const bugs = [];
  for (const m of rows) {
    const id = m[1].trim();
    if (/^-+$/.test(id) || /^id$/i.test(id)) continue;
    const what = cleanDoc(m[2]);
    const why = cleanDoc(m[3]);
    const evidence = cleanDoc(m[4]);
    bugs.push({ id, what, why, evidence, freshlyFiled: /^untriaged$/i.test(evidence) });
  }
  return bugs;
}
const openBugs = parseOpenBugs();

/* The FIXED/OPEN totals come straight from the inventory's own "Headline
 * counts" table rather than a hand count anywhere in this file, so the
 * published ratio can never drift from the source of truth. */
function parseHeadlineCounts() {
  const path = join(REPO, 'docs/BUG_INVENTORY.md');
  if (!existsSync(path)) return { fixed: null, open: null };
  const raw = readFileSync(path, 'utf8');
  const block = raw.split(/^## Headline counts$/m)[1]?.split(/^## /m)[0] ?? '';
  const grab = (label) => {
    const m = block.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(\\d+)\\s*\\|`));
    return m ? Number(m[1]) : null;
  };
  return { fixed: grab('FIXED'), open: grab('OPEN') };
}
const bugHeadline = parseHeadlineCounts();
const totalOpenBugs = openBugs.length;
const totalFixedBugs = bugHeadline.fixed;
if (bugHeadline.open !== null && bugHeadline.open !== totalOpenBugs) {
  console.warn(`WARNING: BUG_INVENTORY headline says ${bugHeadline.open} OPEN, but ${totalOpenBugs} OPEN rows were parsed. Counts may be stale, check the OPEN table.`);
}

/* AGGREGATE ONLY, derived by keyword match over each report's own "what" /
 * "why" / "evidence" text, never by a hand list of report ids. A hand list
 * of ids-to-category is exactly the staleness failure this project already
 * got burned by once (CAMPAIGN's STANDING DEBTS, see the header comment on
 * parseOpenBugs above), so the classifier reads the same way every time the
 * inventory changes, no id ever gets looked up individually. This function
 * and classifySeverity below are the ONLY things allowed to see each report's
 * text; everything downstream of them is counts only. */
const BUG_AREAS = ['world and hub', 'combat', 'multiplayer', 'interface', 'performance', 'audio'];
function classifyBugArea(b) {
  const t = `${b.what} ${b.why} ${b.evidence}`.toLowerCase();
  if (/\b(coop|co-op|duel|multiplayer|seat|desync|online match|lobby)\b/.test(t)) return 'multiplayer';
  if (/\b(sound|audio|music|sfx|volume|mute)\b/.test(t)) return 'audio';
  if (/\b(fps|frame rate|framerate|lag|stutter|performance|freeze)\b/.test(t)) return 'performance';
  if (/\b(minimap|hud|menu|share card|sign in|settings)\b/.test(t)) return 'interface';
  if (/\b(boss|miniboss|elite|hero|skin|wand|staff|weapon)\b/.test(t)) return 'combat';
  return 'world and hub';
}
function classifyBugSeverity(b) {
  const t = `${b.what} ${b.why} ${b.evidence}`.toLowerCase();
  if (/invisible wall|phantom wall/.test(t)) return 'recurring';
  if (/not a defect|suggestion, not|feature request|queued feature/.test(t)) return 'suggestion';
  return 'polish';
}
const bugAreaCounts = BUG_AREAS.map((area) => ({ area, count: openBugs.filter((b) => classifyBugArea(b) === area).length }));
const SEVERITY_LABEL = { recurring: 'Recurring class, several spots', polish: 'Single spot, visual polish', suggestion: 'Suggestion, not a defect' };
const severityCounts = { recurring: 0, polish: 0, suggestion: 0 };
for (const b of openBugs) severityCounts[classifyBugSeverity(b)]++;
const bugSeverityCounts = Object.entries(severityCounts).map(([key, count]) => ({ key, label: SEVERITY_LABEL[key], count }));

/* IF the data actually supports it: no open report uses crash/stuck/softlock
 * language, and most of what is open is polish or a suggestion rather than a
 * recurring class. Both are checked here, not assumed, so the authored line
 * below only claims what this run's data backs up. */
const noBlockingLanguage = !openBugs.some((b) => /\bcrash(?:es|ed)?\b|\bcan(?:'t|not) (?:play|progress|continue)\b|\bstuck\b|\bsoft.?lock\b/i.test(`${b.what} ${b.why} ${b.evidence}`));
const polishShare = totalOpenBugs > 0 ? (severityCounts.polish + severityCounts.suggestion) / totalOpenBugs : 0;
const bugFraming = (totalFixedBugs !== null && noBlockingLanguage && polishShare >= 0.6)
  ? `We have fixed ${totalFixedBugs} reports so far and ${totalOpenBugs} are still open. Most of what is left is small visual polish, corners of the map, a stray floating triangle, that kind of thing, not anything that stops you from playing.`
  : `We have fixed ${totalFixedBugs ?? '?'} reports so far and ${totalOpenBugs} are still open. We are working through the rest now.`;

// ---------------------------------------------------------------- derive: also in flight, from BACKLOG_INVENTORY
/* BACKLOG_INVENTORY.md is an engineer-facing sweep (line-numbers, file paths,
 * size estimates). Rather than publish that language, each known category gets
 * one authored marketing line and a REAL, DERIVED count of queued items, so the
 * count can never drift stale even though the sentence is hand-written. An
 * unrecognised category is skipped rather than guessed at. */
function parseBacklogTeasers() {
  const path = join(REPO, 'docs/BACKLOG_INVENTORY.md');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const BLURB = {
    'MULTIPLAYER': 'Head-to-head and co-op keep getting real: more seats, smoother reconnects, fairer arenas.',
    'BALANCE / PVP': 'Fight-by-fight tuning keeps going. Every duel should feel earned, not endless.',
    'HUB / WORLD': 'The hub keeps getting fixed and dressed up, corner by corner.',
    'PERFORMANCE': 'Keeping the game fast on more machines, not just the strong ones.',
    'FEEDBACK / TESTER-FACING': 'Turning what you tell us into the next build, faster.',
  };
  const sections = raw.split(/^## /m).slice(1);
  const out = [];
  for (const sec of sections) {
    const header = sec.match(/^\d+\.\s*([^\n]+)/);
    if (!header) continue;
    const name = header[1].trim();
    const blurb = BLURB[name];
    if (!blurb) continue; // stale/superseded/lane-hygiene/not-a-build-item sections, and anything new, get skipped rather than guessed at
    const count = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-+\s*\|/.test(l) && !/^\|\s*Item\s*\|/i.test(l)).length;
    out.push({ name: cleanDoc(name), blurb, count });
  }
  return out;
}
const backlogTeasers = parseBacklogTeasers();

// ---------------------------------------------------------------- derive: Kevin's authored notes
/* notes/<YYYY-MM-DD>.md, one file per update, simple front matter (version,
 * date, title). This is the CONCISE view's entire source. A machine cannot pick
 * highlights, so nothing lands here except a human deciding it was worth
 * saying, and that is what keeps this view from ever filling with noise. */
function parseNote(raw, fallbackDate) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const [, fmRaw, body] = m;
  const fm = {};
  for (const line of fmRaw.split('\n')) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { version: fm.version || '', date: fm.date || fallbackDate, title: fm.title || fallbackDate, body };
}

const BUCKET_NAMES = ['New', 'Better', 'Fixed', 'Coming'];
const BUCKET_RE = new RegExp(`^##\\s+(${BUCKET_NAMES.join('|')})\\s*$`, 'i');
const BUCKET_INK = { New: '--cyan', Better: '--violet', Fixed: '--pink', Coming: '--gold' };

function parseBody(body) {
  const lines = body.split('\n');
  const intro = [];
  const buckets = [];
  let current = null;
  let buf = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    buf = [];
    if (!text) return;
    (current ? current.blocks : intro).push(text);
  };
  for (const line of lines) {
    const bm = line.match(BUCKET_RE);
    if (bm) {
      flush();
      const name = BUCKET_NAMES.find((n) => n.toLowerCase() === bm[1].toLowerCase());
      current = { name, blocks: [] };
      buckets.push(current);
      continue;
    }
    if (line.trim() === '') { flush(); continue; }
    buf.push(line);
  }
  flush();
  return { intro, buckets };
}

/** A block is one blank-line-separated chunk of the note body. Bullet items can
 *  wrap across multiple source lines (readable line width in the .md file), so
 *  a continuation line (no leading "- ") folds into the item above it rather
 *  than becoming its own paragraph or leaking a stray "- " into the HTML. */
function renderBlock(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const isList = /^-\s+/.test(lines[0]);
  if (!isList) return `<p>${mdInline(lines.join(' '))}</p>`;
  const items = [];
  for (const line of lines) {
    if (/^-\s+/.test(line)) items.push(line.replace(/^-\s+/, ''));
    else if (items.length) items[items.length - 1] += ' ' + line;
  }
  return `<ul>${items.map((i) => `<li>${mdInline(i)}</li>`).join('')}</ul>`;
}

const NOTES_DIR = join(SITE_ROOT, 'notes');
let notes = [];
if (existsSync(NOTES_DIR)) {
  notes = readdirSync(NOTES_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => {
      const parsed = parseNote(readFileSync(join(NOTES_DIR, f), 'utf8'), f.replace(/\.md$/, ''));
      if (!parsed) return null;
      const { intro, buckets } = parseBody(parsed.body);
      return { ...parsed, file: f, intro, buckets };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const buildStamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// ---------------------------------------------------------------- the W, lifted verbatim from public/icons/icon.svg
/* Same geometry, same chromatic offsets, same cream face. The icon IS the
 * brand reference (director ruling), so the site does not redraw it. */
const W_PATH = 'M81 139 L175 374 L256 251 L337 374 L431 139';
const wordmark = (size, id) => `
<svg class="wm" viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="g${id}" cx="50%" cy="50%" r="72%">
    <stop offset="0%" stop-color="#1e0e2a"/><stop offset="100%" stop-color="#06040e"/>
  </radialGradient></defs>
  <rect width="512" height="512" rx="96" fill="url(#g${id})"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${W_PATH}" stroke="#24f0ff" stroke-width="59" transform="translate(14,26)"/>
    <path d="${W_PATH}" stroke="#ff2f7e" stroke-width="59" transform="translate(-16,16)"/>
    <path d="${W_PATH}" stroke="#151023" stroke-width="69"/>
    <path d="${W_PATH}" stroke="#fff3cf" stroke-width="59"/>
  </g>
</svg>`;
const FAVICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#06040e"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${W_PATH}" stroke="#24f0ff" stroke-width="59" transform="translate(14,26)"/><path d="${W_PATH}" stroke="#ff2f7e" stroke-width="59" transform="translate(-16,16)"/><path d="${W_PATH}" stroke="#fff3cf" stroke-width="59"/></g></svg>`)}`;

const liveChip = () => `<span class="chip"><span class="dot${live && live.sha === headSha ? '' : ' stale'}"></span>
  ${live ? `live <b>${esc(live.sha)}</b>` : 'live build <b>unverified</b>'}</span>
  <span class="chip">version <b>${esc(live?.version ?? pkg.version)}</b></span>`;

const arcCards = (list) => list.map((a) => `
    <div class="arc">
      <div class="id">${esc(a.id)}${a.when ? ` &middot; ${esc(a.when)}` : ''}</div>
      <h4>${esc(a.name)}</h4>
      <p>${esc(a.what)}</p>
    </div>`).join('');

// ---------------------------------------------------------------- shared CSS
/* THE PALETTE IS THE APP ICON'S, AT FULL SATURATION, ON DARK.
   Director ruling: candy pastels and four pink-free alternatives were rejected.
   The pink is load-bearing in the blend, so it is never desaturated or replaced. */
const SHARED_CSS = `
:root{
  --ink:#06040e; --lift:#1e0e2a; --outline:#151023;
  --pink:#ff2f7e; --cyan:#24f0ff; --violet:#b14bff; --gold:#ffcf3f;
  --cream:#fff3cf; --body:#cfc6dd; --dim:#8d84a1;
  --sweep:linear-gradient(90deg,var(--pink),var(--cyan));
  --font:'Segoe UI',system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --edge:1px solid rgba(255,243,207,.10);
}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:radial-gradient(ellipse 120% 80% at 50% -10%,var(--lift),var(--ink) 60%) no-repeat,var(--ink);
  color:var(--body); font-family:var(--font); line-height:1.6;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
a{color:var(--cyan)}
button{font-family:var(--font)}

/* THE CHROMATIC OFFSET IS THE SIGNATURE, carried from the icon to type:
   cyan right-and-down, pink left-and-down, cream face on top. Flat offsets,
   zero blur, matching the de-BOO flat-plinth doctrine the game already uses. */
.chroma{
  color:var(--cream); font-weight:900; letter-spacing:-.02em;
  text-shadow:.055em .05em 0 var(--cyan), -.055em .035em 0 var(--pink);
}

/* THE WORDMARK, lifted verbatim from whomp/src/ui/mainMenu.ts's
   .whomp-mainmenu__wordmark rule (the title screen). Same font stack, same
   clamp(60px,12vw,150px), same weight 900 (NEVER 1000: the game's own
   comment explains 1000 exceeds the heaviest real weight of the system
   fallback, so Mac Safari's SF substitution synthesizes a squished bold).
   The retro chromatic layering is two ::before/::after copies of the word
   via content:attr(data-wordmark), every offset and shadow expressed in em
   rather than px so the layering scales WITH the clamped font-size and holds
   together at every viewport width instead of drifting apart. SACRED, same
   as the game's own comment on this block: a frozen copy, not a reference,
   do not tokenize.

   NOTE 2026-07-30: a Chromium variable-font interpolation fix briefly replaced
   this stack with a static Black face. The director judged the resulting face
   worse and it was reverted, here and in the game together, so both surfaces
   stay identical. The squish and seam report on narrow Android is therefore
   still OPEN, and any future fix must preserve this face rather than swap it. */
.whomp-wordmark{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
  position:relative;isolation:isolate;z-index:2;font-size:clamp(60px,12vw,150px);font-weight:900;
  letter-spacing:-0.055em;line-height:0.82;margin:0;color:#fff3cf;-webkit-text-stroke:0.018em #151023;
  text-shadow:0 0.018em 0 #fff,0 0.06em 0 #181126,0 0.107em 0.167em rgba(0,0,0,.55);
  transform:skewX(-4deg) rotate(-1deg);animation:whomp-wordmark-hit 3.6s cubic-bezier(.2,.9,.25,1) infinite;}
.whomp-wordmark::before,.whomp-wordmark::after{content:attr(data-wordmark);position:absolute;inset:0;z-index:-1;-webkit-text-stroke:0;color:#ff2f7e;}
.whomp-wordmark::before{transform:translate(-0.048em,0.048em);text-shadow:-0.042em 0.042em 0 #5f174d;}
.whomp-wordmark::after{color:#24f0ff;transform:translate(0.042em,0.083em);text-shadow:0.036em 0.042em 0 #116a79;z-index:-2;}
@keyframes whomp-wordmark-hit{
  0%,8%,100%{transform:skewX(-4deg) rotate(-1deg) scale(1);}
  2%{transform:skewX(-4deg) rotate(-1deg) scale(1.06,.88) translateY(8px);}
  5%{transform:skewX(-4deg) rotate(-1deg) scale(.98,1.04) translateY(-3px);}
}
@media(prefers-reduced-motion:reduce){.whomp-wordmark{animation:none;}}

.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{
  display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;
  border:var(--edge);background:rgba(255,243,207,.04);font-size:.82rem;color:var(--body);
  font-variant-numeric:tabular-nums;
}
.chip b{color:var(--cream);font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 3px rgba(36,240,255,.16)}
.dot.stale{background:var(--gold);box-shadow:0 0 0 3px rgba(255,207,63,.16)}

.btn{
  display:inline-block;padding:13px 26px;border-radius:12px;text-decoration:none;
  font-weight:700;color:var(--ink);background:var(--sweep);border:0;cursor:pointer;
  box-shadow:0 4px 0 #7a1440; transition:transform .12s ease,box-shadow .12s ease;font-size:1rem;
}
.btn:hover{transform:translateY(2px);box-shadow:0 2px 0 #7a1440}
.btn.ghost{background:none;color:var(--cream);border:var(--edge);box-shadow:0 4px 0 rgba(0,0,0,.4)}
.btn.small{padding:9px 18px;font-size:.82rem;box-shadow:none}

.rule{height:3px;border-radius:2px;background:var(--sweep);opacity:.85;margin-bottom:26px;max-width:120px}

.arcs{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.arc{border:var(--edge);border-radius:14px;padding:16px 18px;background:rgba(255,243,207,.025)}
.arc .id{color:var(--gold);font-weight:800;font-size:.8rem;letter-spacing:.06em}
.arc h4{margin:4px 0 6px;color:var(--cream);font-size:1rem}
.arc p{margin:0;font-size:.88rem;color:var(--dim)}

/* SIGN-IN, reused from the game's own accounts worker so one account covers
   both surfaces. Same worker, same client id, same session shape. */
.authbar{display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:16px 0 0}
.authbar-name{color:var(--cream);font-weight:700;font-size:.85rem}

.spoiler{cursor:pointer;border-radius:4px;padding:0 2px;background:rgba(255,243,207,.08);color:transparent;text-shadow:0 0 0 transparent;transition:color .12s ease}
.spoiler::selection{color:transparent}
.spoiler.revealed{color:var(--cream);background:none}
.spoiler:not(.revealed)::after{content:"spoiler, click to reveal";color:var(--dim);font-style:italic}
.spoiler.revealed::after{content:""}

footer{margin-top:80px;padding-top:24px;border-top:var(--edge);color:var(--dim);font-size:.82rem;text-align:center}
footer code{color:var(--body)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const AUTH_SCRIPT = (idSuffix = '') => `
<script type="module">
import { getUser, onChange, signIn, signOut } from './bin/auth.js';
const show = (el, visible) => { if (el) el.style.display = visible ? '' : 'none'; };
function renderAuth(user) {
  const signedIn = user !== null;
  show(document.getElementById('ab-signedout'), !signedIn);
  show(document.getElementById('ab-signedin'), signedIn);
  if (signedIn) {
    const name = user.displayName || user.email;
    const el = document.getElementById('ab-name');
    if (el) el.textContent = name;
  }
  window.__whompUser = user;
  document.dispatchEvent(new CustomEvent('whomp-auth', { detail: user }));
}
async function runSignIn(button) {
  button.disabled = true;
  try { await signIn(); } finally { button.disabled = false; }
}
document.getElementById('ab-signin')?.addEventListener('click', (e) => runSignIn(e.currentTarget));
document.getElementById('ab-signout')?.addEventListener('click', () => signOut());
onChange(renderAuth);
renderAuth(getUser());
</script>`;

const AUTHBAR = `
<div class="authbar">
  <span id="ab-signedout">
    <button id="ab-signin" class="btn ghost small" type="button">Sign in</button>
  </span>
  <span id="ab-signedin" style="display:none">
    <span class="authbar-name" id="ab-name"></span>
    <button id="ab-signout" class="btn ghost small" type="button">Sign out</button>
  </span>
</div>`;

// ============================================================== INDEX.HTML
// The short public landing page. Mark, tagline, live build chip, play button,
// arcs. That is the whole page, on purpose: it never grows. Everything else
// (the log, known bugs, in-flight work, search) lives on log.html.
const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP: ${esc(TAGLINE)}</title>
<meta name="description" content="${esc(TAGLINE)} Built in the open, with the dev log public.">
<link rel="icon" href="${FAVICON}">
<style>
${SHARED_CSS}
.wrap{max-width:860px;margin:0 auto;padding:0 24px 96px}
header{padding:56px 0 40px;text-align:center}
.wm{display:block;margin:0 auto 22px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.45))}
/* Tagline typography lifted from the game's .whomp-mainmenu__tagline: weight
   700, letter-spacing .03em, italic, the same dimmed-white ink. Font-size
   stays the site's own responsive clamp (the game's is a fixed 16px in a
   fixed-size menu panel, not a full-bleed hero) rather than pinned to 16px. */
.tag{font-size:clamp(1.05rem,3.2vw,1.3rem);color:rgba(255,255,255,0.72);margin:18px auto 0;max-width:34ch;
  font-weight:700;font-style:italic;letter-spacing:0.03em}
.chips{justify-content:center;margin-top:26px}
.cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.doorway{text-align:center;color:var(--dim);font-size:.92rem;margin-top:18px}
h2{font-size:1.65rem;margin:0 0 6px}
section{margin-top:64px}
</style>
</head>
<body>
<div class="wrap">

${AUTHBAR}

<header>
  ${wordmark(112, 'h')}
  <h1 class="whomp-wordmark" data-wordmark="WHOMP">WHOMP</h1>
  <p class="tag" id="hero-tagline">${esc(gameTaglines[0])}</p>
  <script>document.getElementById('hero-tagline').textContent=(${JSON.stringify(gameTaglines)})[Math.min(${gameTaglines.length}-1,Math.max(0,Math.floor(Math.random()*${gameTaglines.length})))];</script>
  <div class="chips">${liveChip()}</div>
  <div class="cta">
    <a class="btn" href="${LIVE_URL}/">Play the current build</a>
    <a class="btn ghost" href="log.html">Read the dev log</a>
  </div>
  <p class="doorway">Every build is written down: what shipped, what's still broken, what's next.</p>
</header>

<section>
  <div class="rule"></div>
  <h2 class="chroma">What we are building</h2>
  <div class="arcs">${arcCards(arcs)}</div>
</section>

<footer>
  Generated ${esc(buildStamp)} from <code>main@${esc(headSha)}</code>.
  ${live ? `Live build <code>${esc(live.sha)}</code>${live.sha === headSha ? ' (current)' : ' (a deploy is pending)'}.`
         : 'Live build could not be reached at generation time, so no live sha is claimed.'}
</footer>

</div>
${AUTH_SCRIPT()}
</body>
</html>`;

// ============================================================== LOG.HTML
// The real dev log: sidebar, search, filters, and the two-view toggle.
//   CONCISE (default) = notes/*.md, Kevin's own words. The product.
//   FULL              = the generated feed from git log. Labelled honestly as
//                        the raw engineering log, so it reads as a door left
//                        open rather than as noise.
const noteCard = (n) => {
  const id = `note-${esc(n.date)}`;
  const introHtml = n.intro.map(renderBlock).join('');
  const bucketsHtml = n.buckets.map((b) => `
    <div class="bucket">
      <h4 style="color:var(${BUCKET_INK[b.name] || '--cream'})">${esc(b.name)}</h4>
      ${b.blocks.map(renderBlock).join('')}
    </div>`).join('');
  return `
  <article class="notecard" id="${id}">
    <div class="notecard-head">
      <span class="notecard-date">${esc(n.date)}</span>
      ${n.version ? `<span class="notecard-version">v${esc(n.version)}</span>` : ''}
    </div>
    <h3 class="chroma" style="font-size:1.4rem">${esc(n.title)}</h3>
    ${introHtml}
    <div class="buckets">${bucketsHtml}</div>
  </article>`;
};

const dayBlock = (date, changes) => {
  const shown = changes.slice(0, PER_DAY_CAP);
  const hidden = changes.length - shown.length;
  const rows = shown.map((c) => `
    <div class="row" data-kind="${esc(c.kind)}" id="chg-${esc(c.sha)}">
      <span class="kind" style="background:var(${KIND_INK[c.kind] || '--dim'})">${esc(KIND_LABEL[c.kind] || c.kind)}</span>
      <span class="what">${esc(c.text)}${c.scope ? ` <span class="scope">(${esc(c.scope)})</span>` : ''}</span>
      <span class="sha">${esc(c.sha)}</span>
    </div>`).join('');
  const more = hidden > 0 ? `<div class="row more">+ ${hidden} more that day, not shown</div>` : '';
  return `
  <div class="day">
    <h4>${esc(date)}</h4>
    ${rows}${more}
  </div>`;
};

/* OWNER-ONLY, per-report detail. Never used on the public page, only inside
 * ownerBugSection below, which only exists in the output at all when
 * GATING_ENABLED is true at build time. */
const bugRow = (b) => `
  <div class="bugrow" id="bug-${slug(b.id)}">
    <div class="bugrow-head">
      <span class="bugtag">#${esc(b.id)}</span>
      ${b.freshlyFiled ? '<span class="bugtag new">just filed</span>' : ''}
    </div>
    <p class="bugwhat">${esc(b.what)}</p>
    ${b.why ? `<p class="bugwhy">${esc(b.why)}</p>` : ''}
  </div>`;

/* OWNER-ONLY VIEW, built now, kept dark. Guarded at BUILD TIME, not just in
 * the browser: while GATING_ENABLED is false (today), this whole block is the
 * empty string, so openBugs' per-report what/why text never reaches logHtml
 * or search-index.json at all, there is nothing for a browser to download and
 * nothing a CSS rule is hiding. That is the difference between this and the
 * anti-pattern the director called out explicitly: shipping the raw text and
 * hiding it with CSS.
 *
 * TO TURN IT ON LATER: flip GATING_ENABLED to true at the top of this file
 * and regenerate. That restores the runtime check below (OWNER_EMAIL against
 * the signed-in identity from auth.js), so only Kevin's own signed-in session
 * reveals #owner-bugs. Read this caveat first though: GitHub Pages has no
 * server-side auth, every generated file is fetchable by its raw URL by
 * anyone who knows to look, signed in or not. The DOM check stops a casual
 * tester from seeing it in the rendered page, it is not real access control.
 * Before ever using this for genuinely sensitive detail, move the per-report
 * text behind the accounts worker as an authenticated endpoint instead of a
 * static file. */
const ownerBugSection = GATING_ENABLED ? `
  <section id="owner-bugs" class="gated-section" hidden>
    <div class="rule"></div>
    <h2 class="chroma">Owner detail</h2>
    <p class="lede">Full per-report bug text. Signed-in owner only, never part of what testers get.</p>
    ${openBugs.length ? openBugs.map(bugRow).join('') : '<p class="lede">Nothing open right now.</p>'}
  </section>` : '';

const flightCard = (t) => `
  <div class="arc" id="flight-${slug(t.name)}">
    <div class="id">IN FLIGHT</div>
    <h4>${esc(t.name)}</h4>
    <p>${esc(t.blurb)}</p>
    <p style="margin-top:8px;color:var(--dim);font-size:.78rem">${t.count} item${t.count === 1 ? '' : 's'} queued</p>
  </div>`;

const logHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP dev log</title>
<meta name="description" content="The WHOMP development log: what shipped, what's known-broken, and what's coming next.">
<link rel="icon" href="${FAVICON}">
<style>
${SHARED_CSS}
.topbar{max-width:1180px;margin:0 auto;padding:0 24px}
.topbar-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 0 0}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.brand .wm{margin:0}
.brand h1{font-size:1.6rem;margin:0}
.subtag{color:var(--dim);font-size:.85rem;margin:2px 0 0}

.searchwrap{position:relative;max-width:1180px;margin:22px auto 0;padding:0 24px}
.searchbox{width:100%;padding:14px 18px;border-radius:12px;border:var(--edge);background:rgba(255,243,207,.04);
  color:var(--cream);font-family:var(--font);font-size:1rem}
.searchbox::placeholder{color:var(--dim)}
.searchbox:focus{outline:2px solid var(--cyan);outline-offset:2px}
.sr-panel{position:absolute;left:24px;right:24px;top:calc(100% + 6px);background:var(--lift);border:var(--edge);
  border-radius:12px;max-height:60vh;overflow:auto;z-index:20;box-shadow:0 12px 32px rgba(0,0,0,.5);display:none}
.sr-panel.open{display:block}
.sr-empty{padding:16px;color:var(--dim);font-size:.88rem}
.sr-item{display:block;padding:12px 16px;border-top:1px solid rgba(255,243,207,.06);text-decoration:none;color:var(--body)}
.sr-item:first-child{border-top:0}
.sr-item:hover,.sr-item:focus{background:rgba(255,243,207,.06)}
.sr-kind{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  color:var(--gold);margin-right:8px}
.sr-title{color:var(--cream)}

.shell{max-width:1180px;margin:0 auto;padding:28px 24px 96px;display:flex;gap:36px;align-items:flex-start}
.side{width:220px;flex:none;position:sticky;top:20px;display:flex;flex-direction:column;gap:4px}
.side a{display:block;padding:9px 12px;border-radius:8px;color:var(--body);text-decoration:none;font-size:.92rem}
.side a:hover{background:rgba(255,243,207,.05);color:var(--cream)}
.side .stat{padding:9px 12px;color:var(--dim);font-size:.78rem}
.main{flex:1;min-width:0}

section{margin-top:56px}
section:first-child{margin-top:0}
h2{font-size:1.5rem;margin:0 0 6px}
.lede{color:var(--dim);margin:0 0 20px;font-size:.92rem}

.viewtoggle{display:flex;gap:8px;margin-bottom:18px}
.vtab{padding:9px 18px;border-radius:999px;border:var(--edge);background:none;color:var(--dim);cursor:pointer;font-size:.88rem;font-weight:700}
.vtab.is-active{color:var(--ink);background:var(--sweep);border-color:transparent}
.viewpane[hidden]{display:none}

.notecard{border:var(--edge);border-radius:16px;padding:22px 24px;margin-bottom:18px;background:rgba(255,243,207,.025)}
.notecard-head{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.notecard-date{color:var(--dim);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}
.notecard-version{color:var(--dim);font-size:.78rem;font-family:var(--mono)}
.notecard p{margin:10px 0}
.notecard ul{margin:8px 0;padding-left:20px}
.notecard li{margin:6px 0}
.buckets{display:grid;gap:14px;margin-top:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.bucket h4{margin:0 0 6px;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase}
.bucket ul{margin:0;padding-left:18px;font-size:.92rem}
.bucket li{margin:5px 0}
.bucket p{margin:0;font-size:.92rem}

.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.chipf{padding:7px 14px;border-radius:999px;border:var(--edge);background:none;color:var(--dim);cursor:pointer;font-size:.8rem}
.chipf.is-active{color:var(--cream);border-color:var(--cyan)}

.day{border:var(--edge);border-radius:14px;padding:18px 20px;margin-bottom:14px;background:rgba(255,243,207,.025)}
.day h4{margin:0 0 12px;font-size:.85rem;color:var(--dim);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.row{display:flex;gap:12px;padding:7px 0;border-top:1px solid rgba(255,243,207,.06);align-items:baseline}
.row:first-of-type{border-top:0}
.row[data-hidden="1"]{display:none}
.kind{flex:none;font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  padding:3px 8px;border-radius:6px;min-width:64px;text-align:center;color:var(--ink)}
/* min-width:0 is load-bearing, not decoration: a flex:1 item defaults to
   min-width:auto, which floors it at its own content's intrinsic width. A raw
   git subject can contain a long unbroken token (an ALL_CAPS_CONSTANT, a path)
   wide enough on its own to push the row past the viewport, and BODY has
   nothing clipping it, so that overflow becomes a page-wide horizontal
   scrollbar (director bug 2026-07-30, Full log view on mobile). min-width:0
   lets the row's real content still wrap, so the FIX is wrapping text, not a
   scroll box, per the no-body-scroll rule below. overflow-wrap is the same
   fix one layer down, for the rare single token wider than the column even
   after that. */
.what{flex:1;min-width:0;overflow-wrap:break-word}
.what .scope{color:var(--dim);font-size:.86rem}
.sha{flex:none;font-family:var(--mono);font-size:.76rem;color:var(--dim)}
.row.more{color:var(--dim);font-size:.83rem;font-style:italic;justify-content:center}

.bugrow{border:var(--edge);border-radius:12px;padding:14px 18px;margin-bottom:10px;background:rgba(255,243,207,.025)}
.bugrow-head{display:flex;gap:8px;margin-bottom:6px}
.bugtag{font-family:var(--mono);font-size:.74rem;color:var(--gold)}
.bugtag.new{color:var(--cyan)}
.bugwhat{margin:0 0 4px;color:var(--cream)}
.bugwhy{margin:0;color:var(--dim);font-size:.86rem}

/* AGGREGATE bug summary, counts only, no per-report anything. */
.bugtotals{margin-bottom:20px}
.bugareas{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px}
.bugarea{border:var(--edge);border-radius:12px;padding:14px 16px;background:rgba(255,243,207,.025)}
.bugarea-count{display:block;color:var(--cream);font-size:1.7rem;font-weight:800;font-variant-numeric:tabular-nums}
.bugarea-name{display:block;color:var(--dim);font-size:.8rem;margin-top:2px}
.bugseverity{display:flex;flex-wrap:wrap;gap:8px}
.bugseverity span{padding:7px 14px;border-radius:999px;border:var(--edge);color:var(--dim);font-size:.8rem}
.bugseverity span b{color:var(--cream)}

/* GATING SWITCH lives in the script below (GATING_ENABLED). This wrapper is
   what a real gate would hide; today it renders unconditionally. */
.gated-section{}

@media (max-width:700px){
  .shell{flex-direction:column;gap:20px}
  .side{width:100%;position:static;flex-direction:row;overflow-x:auto;gap:8px}
  .side a,.side .stat{white-space:nowrap}
  .buckets{grid-template-columns:1fr}
}
</style>
</head>
<body>

<div class="topbar">
  ${AUTHBAR}
  <div class="topbar-row">
    <a class="brand" href="index.html">
      ${wordmark(48, 'l')}
      <span>
        <h1 class="chroma">WHOMP dev log</h1>
        <p class="subtag">Built by one person and a crew of AI agents. This is the real log.</p>
      </span>
    </a>
    <div class="chips">${liveChip()}</div>
  </div>
</div>

<div class="searchwrap">
  <input class="searchbox" id="search" type="search" placeholder="Search changes, bugs, in-flight work, arcs..." autocomplete="off">
  <div class="sr-panel" id="sr-panel"></div>
</div>

<div class="shell">
  <nav class="side">
    <a href="#shipped">Shipped</a>
    <a href="#bugs">Known bugs</a>
    <a href="#flight">In flight</a>
    <a href="index.html">&larr; Back to WHOMP</a>
    <div class="stat">${totalShipped} player-visible changes across ${allDays.length} active days, ${filtered} internal-only commits filtered out</div>
  </nav>

  <main class="main">
  <!-- GATING OFF (director, 2026-07-30): the log is public so testers with no
       account can reach it. Sign-in above still works. To re-gate later, flip
       GATING_ENABLED to true in the script at the bottom of this file, it
       already hides everything inside .gated-section behind the same
       getUser() check the authbar uses, no template change required. -->
  <div class="gated-section" id="gated-content">

  <section id="shipped">
    <div class="rule"></div>
    <h2 class="chroma">Shipped</h2>
    <p class="lede">Two ways to read it. Concise is Kevin's own notes, written for players. Full is the raw
      engineering log, generated straight from git, unedited, so a curious player can see everything.</p>

    <div class="viewtoggle" role="tablist">
      <button class="vtab is-active" data-view="concise" type="button" role="tab" aria-selected="true">Concise</button>
      <button class="vtab" data-view="full" type="button" role="tab" aria-selected="false">Full log</button>
    </div>

    <div class="viewpane" id="view-concise">
      ${notes.length ? notes.map(noteCard).join('') : '<p class="lede">No notes yet. Check back after the next build.</p>'}
    </div>

    <div class="viewpane" id="view-full" hidden>
      <div class="filters" id="kind-filters">
        <button class="chipf is-active" data-kind="all" type="button">All</button>
        ${Object.entries(KIND_LABEL).map(([k, label]) => `<button class="chipf" data-kind="${k}" type="button">${esc(label)}</button>`).join('')}
      </div>
      ${fullFeed.map(([date, changes]) => dayBlock(date, changes)).join('')}
      ${allDays.length > LOG_DAYS_CAP ? `<p class="lede">${allDays.length - LOG_DAYS_CAP} earlier active days not shown here.</p>` : ''}
    </div>
  </section>

  <section id="bugs">
    <div class="rule"></div>
    <h2 class="chroma">Known bugs</h2>
    <p class="lede">${esc(bugFraming)}</p>
    <div class="chips bugtotals">
      <span class="chip">fixed <b>${totalFixedBugs ?? '?'}</b></span>
      <span class="chip">open <b>${totalOpenBugs}</b></span>
    </div>
    <div class="bugareas">
      ${bugAreaCounts.map((a) => `<div class="bugarea"><span class="bugarea-count">${a.count}</span><span class="bugarea-name">${esc(a.area)}</span></div>`).join('')}
    </div>
    <div class="bugseverity">
      ${bugSeverityCounts.map((s) => `<span>${esc(s.label)} <b>${s.count}</b></span>`).join('')}
    </div>
  </section>

  ${ownerBugSection}

  <section id="flight">
    <div class="rule"></div>
    <h2 class="chroma">In flight</h2>
    <p class="lede">What is actively being built, live from the campaign that drives the work.</p>
    <div class="arcs">${arcCards(arcs)}${backlogTeasers.map(flightCard).join('')}</div>
  </section>

  </div>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(buildStamp)} from <code>main@${esc(headSha)}</code>.
  ${live ? `Live build <code>${esc(live.sha)}</code>${live.sha === headSha ? ' (current)' : ' (a deploy is pending)'}.`
         : 'Live build could not be reached at generation time, so no live sha is claimed.'}
</footer>

${AUTH_SCRIPT()}
<script type="module">
// GATING SWITCH (director, 2026-07-30): the log is public for now, so testers
// can reach it without an account. Sign-in still works above, it just is not
// required to read anything below. This value is set from the same
// GATING_ENABLED at the top of bin/generate.mjs, one flag, flipped in one
// place. Flip it there and regenerate: applyGating() starts hiding
// #gated-content until getUser() returns a signed-in user, the same session
// auth.js already exposes, no template rewrite needed.
const GATING_ENABLED = ${GATING_ENABLED};
function applyGating(user) {
  const el = document.getElementById('gated-content');
  if (!el) return;
  const locked = GATING_ENABLED && user === null;
  el.style.display = locked ? 'none' : '';
}
document.addEventListener('whomp-auth', (e) => applyGating(e.detail));
applyGating(window.__whompUser ?? null);

// OWNER-ONLY VIEW (dark). #owner-bugs only exists in this document at all
// when GATING_ENABLED was true when bin/generate.mjs ran (see ownerBugSection
// there), so while gating is off there is no element here to find and this
// check is a no-op. When it does exist, it still starts hidden and only this
// check reveals it, to the one signed-in identity that matches OWNER_EMAIL.
// Reminder for later, from the generator comment: this is a UI convenience on
// a static host, not real access control, every generated file is reachable
// by its own URL regardless of sign-in state.
const OWNER_EMAIL = ${JSON.stringify(OWNER_EMAIL)};
function applyOwnerGate(user) {
  const el = document.getElementById('owner-bugs');
  if (!el) return;
  const visible = GATING_ENABLED && !!user && user.email === OWNER_EMAIL;
  el.hidden = !visible;
}
document.addEventListener('whomp-auth', (e) => applyOwnerGate(e.detail));
applyOwnerGate(window.__whompUser ?? null);

// ---- view toggle (concise / full) ----
const vtabs = document.querySelectorAll('.vtab');
const panes = { concise: document.getElementById('view-concise'), full: document.getElementById('view-full') };
vtabs.forEach((tab) => tab.addEventListener('click', () => {
  vtabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
  tab.classList.add('is-active'); tab.setAttribute('aria-selected', 'true');
  const view = tab.dataset.view;
  Object.entries(panes).forEach(([k, el]) => { if (el) el.hidden = k !== view; });
}));

// ---- kind filters (full view only) ----
const kindChips = document.querySelectorAll('#kind-filters .chipf');
kindChips.forEach((chip) => chip.addEventListener('click', () => {
  kindChips.forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  const kind = chip.dataset.kind;
  document.querySelectorAll('#view-full .row[data-kind]').forEach((row) => {
    row.dataset.hidden = (kind !== 'all' && row.dataset.kind !== kind) ? '1' : '0';
  });
}));

// ---- spoiler reveal ----
function toggleSpoiler(el) { el.classList.toggle('revealed'); }
document.addEventListener('click', (e) => {
  const t = e.target.closest('.spoiler');
  if (t) toggleSpoiler(t);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('spoiler')) {
    e.preventDefault();
    toggleSpoiler(e.target);
  }
});

// ---- search, over the generated index: notes, changes, bugs, arcs, in-flight ----
const searchInput = document.getElementById('search');
const srPanel = document.getElementById('sr-panel');
let searchIndex = [];
fetch('./search-index.json').then((r) => r.ok ? r.json() : []).then((data) => { searchIndex = data; }).catch(() => { searchIndex = []; });

function renderResults(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) { srPanel.classList.remove('open'); srPanel.innerHTML = ''; return; }
  const hits = searchIndex.filter((it) => (it.title + ' ' + it.text).toLowerCase().includes(q)).slice(0, 30);
  if (hits.length === 0) {
    srPanel.innerHTML = '<div class="sr-empty">No matches.</div>';
  } else {
    srPanel.innerHTML = hits.map((it) => \`<a class="sr-item" href="#\${it.anchor}"><span class="sr-kind">\${it.type}</span><span class="sr-title">\${it.title}</span></a>\`).join('');
  }
  srPanel.classList.add('open');
}
searchInput.addEventListener('input', (e) => renderResults(e.target.value));
searchInput.addEventListener('focus', (e) => { if (e.target.value.trim().length >= 2) renderResults(e.target.value); });
document.addEventListener('click', (e) => { if (!e.target.closest('.searchwrap')) srPanel.classList.remove('open'); });
srPanel.addEventListener('click', (e) => {
  const a = e.target.closest('.sr-item');
  if (!a) return;
  srPanel.classList.remove('open');
  // if the anchor is inside the full log, switch to that view first
  const id = a.getAttribute('href').slice(1);
  const target = document.getElementById(id);
  if (target && panes.full && panes.full.contains(target)) {
    vtabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelector('.vtab[data-view="full"]').classList.add('is-active');
    panes.concise.hidden = true; panes.full.hidden = false;
    document.querySelectorAll('#view-full .row[data-kind]').forEach((row) => { row.dataset.hidden = '0'; });
    kindChips.forEach((c) => c.classList.toggle('is-active', c.dataset.kind === 'all'));
  }
});
</script>
</body>
</html>`;

// ---------------------------------------------------------------- search index
/* One small JSON file, built at generate time, over everything the page
 * shows: notes, the full commit feed, known bugs, arcs and in-flight work.
 * Loaded client-side and filtered live. No service, no dependency.
 *
 * KNOWN BUGS gets exactly one aggregate entry, counts only, same as the
 * public section itself. Per-report text (what/why/evidence) NEVER goes in
 * here, not even inside a GATING_ENABLED check: this file is a static asset
 * fetched with a plain, unauthenticated request, so anything written into it
 * ships to every visitor regardless of sign-in state. The owner-only detail
 * lives only in ownerBugSection's HTML (itself gated at build time), never in
 * this JSON. */
const searchIndex = [];
for (const n of notes) {
  const anchor = `note-${n.date}`;
  searchIndex.push({ type: 'note', title: n.title, text: n.intro.join(' ').replace(/[*|]/g, ''), anchor });
  for (const b of n.buckets) {
    for (const block of b.blocks) {
      searchIndex.push({ type: b.name.toLowerCase(), title: n.title, text: block.replace(/[*|]/g, '').slice(0, 200), anchor });
    }
  }
}
for (const [, changes] of allDays) {
  for (const c of changes) {
    searchIndex.push({ type: 'change', title: c.text, text: `${c.kind} ${c.scope}`, anchor: `chg-${c.sha}` });
  }
}
searchIndex.push({
  type: 'bugs',
  title: 'Known bugs',
  text: `${totalFixedBugs ?? '?'} fixed, ${totalOpenBugs} open. ${bugAreaCounts.map((a) => `${a.area} ${a.count}`).join(', ')}`,
  anchor: 'bugs',
});
for (const a of arcs) {
  searchIndex.push({ type: 'arc', title: `${a.id} ${a.name}`, text: a.what, anchor: `flight-${slug(a.name)}` });
}
for (const t of backlogTeasers) {
  searchIndex.push({ type: 'in flight', title: t.name, text: t.blurb, anchor: `flight-${slug(t.name)}` });
}

// ---------------------------------------------------------------- write
writeFileSync(join(OUTDIR, 'index.html'), indexHtml);
writeFileSync(join(OUTDIR, 'log.html'), logHtml);
writeFileSync(join(OUTDIR, 'search-index.json'), JSON.stringify(searchIndex));

console.log(`wrote index.html, log.html, search-index.json to ${OUTDIR}`);
console.log(`  main@${headSha}  live=${live ? live.sha : 'unreachable'}`);
console.log(`  ${totalShipped} player-visible changes across ${allDays.length} days (${filtered} noise commits filtered)`);
console.log(`  ${arcs.length} arcs, ${backlogTeasers.length} backlog teasers, ${openBugs.length} open bugs, ${notes.length} authored notes`);
console.log(`  search index: ${searchIndex.length} entries`);

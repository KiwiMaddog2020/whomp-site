#!/usr/bin/env node
/** THE WHOMP SITE GENERATOR — the generated spine.
 *
 *  A12's founding decision was "generated spine, authored highlights": a job
 *  derives deploys, the live sha and the campaign arcs FROM THE REPO, so the
 *  site cannot go stale or lie, and Kevin writes a short human note on top.
 *  This is the derive half. Everything it prints is traceable to git, to
 *  version.json, or to docs/CAMPAIGN.md in the game repo.
 *
 *  IT NEVER TOUCHES THE GAME REPO. It reads. The site lives in its own repo on
 *  GitHub Pages precisely so a site edit can never bump the game's build sha,
 *  which the net handshake compares EXACTLY and which would lock out every peer
 *  mid-session.
 *
 *  USAGE: node bin/generate.mjs [--repo ../whomp] [--out index.html] [--offline]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const REPO = resolve(arg('--repo', '../whomp'));
const OUT = arg('--out', 'index.html');
const OFFLINE = args.includes('--offline');
const LIVE_URL = 'https://kiwimaddog2020.github.io/whomp-play';

const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- derive: identity ---------- */
const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
const headSha = git('rev-parse', '--short', 'main');

/* ---------- derive: what is actually live ---------- */
/* The live sha is the ONLY proof of live (deploy-verification law), so the site
 * reports it as measured, and says so plainly when it could not measure it. */
let live = null;
if (!OFFLINE) {
  try {
    const r = await fetch(`${LIVE_URL}/version.json`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) live = await r.json();
  } catch { /* offline build; the page says so rather than inventing a sha */ }
}

/* ---------- derive: the shipped feed ---------- */
/* Conventional-commit subjects are the source. Docs/chore/test commits are not
 * player-visible and are filtered out, so the feed reads as changes rather than
 * as a commit log. The count of what was filtered is kept and shown, because a
 * silently truncated feed reads as "that was everything" when it was not. */
const RAW = git('log', 'main', '--date=short', '--pretty=%h\x1f%ad\x1f%s', '-n', '600').split('\n');
const PLAYER_VISIBLE = /^(feat|fix|balance|perf|style)(\(|:)/;
const NOISE = /^(docs|chore|test|refactor|merge|revert)(\(|:)/i;

const days = new Map();
let filtered = 0;
for (const line of RAW) {
  const [sha, date, subject] = line.split('\x1f');
  if (!subject) continue;
  if (!PLAYER_VISIBLE.test(subject)) { if (NOISE.test(subject)) filtered++; continue; }
  const m = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!m) continue;
  if (!days.has(date)) days.set(date, []);
  days.get(date).push({ sha, kind: m[1], scope: m[2] || '', text: m[3] });
}
const feed = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
/* A burst day can carry 150+ player-visible changes, which is a wall rather than a
 * feed. Cap the rows and SAY what was dropped: a silently truncated list reads as
 * "that was everything" when it was not (no-silent-caps law). */
const PER_DAY = 14;

/* ---------- derive: the arcs, from CAMPAIGN ---------- */
/* CAMPAIGN.md IS the train. Parsing its ARCS block keeps one source of truth
 * rather than a second hand-maintained roadmap that drifts within a week. */
let arcs = [];
const campaignPath = join(REPO, 'docs/CAMPAIGN.md');
if (existsSync(campaignPath)) {
  const c = readFileSync(campaignPath, 'utf8');
  const block = c.split(/^## ARCS$/m)[1]?.split(/^## /m)[0] ?? '';
  arcs = [...block.matchAll(/^- (A\d+) ([^:(]+?)(?:\s*\(([^)]+)\))?:\s*(.+)$/gm)]
    .map((m) => ({ id: m[1], name: m[2].trim(), when: (m[3] || '').trim(), what: m[4].trim() }));
}

const totalShipped = [...days.values()].reduce((n, d) => n + d.length, 0);
const buildStamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

/* ---------- the W, lifted verbatim from public/icons/icon.svg ----------
 * Same geometry, same chromatic offsets, same cream face. The icon IS the
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

const KIND_INK = { feat: '--cyan', fix: '--pink', balance: '--violet', perf: '--gold', style: '--gold' };

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP — ${esc(pkg.description ?? 'a 3D horde-survivor')}</title>
<meta name="description" content="${esc(pkg.description ?? '')} Built in the open, with the defect ledger published.">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#06040e"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${W_PATH}" stroke="#24f0ff" stroke-width="59" transform="translate(14,26)"/><path d="${W_PATH}" stroke="#ff2f7e" stroke-width="59" transform="translate(-16,16)"/><path d="${W_PATH}" stroke="#fff3cf" stroke-width="59"/></g></svg>`)}">
<style>
/* THE PALETTE IS THE APP ICON'S, AT FULL SATURATION, ON DARK.
   Director ruling: candy pastels and four pink-free alternatives were rejected.
   The pink is load-bearing in the blend, so it is never desaturated or replaced. */
:root{
  --ink:#06040e; --lift:#1e0e2a; --outline:#151023;
  --pink:#ff2f7e; --cyan:#24f0ff; --violet:#b14bff; --gold:#ffcf3f;
  --cream:#fff3cf; --body:#cfc6dd; --dim:#8d84a1;
  --sweep:linear-gradient(90deg,var(--pink),var(--cyan));
  --font:'Segoe UI',system-ui,-apple-system,sans-serif;
  --edge:1px solid rgba(255,243,207,.10);
}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:radial-gradient(ellipse 120% 80% at 50% -10%,var(--lift),var(--ink) 60%) no-repeat,var(--ink);
  color:var(--body); font-family:var(--font); line-height:1.6;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
.wrap{max-width:860px;margin:0 auto;padding:0 24px 96px}
a{color:var(--cyan)}

/* THE CHROMATIC OFFSET IS THE SIGNATURE, carried from the icon to type:
   cyan right-and-down, pink left-and-down, cream face on top. Flat offsets,
   zero blur, matching the de-BOO flat-plinth doctrine the game already uses. */
.chroma{
  color:var(--cream); font-weight:800; letter-spacing:-.02em;
  text-shadow:.055em .05em 0 var(--cyan), -.055em .035em 0 var(--pink);
}

header{padding:72px 0 40px;text-align:center}
.wm{display:block;margin:0 auto 22px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.45))}
h1{font-size:clamp(3rem,13vw,6rem);margin:0;line-height:.95}
.tag{font-size:clamp(1.05rem,3.2vw,1.3rem);color:var(--body);margin:18px auto 0;max-width:34ch}

.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:26px}
.chip{
  display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;
  border:var(--edge);background:rgba(255,243,207,.04);font-size:.82rem;color:var(--body);
  font-variant-numeric:tabular-nums;
}
.chip b{color:var(--cream);font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 3px rgba(36,240,255,.16)}
.dot.stale{background:var(--gold);box-shadow:0 0 0 3px rgba(255,207,63,.16)}

.cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.btn{
  display:inline-block;padding:13px 26px;border-radius:12px;text-decoration:none;
  font-weight:700;color:var(--ink);background:var(--sweep);
  box-shadow:0 4px 0 #7a1440; transition:transform .12s ease,box-shadow .12s ease;
}
.btn:hover{transform:translateY(2px);box-shadow:0 2px 0 #7a1440}
.btn.ghost{background:none;color:var(--cream);border:var(--edge);box-shadow:0 4px 0 rgba(0,0,0,.4)}

h2{font-size:1.65rem;margin:0 0 6px}
section{margin-top:64px}
.lede{color:var(--dim);margin:0 0 22px;font-size:.95rem}

.rule{height:3px;border-radius:2px;background:var(--sweep);opacity:.85;margin-bottom:26px;max-width:120px}

.day{border:var(--edge);border-radius:14px;padding:18px 20px;margin-bottom:14px;background:rgba(255,243,207,.025)}
.day h3{margin:0 0 12px;font-size:.9rem;color:var(--dim);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.row{display:flex;gap:12px;padding:7px 0;border-top:1px solid rgba(255,243,207,.06);align-items:baseline}
.row:first-of-type{border-top:0}
.kind{
  flex:none;font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  padding:3px 8px;border-radius:6px;min-width:64px;text-align:center;color:var(--ink);
}
.what{flex:1}
.what .scope{color:var(--dim);font-size:.86rem}
.sha{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem;color:var(--dim)}
.row.more{color:var(--dim);font-size:.83rem;font-style:italic;justify-content:center}

.arcs{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.arc{border:var(--edge);border-radius:14px;padding:16px 18px;background:rgba(255,243,207,.025)}
.arc .id{color:var(--gold);font-weight:800;font-size:.8rem;letter-spacing:.06em}
.arc h4{margin:4px 0 6px;color:var(--cream);font-size:1rem}
.arc p{margin:0;font-size:.88rem;color:var(--dim)}

/* GATED: the shape is real even though the auth wiring is not landed here yet.
   Deploy 46 ships the sign-in UI, so this is the surface it plugs into. */
.gate{border:var(--edge);border-radius:16px;padding:26px;background:
  linear-gradient(180deg,rgba(177,75,255,.07),rgba(255,47,126,.04));text-align:center}
.gate ul{list-style:none;padding:0;margin:18px 0;display:grid;gap:9px;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));text-align:left}
.gate li{padding:11px 14px;border:var(--edge);border-radius:10px;font-size:.88rem;
  background:rgba(6,4,14,.5);color:var(--dim)}
.gate li b{display:block;color:var(--cream);font-size:.94rem;font-weight:700;margin-bottom:2px}
.lock{opacity:.5;font-size:.8rem}

footer{margin-top:80px;padding-top:24px;border-top:var(--edge);color:var(--dim);font-size:.82rem;text-align:center}
footer code{color:var(--body)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="wrap">

<header>
  ${wordmark(112, 'h')}
  <h1 class="chroma">WHOMP</h1>
  <p class="tag">${esc(pkg.description ?? '')}</p>
  <div class="chips">
    <span class="chip"><span class="dot${live && live.sha === headSha ? '' : ' stale'}"></span>
      ${live ? `live <b>${esc(live.sha)}</b>` : 'live build <b>unverified</b>'}</span>
    <span class="chip">version <b>${esc(live?.version ?? pkg.version)}</b></span>
    <span class="chip"><b>${totalShipped}</b> player-visible changes, last ${feed.length} active days</span>
  </div>
  <div class="cta">
    <a class="btn" href="${LIVE_URL}/">Play the current build</a>
    <a class="btn ghost" href="#shipped">See what shipped</a>
  </div>
</header>

<section>
  <div class="rule"></div>
  <h2 class="chroma">Built in the open</h2>
  <p>WHOMP is a 3D horde-survivor built by one person and a crew of AI agents, shipping
  several times a day to a small circle of testers. The unusual part is not the speed.
  It is that the development log below is generated straight from the repository, so it
  reports what actually shipped rather than what we meant to ship, including the fixes
  that were embarrassing.</p>
  <p>Almost no studio publishes its real defect ledger. We do, because the ledger is the
  most honest thing we have and it is the reason the game gets better this fast.</p>
</section>

<section id="shipped">
  <div class="rule"></div>
  <h2 class="chroma">What shipped</h2>
  <p class="lede">Derived from the repository at build time. Player-visible changes only:
  ${filtered} docs, chore, test and refactor commits are filtered out of this view.</p>
  ${feed.map(([date, items]) => `
  <div class="day">
    <h3>${esc(date)} &middot; ${items.length} change${items.length === 1 ? '' : 's'}</h3>
    ${items.slice(0, PER_DAY).map((it) => `
    <div class="row">
      <span class="kind" style="background:var(${KIND_INK[it.kind] ?? '--cyan'})">${esc(it.kind)}</span>
      <span class="what">${esc(it.text)}${it.scope ? ` <span class="scope">(${esc(it.scope)})</span>` : ''}</span>
      <span class="sha">${esc(it.sha)}</span>
    </div>`).join('')}
    ${items.length > PER_DAY ? `<div class="row more">and ${items.length - PER_DAY} more that day</div>` : ''}
  </div>`).join('')}
</section>

${arcs.length ? `
<section>
  <div class="rule"></div>
  <h2 class="chroma">What we are building</h2>
  <p class="lede">The live arcs, parsed from the campaign file that actually drives the work.</p>
  <div class="arcs">
    ${arcs.map((a) => `
    <div class="arc">
      <div class="id">${esc(a.id)}${a.when ? ` &middot; ${esc(a.when)}` : ''}</div>
      <h4>${esc(a.name)}</h4>
      <p>${esc(a.what)}</p>
    </div>`).join('')}
  </div>
</section>` : ''}

<section>
  <div class="rule"></div>
  <h2 class="chroma">For testers</h2>
  <div class="gate">
    <p style="margin:0;color:var(--cream);font-weight:600">Sign in to see the rest</p>
    <ul>
      <li><b>The upcoming train</b> What is queued, in order</li>
      <li><b>Known bugs</b> The open defect ledger</li>
      <li><b>In flight now</b> What the lanes are building</li>
      <li><b>Your ledger</b> Every report you filed and what it changed</li>
    </ul>
    <p class="lock">Sign-in uses the same account as the game, so one identity spans both.</p>
  </div>
</section>

<footer>
  Generated ${esc(buildStamp)} from <code>main@${esc(headSha)}</code>.
  ${live ? `Live build <code>${esc(live.sha)}</code>${live.sha === headSha ? ' (current)' : ' (a deploy is pending)'}.`
         : 'Live build could not be reached at generation time, so no live sha is claimed.'}
</footer>

</div>
</body>
</html>`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT}`);
console.log(`  main@${headSha}  live=${live ? live.sha : 'unreachable'}`);
console.log(`  ${totalShipped} player-visible changes across ${feed.length} days (${filtered} noise commits filtered)`);
console.log(`  ${arcs.length} arcs parsed from CAMPAIGN.md`);

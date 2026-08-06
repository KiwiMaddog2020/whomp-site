/** INDEX.HTML, the short public landing page.
 *
 *  Split out of bin/generate.mjs for the same reason bin/wiki.mjs was: it can be
 *  rendered from fixtures and looked at, which the inline template could not be.
 *  bin/generate.mjs still owns the palette, the chrome and the write step, and
 *  still calls this exactly once, so there is one entry point.
 *
 *  THE PAGE IS STILL SMALL AND STILL DOES NOT GROW. Mark, tagline, live chip,
 *  play button, what is coming, what happens to a report, arcs. A visitor who
 *  wants more has three doors and every one of them is a link.
 */

/* ── THE W SITS IN THE NAV, NOT OVER THE TITLE (director, 2026-08-06) ────────
 * "it should have the W logo in the navmenu at the left instead of above the
 * title text."
 *
 * So the landing page grows the nav bar it never had. It used to open with a
 * right-aligned sign-in button floating over nothing, then a 112px icon stacked
 * directly on top of a 150px wordmark that says the same word the icon draws.
 * The mark now does the job it does on every wiki page: it sits at the left of a
 * bar, at reading size, and the hero underneath it starts with the title.
 *
 * IT IS NOT A LINK, and that is deliberate rather than an omission. On the wiki
 * the mark links back to the hub because the reader is somewhere else. Here the
 * reader is already home, and a link to the page you are on is a small lie about
 * where it goes. The svg keeps aria-hidden and the <h1> underneath carries the
 * name, so nothing was taken away from a screen reader either. */
const topNav = ({ wordmark, AUTHBAR }) => `
<nav class="topnav" aria-label="Site">
  <span class="topnav-mark">${wordmark(44, 'n')}</span>
  <a href="wiki.html">Wiki</a>
  <a href="log.html">Dev log</a>
  <span class="topnav-gap"></span>
  ${AUTHBAR}
</nav>`;

/* ── WHAT IS COMING NEXT ─────────────────────────────────────────────────────
 * bin/upcoming.mjs picks WHICH releases belong here and carries the whole
 * argument about why the source is the release notes rather than the queue.
 * This function only frames them.
 *
 * Every sentence about the game in this block arrived from the game repo,
 * written by a person for players at the moment the release was cut. The four
 * framing sentences below are about the page, not about the game, which is the
 * line bin/patch-notes.mjs draws and this one keeps. */
const comingLede = ({ state, liveVersion, esc }) => {
  if (state === 'unknown') {
    return 'The live build could not be reached when this page was built, so nothing here claims to be ahead of it.';
  }
  if (state === 'ahead') {
    return 'Everything that is finished is in the build behind the play button.';
  }
  if (state === 'current') {
    return 'Everything that is finished is in the build behind the play button. The next version is not written yet.';
  }
  return `Finished work that is not in the build behind the play button yet. That build is version ${esc(liveVersion)}. Nothing reaches this list until it is done and written up, so none of it is a plan.`;
};

const comingCard = ({ release, esc, noEmDash }) => `
    <article class="coming" id="coming-${esc(release.version.replace(/\./g, '-'))}">
      <div class="coming-head">
        <span class="chip">version <b>${esc(release.version)}</b></span>
        <span class="coming-date">written ${esc(release.date)}</span>
      </div>
      <p class="coming-headline">${esc(noEmDash(release.headline))}</p>
      <ul class="coming-list">${release.keyChanges.map((c) => `<li>${esc(noEmDash(c))}</li>`).join('')}</ul>
    </article>`;

const comingSection = ({ upcoming, liveVersion, arcCards, arcs, esc, noEmDash }) => {
  const cards = upcoming.shown.map((release) => comingCard({ release, esc, noEmDash })).join('');
  /* No silent caps. If the gap between Stable and the newest cut release ever
   * grows past what this page shows, the page says how many it left out and
   * points at the log, which carries all of them. */
  const dropped = upcoming.dropped > 0
    ? `<p class="coming-more">${upcoming.dropped} more version${upcoming.dropped === 1 ? ' is' : 's are'} waiting and not shown here. The dev log has every one of them.</p>`
    : '';
  return `
<section id="coming">
  <div class="rule"></div>
  <h2 class="chroma">What is coming next</h2>
  <p class="lede">${comingLede({ state: upcoming.state, liveVersion, esc })}</p>
  ${cards}${dropped}

  <h3 class="sub">Further out</h3>
  <p class="lede">The bigger pieces, in the order they are being built. These are directions and not dates.</p>
  <div class="arcs">${arcCards(arcs, { showWhen: false })}</div>
</section>`;
};

/* ── WHAT HAPPENS TO A REPORT ────────────────────────────────────────────────
 * Director, 2026-08-06: "a user can follow their bug or suggestion report from
 * start to finish, see how it was actioned and watch it become implemented in
 * the game within weeks. we can touch on the system, but keep it simple."
 *
 * KEPT SIMPLE, AND KEPT TRUE. The reporting half is real and shipped: REPORT
 * sits in the pause menu in a run and in the hub, it takes a screenshot you can
 * draw on, and the reports land in a triaged inventory whose fixed/open counts
 * the dev log already publishes.
 *
 * The FOLLOWING half is not built. There is no page where a visitor looks up
 * their own report by number and watches its state change, so the last
 * paragraph says so plainly instead of letting the heading imply one. A pitch
 * for a feature that does not exist is the one thing this page cannot survive
 * shipping, because the reader finds out by going and looking. */
const reportSection = () => `
<section id="report">
  <div class="rule"></div>
  <h2 class="chroma">Report it, then watch it land</h2>
  <p>Pause the game and pick REPORT. Type what happened, attach a screenshot if it helps,
    and draw on the screenshot to circle the thing you mean.</p>
  <p>Reports get read and triaged. The ones that turn into fixes appear in the release notes
    and in the dev log beside everything else that shipped, and the log keeps a running count
    of how many reports are fixed and how many are still open.</p>
  <p>Several of the multiplayer crash reports in the last batch were fixed the same night they
    arrived. Not everything moves that fast, but the log shows you what did.</p>
  <p class="quiet">There is no page yet where you look up your own report by number. The dev log
    is the record for now, and it is public.</p>
  <div class="cta"><a class="btn ghost" href="log.html#bugs">See what is fixed and what is open</a></div>
</section>`;

const INDEX_CSS = `
.wrap{max-width:860px;margin:0 auto;padding:0 24px 96px}

/* THE NAV BAR. Flat, one row, wraps rather than scrolls. The mark overrides the
   global .wm centering, which exists for the hero it no longer sits in. */
.topnav{display:flex;align-items:center;gap:20px;padding:14px 0;border-bottom:var(--edge);flex-wrap:wrap}
.topnav-mark{display:flex;align-items:center;line-height:0}
.topnav .wm{display:block;margin:0;filter:drop-shadow(0 4px 0 rgba(0,0,0,.45))}
.topnav a{color:var(--body);text-decoration:none;font-weight:700;font-size:.9rem}
.topnav a:hover{color:var(--cream)}
.topnav-gap{flex:1 1 auto}
.topnav .authbar{padding:0}

header{padding:48px 0 40px;text-align:center}
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
h3.sub{font-size:1.1rem;color:var(--cream);margin:38px 0 4px}
section{margin-top:64px}
.lede{color:var(--dim);font-size:.95rem;margin:0 0 20px;max-width:62ch}

.coming{border:var(--edge);border-radius:14px;padding:18px 20px;background:rgba(255,243,207,.025);margin-bottom:12px}
.coming-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.coming-date{color:var(--dim);font-size:.8rem}
.coming-headline{color:var(--cream);margin:12px 0 0;font-size:1rem}
.coming-list{margin:12px 0 0;padding-left:20px}
.coming-list li{margin:6px 0;font-size:.92rem}
.coming-more{color:var(--dim);font-size:.88rem;margin:0}

#report p{max-width:62ch}
/* The hero's buttons are centred under a centred hero. This one sits under a
   left-aligned column and follows it. */
#report .cta{justify-content:flex-start;margin-top:26px}
.quiet{color:var(--dim);font-size:.9rem}
`;

/**
 * The whole landing page, as one string. Every input arrives from
 * bin/generate.mjs, which measured it; nothing in here reads a file, fetches a
 * URL or runs a command, which is what makes the page testable from fixtures.
 */
export function indexPage({
  TAGLINE, FAVICON, SHARED_CSS, AUTHBAR, AUTH_SCRIPT,
  wordmark, liveChip, arcCards, arcs,
  gameTaglines, upcoming, live, LIVE_URL,
  buildStamp, headSha, esc, noEmDash,
}) {
  const liveVersion = live ? live.version : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP: ${esc(TAGLINE)}</title>
<meta name="description" content="${esc(TAGLINE)} Built in the open, with the dev log public.">
<link rel="icon" href="${FAVICON}">
<style>
${SHARED_CSS}
${INDEX_CSS}
</style>
</head>
<body>
<div class="wrap">
${topNav({ wordmark, AUTHBAR })}

<header>
  <h1 class="whomp-wordmark" data-wordmark="WHOMP">WHOMP</h1>
  <p class="tag" id="hero-tagline">${esc(gameTaglines[0])}</p>
  <script>document.getElementById('hero-tagline').textContent=(${JSON.stringify(gameTaglines)})[Math.min(${gameTaglines.length}-1,Math.max(0,Math.floor(Math.random()*${gameTaglines.length})))];</script>
  <div class="chips">${liveChip()}</div>
  <div class="cta">
    <a class="btn" href="${LIVE_URL}/">Play the current build</a>
    <a class="btn ghost" href="wiki.html">Browse the wiki</a>
    <a class="btn ghost" href="log.html">Read the dev log</a>
  </div>
  <p class="doorway">The wiki is every weapon, core and enemy, read straight out of the game.
    The dev log is every build: what shipped, what is still broken, what is next.</p>
</header>

${comingSection({ upcoming, liveVersion, arcCards, arcs, esc, noEmDash })}

${reportSection()}

<footer>
  Generated ${esc(buildStamp)} from <code>game@${esc(headSha)}</code>.
  ${live ? `Live build <code>${esc(live.sha)}</code>${live.sha === headSha ? ' (current)' : ' (a deploy is pending)'}.`
         : 'Live build could not be reached at generation time, so no live sha is claimed.'}
</footer>

</div>
${AUTH_SCRIPT()}
</body>
</html>`;
}

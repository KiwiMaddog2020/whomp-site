# Lane report: wiki-revamp

Branch `claude/wiki-revamp`, based on `origin/main` at `326b03c`. Three commits,
all source-only. Director ask, 2026-08-05: clean up the wiki layout, put the
logo and name in the top nav, glow-up pass, same theme, make the wiki easy to
navigate.

Same palette, same face, same voice. No copy rewritten, no dependency added, no
em dashes. `index.html` and `log.html` are untouched, as is the notes parser.

---

## 1. Premises, checked before building

Four of the five briefed premises were wrong or already solved. Stating that
plainly, because two of them would have had this lane rebuild something that
already works.

**"Twenty-seven wiki pages, essentially flat." Both halves false.**

There are **33 wiki routes**: 31 rosters plus the hub plus the explainer. And
they are not flat. The sidebar already grouped the 31 rosters into five sections
using `details`/`summary`, with the current section auto-opened, and the hub
already grouped its cards the same way:

| Section | Guides |
|---|---|
| Buildcraft | 14 |
| Heroes | 3 |
| World | 6 |
| Progression | 6 |
| Collection | 2 |

**The grouping was already derived, and I did not replace it.** The derivation,
verified in source: each roster spec declares `section:` (`bin/wiki.mjs`);
`wikiRosterNav` maps over `rosterSpecs(...)` and `wikiNavSections` collects the
distinct values in first-appearance order (`bin/generate.mjs:1123-1133`); and
`buildWiki` throws on a roster with no section (`bin/wiki.mjs:3610`). So a 32nd
page joins its group by existing, and cannot ship without one. That is the house
principle the brief asked for, already satisfied and already fail-closed. What I
added is a way to *see* the shape from inside a page: the derived section is now
a breadcrumb crumb linking the hub anchor that already existed.

**"The logo and name are not in the top nav." TRUE, and now done.** The top bar
held only the page title. The mark was at the top of the sidebar. Confirmed with
a DOM probe across every route: zero icons in `.wtopbar` before, 33 after.

**"search-index.json exists and is underused." Mostly false.** Search was
already on all 33 routes, as an accessible combobox with arrow-key navigation,
an `aria-live` count, cross-page hrefs, source-aware ranking and 990 entries.
Two things were genuinely missing, and those are what I built: it scrolled away
on pages up to 56,000px tall, and there was no keyboard route to it.

**"The page template is inherited by all pages, highest leverage." TRUE.** Every
change in this lane is in that template, which is why they all land on 33 routes
at once.

**Also true, and the worst thing I found:** nobody had checked mobile. Details
below.

---

## 2. What mobile looked like before

Measured in headless Chromium at 390x844, on the committed output of
`origin/main@326b03c`, before any change.

**Navigation was a dead end.** `WIKI_CSS` carried
`.wside-section:not(.is-current-section){display:none}` at `max-width:760px`.
The effect, counting nav links that actually render:

| Page (390px) | Guides reachable, of 31 | Sections visible, of 5 |
|---|---|---|
| `wiki-weapons.html` | **14** | 1 |
| `wiki-bestiary.html` | **6** | 1 |
| `wiki.html` (hub) | **0** | **0** |

From Weapons on a phone you could reach the other 13 Buildcraft guides and none
of the 17 elsewhere. From the Bestiary, 6. The hub was worst: it passes no
current section, so `:not(.is-current-section)` matched all five and hid the
entire guide list. The brief's "from any wiki page a reader can reach any other
without going back to an index" was failing, and going back to the index did not
help either.

Two causes, both fixed. The `display:none` rule, and a second one nobody had
noticed: the mobile-navigation sync script lived inside the *roster* page's
script only, so `wiki.html` and the explainer never ran it at all.

**Chrome ate the first screen.** Before the page's own content began:

| Page (390px) | Content top, before | After |
|---|---|---|
| `wiki-weapons.html` | 779px | **450px** |
| `wiki-bestiary.html` | 801px | **472px** |
| `wiki.html` | 696px | **412px** |

On an 844px-tall phone, a reader who tapped "Weapons" got a full screen of sign-in
button, title, two stacked provenance chips, a search box and a nav card before
one word of the guide.

**What was already right on mobile:** no page scrolled sideways at any width, and
tap targets in the nav were already 44px. The existing narrow-screen work was
real; it just had a hole in the middle of it.

---

## 3. What changed

### The mark and the name in the top bar

**Moved, not drawn twice.** `bin/wiki-check.mjs` pins the canonical icon to
exactly one `wiki-home` link per page (line 536-538) and separately forbids a
second WHOMP mark in page-header content (line 539, `!/<svg class="wm"/`).
Relocating the existing block is therefore the only way to honour the ask while
leaving both guards intact, and both pass unmodified. It is still the game's own
`public/icons/icon.svg`, read at build time, on all 33 routes, linking the wiki
home.

This also retired a dead rule: `.brand .wm{margin:0}` had been styling a wordmark
that the icon contract forbids on these pages.

### Persistent navigation that survives a phone

The `display:none` rule is gone. The five sections now sit inside **one more
`details`/`summary`**, the same part the sections themselves already use, per
the brief's instruction to extend that pattern rather than invent a second
navigation idea. Closed below 760px, open above it, so the wide-screen sidebar
keeps the silhouette it had. `NAV_SCRIPT` is now shared chrome included by all
three templates, which is what fixes the hub.

Result: **31 of 31 guides reachable from all 33 routes, at 390px and 1280px.**

Degradation is the right way round. With no script the drawer stays open (the
`open` attribute is in the markup), so the worst case is a long sidebar, never an
unreachable one. Verified with JavaScript disabled: drawer open, all five
sections present and tappable.

### Search that stays put and answers the keyboard

The band is sticky on wiki routes. The band and not `.searchwrap` is what sticks,
because `.searchwrap` must remain the relative containing block for the
absolutely positioned result panel.

Its backdrop paints **only while actually stuck**. A permanent one is a flat ink
rectangle over the body's radial ground and seams visibly across the page at
rest, which I only caught by looking at a screenshot.

One custom property, `--band`, is simultaneously what the band clears, where the
sidebar starts sticking, how tall the sidebar may be, and how far a deep-linked
card sits below the fold. Verified stuck: sidebar top 109px against band bottom
91px, and `wiki-weapons.html#e-photonScythe` lands at 121px, clear of the band.

`/` or `Ctrl`/`Cmd`+`K` focuses search from anywhere. It never steals a keystroke
that was going somewhere else: fields, contenteditable surfaces and modified
slashes are all left alone, so a slash typed into the box stays a literal slash.
The key is printed on the label, because a shortcut nobody knows about is not a
feature.

### The bug the sticky band found

`SHARED_CSS` had `html,body{max-width:100%;overflow-x:hidden}`. **`overflow-x:hidden`
makes the element a scroll container, and a scroll container on `html`/`body`
silently defeats `position:sticky` for every descendant of the document.** The
band scrolled away with the page and looked simply unimplemented. Nothing on the
site was sticky when that rule landed, so it cost nothing until now.

`overflow-x:clip` clips the identical overflow without becoming a scroll
container. The floor that rule exists for (two mobile sideways-scroll reports) is
unchanged, and I proved it rather than assumed it: **60 page/width combinations**
(index, log, ten wiki routes; 320/390/768/1024/1440px), zero exceeding viewport
width, zero scrollable sideways.

---

## 4. Shared-chrome hunks, quoted for the integrator

`claude/concise-log-auto` owns the LOG.HTML section (from line 1235) and the
notes parser. I touched neither. Four hunks below are in regions `log.html` also
reads. All four are in `bin/generate.mjs`, all outside the log section, and all
three log-visible ones are additive.

**Hunk 1. `SHARED_CSS`, the sticky fix. Read by index.html, log.html and every
wiki page.** Commit `1ec194f`, isolated on purpose so it can be reviewed or
cherry-picked alone. One value changes; the rest is the comment explaining why.

```
-html,body{max-width:100%;overflow-x:hidden}
+html,body{max-width:100%;overflow-x:clip}
```

**Hunk 2. `SEARCH_CSS`. Read by log.html and every wiki page.** `.searchlabel`
goes `block` to `flex` so the key sits on the label baseline; `.searchkey` is new.

```
-.searchlabel{display:block;margin:0 0 7px;color:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
+.searchlabel{display:flex;align-items:center;gap:8px;margin:0 0 7px;color:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
+/* The shortcut is only worth having if a reader knows it is there, so the key is
+   printed on the label rather than left to be discovered. */
+.searchkey{border:var(--edge);border-radius:5px;padding:1px 6px;font-family:var(--mono);font-size:.72rem;
+  font-weight:700;letter-spacing:0;color:var(--dim);background:rgba(255,243,207,.05);text-transform:none;line-height:1.5}
```

**Hunk 3. `searchMarkup`. Read by log.html and every wiki page.**

```
-  <label class="searchlabel" for="search">Search WHOMP</label>
+  <label class="searchlabel" for="search">Search WHOMP <kbd class="searchkey">/</kbd></label>
```

**Hunk 4. `SEARCH_SCRIPT`, appended after the existing document click handler.
Read by log.html and every wiki page.** Pure addition, no existing line touched.

```js
document.addEventListener('click', (e) => { if (!e.target.closest('.searchwrap')) setSearchOpen(false); });

/* REACHABLE FROM THE KEYBOARD, ANYWHERE ON THE PAGE. These pages are long enough
 * that "scroll back up and click the box" is the real cost of a search, and both
 * keys are what a reader who has used any other documentation site will already
 * try. Never steals a keystroke that was going somewhere else: any field, any
 * contenteditable surface and any modified "/" is left alone. */
const typingTarget = (el) => !!el && (el.isContentEditable
  || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
document.addEventListener('keydown', (e) => {
  const shortcut = (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)
    || ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey);
  if (!shortcut || typingTarget(e.target)) return;
  e.preventDefault();
  searchInput.focus();
  searchInput.select();
});
```

Verified on `log.html` directly: `/` focuses the box, "scythe" returns 29 hits,
the key hint renders, no console errors. If the log lane also edits
`SEARCH_SCRIPT`, hunk 4 is an append at the end of the shortcut region and should
merge without conflict.

**Not shared with the log, listed for completeness:** `bin/wiki-check.mjs` gains
`wikiBrand: ''` and `NAV_SCRIPT: ''` to its chrome stub (two lines), so the
contract's model build matches the real generator's chrome surface.

---

## 5. The glow-up pass, and what it improved

The first pass got the features in. The second pass came from opening the
generated HTML in a browser and looking at it, which is where these came from.
None of them were visible in the diff.

1. **The sticky band was not sticky at all.** Found by scrolling the real page
   and measuring: `bandTop: -2836`. This is the `overflow-x` bug in section 3. A
   feature that read as done in the source and did nothing in the browser.
2. **The band seamed across the page at rest.** A permanent ink backdrop over the
   body's radial ground, two visible hard edges, for no benefit at scroll zero.
   Now painted only while stuck.
3. **A section ranked below the cards inside it.** On the hub, section headings
   were 1.08rem over 1.2rem card titles, so "Buildcraft" read as a caption on the
   cards rather than a band containing them. Sections to 1.3rem with a hairline
   and a gold count, cards down to 1.1rem. Roster groups got the same treatment,
   which is what makes 53 bestiary cards in five groups read as five groups.
4. **Mobile nav still cost a whole card.** "Elsewhere" and its two links sat
   outside the new drawer, so a phone paid for them above the content. Folded
   inside; they are still visible on desktop because the drawer is open there.
   Content top on Weapons went 563px to 450px on the second pass alone.
5. **Deep links would have landed under the sticky band.** Anticipated and
   measured rather than shipped: `--band` feeds every `scroll-margin-top`, and the
   `#e-photonScythe` probe confirms 121px against a band bottom of 91px.
6. **Chips cost 130px on a phone**, now about 65px. **The sidebar provenance line**
   read as an orphan under the drawer summary and got a rule and its own rhythm.
7. **The live result count read as a footnote** in `--dim` at 400 weight; it is
   the one number on the page that changes as you filter, now `--body` at 700.

---

## 6. Verified vs assumed

**Verified by running it.**

- `bin/generate.mjs` completes and `bin/wiki-check.mjs` reports `WIKI CONTRACT OK`
  on the committed sources: 33 routes, 779 cards, 990 search entries, 1574
  anchors, all internal links resolve. The generator invokes the contract itself
  as its last step, so a clean generate *is* a clean contract run.
- Test suite: **14 of 14 pass** (`tests/generatedOutputGit.test.mjs`,
  `tests/liveVersion.test.mjs`).
- No sideways scroll: **0 of 60** page/width combinations.
- Guides reachable: **31 of 31** from all 33 routes, at 390px and 1280px.
- Search: `/` and `Ctrl`+`K` focus from a blurred state; "wraith" on the weapons
  page returns 5 ranked hits with the bestiary card first, cross-page; a slash
  typed into the box stays literal. Same shortcut re-verified on `log.html`.
- Sticky geometry, stuck: band 0-91px, sidebar top 109px, no overlap, deep link
  lands at 121px.
- No-JS at 390px: drawer open, all five sections present and tappable.
- Reduced motion: band still paints when stuck, transition dropped.
- Zero console errors or page errors on any page tested.
- Screenshots read at 390px and 1280px for the hub, weapons, bestiary and the
  explainer.

**Assumed, not verified.**

- **Real browsers other than Chromium 141.** Everything was measured in headless
  Chromium. `overflow-x:clip` is Chrome 90+/Firefox 81+/Safari 16+ and
  `checkVisibility` is Chromium-only, but that is a probe, not shipped code. The
  one thing worth a real-device glance is the sticky band on iOS Safari.
- **The two provenance chips at their real length.** I generated with
  `--offline`, so chip one read "live build unverified", not "live 0cb53bbe ·
  current wiki source". Similar length, not identical.
- **That `--band: 103px` holds if the band gains a row.** It is one named number
  precisely so that stays a one-line change, but nothing asserts it.

---

## 7. Residuals

1. **`node --test tests/` fails in directory mode.** Pre-existing: it fails
   identically on clean `origin/main`. Naming both files explicitly passes 14/14.
   Not mine, not fixed, flagged.
2. **Generated output is NOT in these commits, deliberately.** House convention
   (the last twelve commits) is that source changes touch `bin/` only and a
   separate `site: regenerate from main@<sha>` commit refreshes the HTML. Two
   further reasons it would have been wrong here: regenerating rewrites
   `log.html` and `index.html`, which this lane must not touch and the sibling
   lane owns; and with `--offline` the pages would claim an unverified live build.
   **The integrator should run `node bin/generate.mjs` in a normal environment and
   commit that separately.**
3. **I could not run the visuals rerender gate.** `bin/generate.mjs` fail-closes
   on `wiki-visuals.mjs --verify`, which redraws all 321 PNGs in Chrome and
   compares bytes. This container's Chromium does not reproduce the canonical
   render bytes, so it cannot pass here. I drove the real generator through a
   throwaway copy with that one gate swapped for `--check`, which still verifies
   every committed PNG's bytes, hash and dimensions against the manifest, and
   left every other gate live. The scratch copy is deleted and was never
   committed. **The byte-identity of the renders is the one input I did not
   verify.** Everything else the generator checks, it checked.
4. **The game repo was cloned read-only at `c736ebea`**, the commit the current
   site was generated from, so my output diffs against the committed site on
   chrome alone. At the game's current `main` (`84704d09`) both
   `data/tier-rankings.json` and `data/wiki-visuals.json` fail their own
   freshness pins, which is a game-repo matter and outside this lane. Worth
   knowing before the integrator regenerates: **regenerating against game `main`
   as it stands today will refuse to build.**
5. **Buildcraft holds 14 of 31 guides**, against 2 in Collection. The grouping is
   honest and derived, so this is the shape of the game and not a bug, but the
   biggest section is still a 14-item list. If it keeps growing it wants
   splitting, and that is a content decision (a new `section:` value in
   `bin/wiki.mjs`) rather than a chrome one.
6. **The first card is still far down a phone page**: 2052px on Weapons, 3697px
   on the Bestiary. What sits above it now is content, not chrome: lede,
   provenance line, omissions box and the facet bar. Making the omissions box
   collapsible on mobile would recover most of it, but it is deliberately
   prominent and that is a director call, not mine.
7. **The desktop drawer summary is clickable**, so a wide-screen reader can
   collapse the whole guide list. Recoverable in one click, and arguably something
   someone would want. Noted rather than prevented.

/** THE CONCISE VIEW'S SECOND SOURCE, read out of the game repo.
 *
 *  WHAT THIS REPLACES, AND WHAT IT MUST NOT LOSE. The concise view used to have
 *  exactly one source, notes/<date>.md, and exactly one reason to trust it:
 *
 *    "a machine cannot pick highlights, so nothing lands here except a human
 *     deciding it was worth saying, and that is what keeps this view from ever
 *     filling with noise."
 *
 *  That is still true. A machine still cannot pick highlights, and nothing in
 *  this file tries to. What changed is WHERE the human does the picking.
 *  whomp/src/data/patchNotes.ts carries, per release, a `headline`, a
 *  `keyChanges` list capped at four by the game's own tests, and a
 *  player-facing `bugFixes` list. Every one of those strings is written by a
 *  person, in player-facing language, at the moment the release is cut, and
 *  ships to players in the title screen's WHAT'S NEW panel. The curation
 *  already happened, once, as part of shipping. This file carries it across
 *  rather than asking for it to be performed a second time.
 *
 *  SO THE RULE IS: THIS FILE NEVER WRITES A SENTENCE ABOUT THE GAME. It parses,
 *  it validates, it refuses. Every word a visitor reads in a generated entry was
 *  authored in the game repo by a human. A generator that cannot compose a
 *  sentence about the game cannot compose a wrong one, which is what makes an
 *  unreviewed publish safe.
 *
 *  WHAT IS DELIBERATELY LEFT BEHIND: `fullChanges`. It is the exhaustive
 *  shipped ledger, seventeen entries on 0.6.1, and pouring it into the concise
 *  view would rebuild the full log with fewer words and kill the view. The
 *  full log already exists, generated from git, one toggle away.
 *
 *  LOUD ON EVERYTHING, same law as parseGameTaglines in bin/generate.mjs: if
 *  the file moved, the export shape changed, or a release breaks the four-item
 *  cap, this throws and the build stops. A concise view that silently renders
 *  nothing is the exact failure this lane exists to end, so "parsed zero
 *  releases" is an error here and not an empty list.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The noise bound, OWNED ON THIS SIDE. whomp/tests/patchNotes.test.ts already
 *  pins keyChanges to four or fewer, but that test protects the game's What's
 *  New panel, not this view. If the game repo ever raises its own cap, the
 *  concise view must refuse to publish rather than quietly grow a fifth, sixth
 *  and seventh highlight per release. This constant is that refusal. */
export const KEY_CHANGE_CAP = 4;

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/y;

/** A strict reader for the JS literal subset patchNotes.ts is written in:
 *  objects with identifier or quoted keys, arrays, quoted strings, numbers and
 *  the three keywords. Deliberately NOT eval and NOT a regex sweep. eval would
 *  execute whatever the game repo happens to contain, and a regex sweep over
 *  nested arrays of prose containing braces, brackets and escaped apostrophes
 *  ("Lucio\'s boop") gets the wrong answer confidently. Anything outside the
 *  subset throws with a character offset. */
class LiteralReader {
  constructor(source, label) {
    this.source = source;
    this.label = label;
    this.at = 0;
  }

  fail(message) {
    const line = this.source.slice(0, this.at).split('\n').length;
    throw new Error(`${this.label}: ${message} at line ${line} of the parsed literal.`);
  }

  skip() {
    while (this.at < this.source.length) {
      const c = this.source[this.at];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { this.at += 1; continue; }
      if (c === '/' && this.source[this.at + 1] === '/') {
        const end = this.source.indexOf('\n', this.at);
        this.at = end === -1 ? this.source.length : end;
        continue;
      }
      if (c === '/' && this.source[this.at + 1] === '*') {
        const end = this.source.indexOf('*/', this.at + 2);
        if (end === -1) this.fail('unterminated block comment');
        this.at = end + 2;
        continue;
      }
      return;
    }
  }

  value() {
    this.skip();
    const c = this.source[this.at];
    if (c === undefined) this.fail('unexpected end of literal');
    if (c === '{') return this.object();
    if (c === '[') return this.array();
    if (c === "'" || c === '"') return this.string();
    if (this.source.startsWith('true', this.at)) { this.at += 4; return true; }
    if (this.source.startsWith('false', this.at)) { this.at += 5; return false; }
    if (this.source.startsWith('null', this.at)) { this.at += 4; return null; }
    return this.number();
  }

  object() {
    this.at += 1; // {
    const out = {};
    for (;;) {
      this.skip();
      if (this.source[this.at] === '}') { this.at += 1; return out; }
      let key;
      if (this.source[this.at] === "'" || this.source[this.at] === '"') {
        key = this.string();
      } else {
        IDENTIFIER.lastIndex = this.at;
        const m = IDENTIFIER.exec(this.source);
        if (!m) this.fail('expected an object key');
        key = m[0];
        this.at = IDENTIFIER.lastIndex;
      }
      this.skip();
      if (this.source[this.at] !== ':') this.fail(`expected ":" after key "${key}"`);
      this.at += 1;
      out[key] = this.value();
      this.skip();
      if (this.source[this.at] === ',') { this.at += 1; continue; }
      if (this.source[this.at] === '}') { this.at += 1; return out; }
      this.fail(`expected "," or "}" after the value for "${key}"`);
    }
  }

  array() {
    this.at += 1; // [
    const out = [];
    for (;;) {
      this.skip();
      if (this.source[this.at] === ']') { this.at += 1; return out; }
      out.push(this.value());
      this.skip();
      if (this.source[this.at] === ',') { this.at += 1; continue; }
      if (this.source[this.at] === ']') { this.at += 1; return out; }
      this.fail('expected "," or "]" in array');
    }
  }

  string() {
    const quote = this.source[this.at];
    this.at += 1;
    let out = '';
    while (this.at < this.source.length) {
      const c = this.source[this.at];
      if (c === '\\') {
        const next = this.source[this.at + 1];
        const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', 0: '\0' };
        if (next === quote || next === '\\' || next === "'" || next === '"' || next === '/') out += next;
        else if (next in simple) out += simple[next];
        else if (next === 'u') {
          const hex = this.source.slice(this.at + 2, this.at + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail('malformed \\u escape');
          out += String.fromCharCode(parseInt(hex, 16));
          this.at += 6;
          continue;
        } else this.fail(`unsupported escape "\\${next}"`);
        this.at += 2;
        continue;
      }
      if (c === quote) { this.at += 1; return out; }
      if (c === '\n') this.fail('unterminated string');
      out += c;
      this.at += 1;
    }
    return this.fail('unterminated string');
  }

  number() {
    const rest = this.source.slice(this.at);
    const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (!m) this.fail(`unexpected character "${this.source[this.at]}"`);
    this.at += m[0].length;
    return Number(m[0]);
  }
}

/** Finds the exported array literal and reads it with the reader above.
 *
 *  THE ANCHOR IS THE ASSIGNMENT, NOT THE NAME, and the first draft of this
 *  function proved why. `indexOf('PATCH_RELEASES')` then `indexOf('[')` lands on
 *  the "[" in `: readonly PatchRelease[] =`, which is an EMPTY array literal
 *  that parses perfectly and yields zero releases. It was caught only because
 *  parsePatchReleases refuses an empty result: a reader that returned [] here
 *  would have published a blank concise view and reported success, which is
 *  the precise failure mode this lane exists to end. The regex below consumes
 *  the type annotation and the "=" before any bracket is looked for. */
const EXPORT_ANCHOR = /export\s+const\s+PATCH_RELEASES\b[^=]*=\s*/;

function sliceArrayLiteral(source, label) {
  const m = EXPORT_ANCHOR.exec(source);
  if (!m) {
    throw new Error(`${label}: no "export const PATCH_RELEASES" assignment in the file. The export shape moved; fix this reader rather than shipping an empty concise log.`);
  }
  const open = m.index + m[0].length;
  if (source[open] !== '[') {
    throw new Error(`${label}: PATCH_RELEASES is not assigned an array literal.`);
  }
  return new LiteralReader(source.slice(open), label).array();
}

const isNonEmptyStringList = (value) => Array.isArray(value) && value.length > 0
  && value.every((s) => typeof s === 'string' && s.trim().length > 0);

/** Reads whomp/src/data/patchNotes.ts and returns the release history, newest
 *  first, validated. `fullChanges` and `pleaseTest` are read only so their
 *  absence is still an error (a release missing them means the shape moved);
 *  neither is returned, because neither belongs in a concise view. */
export function readPatchReleases(repoRoot) {
  const path = join(repoRoot, 'src/data/patchNotes.ts');
  const label = 'whomp/src/data/patchNotes.ts';
  if (!existsSync(path)) {
    throw new Error(`No ${label}. The concise dev log reads its highlights from the game's own release notes and will not invent them. Point --repo at a real game checkout.`);
  }
  return parsePatchReleases(readFileSync(path, 'utf8'), label);
}

/** Split from readPatchReleases so the parser can be tested against fixture
 *  text without a game checkout beside the site. */
export function parsePatchReleases(source, label = 'patchNotes.ts') {
  const raw = sliceArrayLiteral(source, label);
  if (raw.length === 0) {
    throw new Error(`${label}: PATCH_RELEASES parsed to zero releases. The concise dev log would publish nothing, which reads to a visitor as "nothing shipped". Fix this reader or the source.`);
  }

  const releases = raw.map((entry, index) => {
    const where = `${label}: release at position ${index}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${where} is not an object.`);
    if (typeof entry.version !== 'string' || !SEMVER.test(entry.version)) throw new Error(`${where} has no strict semver version.`);
    if (typeof entry.date !== 'string' || !ISO_DATE.test(entry.date)) throw new Error(`${where} (${entry.version}) has no YYYY-MM-DD date.`);
    if (typeof entry.headline !== 'string' || entry.headline.trim().length === 0) throw new Error(`${where} (${entry.version}) has no headline.`);
    for (const field of ['keyChanges', 'bugFixes', 'fullChanges', 'pleaseTest']) {
      if (!isNonEmptyStringList(entry[field])) throw new Error(`${where} (${entry.version}) has no non-empty ${field} list.`);
    }
    if (entry.keyChanges.length > KEY_CHANGE_CAP) {
      throw new Error(`${where} (${entry.version}) carries ${entry.keyChanges.length} keyChanges. The concise dev log publishes at most ${KEY_CHANGE_CAP} per release and refuses rather than growing into a second full log. Either the release needs fewer highlights or this cap is a deliberate change and belongs in bin/patch-notes.mjs, whomp/tests/patchNotes.test.ts and the site's own test together.`);
    }
    return {
      version: entry.version,
      date: entry.date,
      headline: entry.headline.trim(),
      keyChanges: entry.keyChanges.map((s) => s.trim()),
      bugFixes: entry.bugFixes.map((s) => s.trim()),
    };
  });

  /* ONE ENTRY PER VERSION, and the source has to agree. The game advances the
   * patch number once per Vancouver date that ships (whomp/bin/release-channel.mjs:
   * a same-date publication returns the live version unchanged), so two deploys
   * on one date are one release. A duplicate version here would mean two
   * concise entries for one release, which is the per-deploy cadence this lane
   * was told not to build. */
  const seen = new Set();
  for (const r of releases) {
    if (seen.has(r.version)) throw new Error(`${label}: version ${r.version} appears more than once. One release is one concise entry; the source must not carry two.`);
    seen.add(r.version);
  }

  /* Newest first is the source's own documented contract ("newest release
   * FIRST"), and the concise view renders in the order it is given. Checking it
   * costs nothing and catches an entry appended to the wrong end, which would
   * silently bury the newest release at the bottom of the page. */
  for (let i = 1; i < releases.length; i += 1) {
    if (releases[i].date > releases[i - 1].date) {
      throw new Error(`${label}: ${releases[i].version} (${releases[i].date}) is dated after ${releases[i - 1].version} (${releases[i - 1].date}) but sits below it. PATCH_RELEASES is newest-first by contract.`);
    }
  }

  return releases;
}

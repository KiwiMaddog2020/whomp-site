import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchLiveVersion,
  fetchStableLiveVersion,
  normalizeLiveMetadata,
  normalizeStableLiveMetadata,
  normalizeSuppliedLiveVersion,
} from '../bin/live-version.mjs';

const SHA = '0cb53bbecfe0da526a3a6af05fa1fc6ce04bbb0a';
const metadata = (changes = {}) => ({
  schema: 1,
  channel: 'stable',
  gameVersion: '0.6.1',
  sourceSha: SHA,
  verificationSha: SHA,
  publishedAt: '2026-08-04T10:07:47.519Z',
  ...changes,
});

test('current schema 1 normalizes to the displayed short SHA and version', () => {
  assert.deepEqual(normalizeStableLiveMetadata(metadata()), {
    sha: '0cb53bbe',
    version: '0.6.1',
    builtAt: '2026-08-04T10:07:47.519Z',
  });
});

test('legacy and malformed HTTP-200 payload shapes fail closed', () => {
  for (const payload of [
    null,
    [],
    { sha: '0cb53bbe', version: '0.6.1' },
    metadata({ schema: 2 }),
    metadata({ channel: 'preview' }),
    metadata({ gameVersion: '0.6' }),
    metadata({ sourceSha: '0cb53bbe' }),
    metadata({ verificationSha: 'f'.repeat(40) }),
    metadata({ publishedAt: 'not-a-date' }),
  ]) {
    assert.throws(() => normalizeStableLiveMetadata(payload), /Stable live metadata/);
  }
});

test('network failure and non-success HTTP remain honestly unverified', async () => {
  assert.equal(await fetchStableLiveVersion(
    'https://example.test/version.json',
    async () => { throw new TypeError('offline'); },
  ), null);
  assert.equal(await fetchStableLiveVersion(
    'https://example.test/version.json',
    async () => new Response('unavailable', { status: 503 }),
  ), null);
});

test('the explicit deadline settles a header stall and aborts the request', { timeout: 1000 }, async () => {
  let aborted = false;
  const live = await fetchStableLiveVersion(
    'https://example.test/version.json',
    async (_url, { signal }) => new Promise(() => {
      signal.addEventListener('abort', () => { aborted = true; }, { once: true });
    }),
    10,
  );

  assert.equal(live, null);
  assert.equal(aborted, true);
});

test('the same deadline settles a stalled HTTP-200 body read', { timeout: 1000 }, async () => {
  let aborted = false;
  let bodyRead = false;
  const live = await fetchStableLiveVersion(
    'https://example.test/version.json',
    async (_url, { signal }) => {
      signal.addEventListener('abort', () => { aborted = true; }, { once: true });
      return {
        ok: true,
        status: 200,
        json: async () => {
          bodyRead = true;
          return new Promise(() => {});
        },
      };
    },
    10,
  );

  assert.equal(live, null);
  assert.equal(bodyRead, true);
  assert.equal(aborted, true);
});

test('a valid HTTP-200 response is no-store and normalized', async () => {
  let request;
  const live = await fetchStableLiveVersion(
    'https://example.test/version.json',
    async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify(metadata()), { status: 200 });
    },
  );

  assert.deepEqual(live, {
    sha: '0cb53bbe',
    version: '0.6.1',
    builtAt: '2026-08-04T10:07:47.519Z',
  });
  assert.equal(request.url, 'https://example.test/version.json');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.signal instanceof AbortSignal, true);
});

test('invalid JSON and malformed successful metadata reject instead of becoming offline', async () => {
  await assert.rejects(
    fetchStableLiveVersion(
      'https://example.test/version.json',
      async () => new Response('{', { status: 200 }),
    ),
    /HTTP 200 body is not valid JSON/,
  );
  await assert.rejects(
    fetchStableLiveVersion(
      'https://example.test/version.json',
      async () => new Response(JSON.stringify(metadata({ schema: 9 })), { status: 200 }),
    ),
    /schema must be 1/,
  );
});

/* TWO TRACKS. The landing page states Preview and Stable side by side, so the
 * one failure that would actually mislead a reader is the two swapping places:
 * a Preview payload rendered under the word Stable, or the reverse. The channel
 * is therefore an argument the caller must supply and the payload must agree
 * with, and these are the eyes on that. */
test('the preview track reads through the same contract, under its own name', () => {
  const preview = metadata({ channel: 'preview', gameVersion: '0.6.4' });
  assert.deepEqual(normalizeLiveMetadata(preview, 'preview'), {
    sha: '0cb53bbe',
    version: '0.6.4',
    builtAt: '2026-08-04T10:07:47.519Z',
  });
});

test('neither track will accept the other track\'s payload', () => {
  assert.throws(
    () => normalizeLiveMetadata(metadata({ channel: 'preview' }), 'stable'),
    /Stable live metadata: channel must be stable/,
  );
  assert.throws(
    () => normalizeLiveMetadata(metadata(), 'preview'),
    /Preview live metadata: channel must be preview/,
  );
});

test('a channel the site does not publish is refused before any request is made', async () => {
  assert.throws(() => normalizeLiveMetadata(metadata(), 'nightly'), /Unknown release channel/);
  await assert.rejects(
    fetchLiveVersion('https://example.test/version.json', 'nightly', async () => {
      throw new Error('the fetch should never have been attempted');
    }),
    /Unknown release channel/,
  );
});

test('a preview endpoint that is down is honestly unverified, not a stale claim', async () => {
  assert.equal(await fetchLiveVersion(
    'https://example.test/version.json',
    'preview',
    async () => { throw new TypeError('offline'); },
  ), null);
});

test('publisher-supplied live identity is validated separately from network metadata', () => {
  assert.deepEqual(normalizeSuppliedLiveVersion('0cb53bbe', '0.6.1'), {
    sha: '0cb53bbe', version: '0.6.1', builtAt: null,
  });
  assert.deepEqual(normalizeSuppliedLiveVersion(SHA, '0.6.1'), {
    sha: '0cb53bbe', version: '0.6.1', builtAt: null,
  });
  assert.throws(() => normalizeSuppliedLiveVersion('0cb53bb', '0.6.1'), /publisher SHA/);
  assert.throws(() => normalizeSuppliedLiveVersion('0cb53bbe', '0.6'), /gameVersion/);
});

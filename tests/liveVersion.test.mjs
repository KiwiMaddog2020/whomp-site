import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchStableLiveVersion,
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

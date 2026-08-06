const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FULL_SHA = /^[a-f0-9]{40}$/;
const SUPPLIED_SHA = /^(?:[a-f0-9]{8}|[a-f0-9]{40})$/;

/** TWO TRACKS, ONE CONTRACT (2026-08-06). This module was written when the site
 *  named exactly one live build, and it hard-coded `channel === 'stable'` into
 *  the schema check to make sure a Preview payload could never be reported as
 *  Stable. That guard is still exactly right and it is why the channel is a
 *  PARAMETER rather than something the reader shrugs at: the landing page now
 *  states both tracks, side by side, and the one failure that matters is the two
 *  swapping places. A payload is still refused unless it says which track it is
 *  and that track is the one that was asked for.
 *
 *  The stable-named exports below are kept because they are what the rest of the
 *  site and tests/liveVersion.test.mjs already call, and because "the stable
 *  reader will not accept a preview payload" is a property worth keeping a name
 *  on. They are now one line each over the channel-taking core. */
const CHANNELS = new Set(['stable', 'preview']);

const label = (channel) => `${channel[0].toUpperCase()}${channel.slice(1)} live metadata`;

const failIn = (channel, message, options) => {
  throw new Error(`${label(channel)}: ${message}`, options);
};

const fail = (message, options) => failIn('stable', message, options);

const record = (channel, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) failIn(channel, 'payload must be an object');
  return value;
};

const strictVersion = (channel, value) => {
  if (typeof value !== 'string' || !SEMVER.test(value)) failIn(channel, 'gameVersion must be strict major.minor.patch semver');
  return value;
};

const expectChannel = (channel) => {
  if (!CHANNELS.has(channel)) throw new Error(`Unknown release channel "${channel}". The site publishes exactly two, stable and preview.`);
  return channel;
};

/** Normalize one release authority. Legacy network payloads with { sha, version }
 * are intentionally rejected: an HTTP-200 endpoint claiming release metadata must
 * move its schema explicitly rather than silently losing the source/verification
 * identity contract. The channel is checked against the one the CALLER asked for,
 * so a preview payload served at the stable URL is a refusal rather than a chip
 * that names the wrong track. */
export function normalizeLiveMetadata(input, channel) {
  expectChannel(channel);
  const payload = record(channel, input);
  if (payload.schema !== 1) failIn(channel, 'schema must be 1');
  if (payload.channel !== channel) failIn(channel, `channel must be ${channel}`);
  const version = strictVersion(channel, payload.gameVersion);
  if (typeof payload.sourceSha !== 'string' || !FULL_SHA.test(payload.sourceSha)) {
    failIn(channel, 'sourceSha must be a full lowercase Git SHA');
  }
  if (payload.verificationSha !== payload.sourceSha) failIn(channel, 'verificationSha must equal sourceSha');
  if (typeof payload.publishedAt !== 'string' || Number.isNaN(Date.parse(payload.publishedAt))) {
    failIn(channel, 'publishedAt must be a valid date string');
  }
  /* The returned shape is deliberately unchanged by the two-track move. The
   * caller already knows which channel it asked for, and widening a frozen
   * record that three call sites destructure buys nothing. */
  return Object.freeze({
    sha: payload.sourceSha.slice(0, 8),
    version,
    builtAt: payload.publishedAt,
  });
}

export const normalizeStableLiveMetadata = (input) => normalizeLiveMetadata(input, 'stable');

/** Deploy scripts already know the exact artifact they just published and pass
 * it directly to avoid a CDN propagation race. That trusted handoff remains
 * separate from the network schema and is validated before rendering. */
export function normalizeSuppliedLiveVersion(sha, version) {
  if (typeof sha !== 'string' || !SUPPLIED_SHA.test(sha)) {
    fail('publisher SHA must be 8 or 40 lowercase hexadecimal characters');
  }
  return Object.freeze({ sha: sha.slice(0, 8), version: strictVersion('stable', version), builtAt: null });
}

export async function fetchLiveVersion(url, channel, fetchFn = fetch, timeoutMs = 8000) {
  expectChannel(channel);
  if (typeof url !== 'string' || !url.startsWith('https://')) failIn(channel, 'URL must be HTTPS');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    failIn(channel, 'timeout must be an integer from 1 through 60000 milliseconds');
  }

  const controller = new AbortController();
  const timedOut = Symbol(`${label(channel)} timeout`);
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(timedOut);
    }, timeoutMs);
  });
  const request = (async () => {
    let response;
    try {
      response = await fetchFn(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch {
      return null;
    }
    if (!response || typeof response.ok !== 'boolean' || typeof response.status !== 'number') {
      failIn(channel, 'fetch returned an invalid response object');
    }
    if (!response.ok) return null;
    if (response.status !== 200) failIn(channel, `successful response used unexpected HTTP ${response.status}`);

    let payload;
    try {
      payload = await response.json();
    } catch (cause) {
      failIn(channel, 'HTTP 200 body is not valid JSON', { cause });
    }
    return normalizeLiveMetadata(payload, channel);
  })();

  try {
    const result = await Promise.race([request, deadline]);
    return result === timedOut ? null : result;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchStableLiveVersion = (url, fetchFn = fetch, timeoutMs = 8000) =>
  fetchLiveVersion(url, 'stable', fetchFn, timeoutMs);

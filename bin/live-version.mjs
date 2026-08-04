const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FULL_SHA = /^[a-f0-9]{40}$/;
const SUPPLIED_SHA = /^(?:[a-f0-9]{8}|[a-f0-9]{40})$/;

const fail = (message, options) => {
  throw new Error(`Stable live metadata: ${message}`, options);
};

const record = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('payload must be an object');
  return value;
};

const strictVersion = (value) => {
  if (typeof value !== 'string' || !SEMVER.test(value)) fail('gameVersion must be strict major.minor.patch semver');
  return value;
};

/** Normalize only the current release authority. Legacy network payloads with
 * { sha, version } are intentionally rejected: an HTTP-200 endpoint claiming
 * release metadata must move its schema explicitly rather than silently losing
 * the source/verification identity contract. */
export function normalizeStableLiveMetadata(input) {
  const payload = record(input);
  if (payload.schema !== 1) fail('schema must be 1');
  if (payload.channel !== 'stable') fail('channel must be stable');
  const version = strictVersion(payload.gameVersion);
  if (typeof payload.sourceSha !== 'string' || !FULL_SHA.test(payload.sourceSha)) {
    fail('sourceSha must be a full lowercase Git SHA');
  }
  if (payload.verificationSha !== payload.sourceSha) fail('verificationSha must equal sourceSha');
  if (typeof payload.publishedAt !== 'string' || Number.isNaN(Date.parse(payload.publishedAt))) {
    fail('publishedAt must be a valid date string');
  }
  return Object.freeze({
    sha: payload.sourceSha.slice(0, 8),
    version,
    builtAt: payload.publishedAt,
  });
}

/** Deploy scripts already know the exact artifact they just published and pass
 * it directly to avoid a CDN propagation race. That trusted handoff remains
 * separate from the network schema and is validated before rendering. */
export function normalizeSuppliedLiveVersion(sha, version) {
  if (typeof sha !== 'string' || !SUPPLIED_SHA.test(sha)) {
    fail('publisher SHA must be 8 or 40 lowercase hexadecimal characters');
  }
  return Object.freeze({ sha: sha.slice(0, 8), version: strictVersion(version), builtAt: null });
}

export async function fetchStableLiveVersion(url, fetchFn = fetch, timeoutMs = 8000) {
  if (typeof url !== 'string' || !url.startsWith('https://')) fail('URL must be HTTPS');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    fail('timeout must be an integer from 1 through 60000 milliseconds');
  }

  let response;
  try {
    response = await fetchFn(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
  if (!response || typeof response.ok !== 'boolean' || typeof response.status !== 'number') {
    fail('fetch returned an invalid response object');
  }
  if (!response.ok) return null;
  if (response.status !== 200) fail(`successful response used unexpected HTTP ${response.status}`);

  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    fail('HTTP 200 body is not valid JSON', { cause });
  }
  return normalizeStableLiveMetadata(payload);
}

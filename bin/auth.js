/** Sign-in for the WHOMP site, wired to the game's already-deployed accounts
 *  worker so one Google account covers both surfaces.
 *
 *  This is a hand-copy of the shape in the game repo (src/net/googleIdentity.ts
 *  and src/net/accountClient.ts), not a shared import: the site is a separate
 *  static repo with no build step and no dependency on the game's source tree.
 *  The worker URL, client id and session shape below are copied on purpose so
 *  the two stay wire-compatible.
 *
 *  THE REAL TRICK: the game and this site are both GitHub Pages project pages
 *  under the same account, so they share one origin
 *  (https://kiwimaddog2020.github.io) even though the paths differ. localStorage
 *  is scoped to origin, not path, so writing the session under the exact same
 *  key the game uses means a sign-in on one surface is already visible on the
 *  other. No cookie, no shared backend session, just the same storage the
 *  browser already gives same-origin pages for free.
 *
 *  No build step: plain ES module, no npm dependency, works as a static file.
 */

const ACCOUNTS_WORKER_URL = 'https://whomp-accounts.kevinmadson3.workers.dev';

/** Public Google OAuth client id, same one the game's wrangler.toml and
 *  accountClient.ts carry. Client ids are public by design, so copying it here
 *  is not a secret leak. */
const GOOGLE_CLIENT_ID = '312470537927-t2s02pk0vdh2svbdo1rmna3q07ig4e7m.apps.googleusercontent.com';

/** Same key the game writes to. Do not rename this without renaming it in the
 *  game too, or the two surfaces stop agreeing on who is signed in. */
const SESSION_STORAGE_KEY = 'whomp-account-session';

const GIS_SCRIPT_ID = 'whomp-google-identity';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

// ---------------------------------------------------------------- storage

function readSession() {
  let raw;
  try {
    raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null; // private mode / storage blocked reads as signed out, not a crash
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    if (typeof parsed.token !== 'string' || parsed.token === '') return null;
    if (typeof parsed.email !== 'string') return null;
    if (typeof parsed.expiresAt !== 'number' || !Number.isFinite(parsed.expiresAt)) return null;
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName : undefined;
    return displayName === undefined
      ? { token: parsed.token, email: parsed.email, expiresAt: parsed.expiresAt }
      : { token: parsed.token, email: parsed.email, expiresAt: parsed.expiresAt, displayName };
  } catch {
    return null; // a corrupt record reads as signed out, never as a crash
  }
}

function writeSession(session) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage blocked (private mode, quota); the session still lives for this
    // tab's lifetime via the in-memory cache below.
  }
  cached = session;
  notify();
}

function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // same as above, nothing to do if storage is unavailable
  }
  cached = null;
  notify();
}

// ---------------------------------------------------------------- session state

let cached;
let cacheLoaded = false;
const listeners = new Set();

function notify() {
  const user = getUser();
  for (const cb of listeners) cb(user);
}

/** The live session, or null when signed out or expired. An expired record is
 *  cleared on read so callers only ever see usable sessions. */
function session() {
  if (!cacheLoaded) {
    cached = readSession();
    cacheLoaded = true;
  }
  if (cached !== null && cached.expiresAt <= Date.now()) {
    clearSession();
    return null;
  }
  return cached;
}

/** Picked up when another tab or the game itself (same origin) writes a new
 *  session. Keeps this page live without a reload. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== SESSION_STORAGE_KEY) return;
    cached = readSession();
    cacheLoaded = true;
    notify();
  });
}

/** Public: the signed-in user, or null. */
export function getUser() {
  const s = session();
  return s === null ? null : { email: s.email, displayName: s.displayName ?? null };
}

/** Public: subscribe to sign-in state changes. Returns an unsubscribe function. */
export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---------------------------------------------------------------- google identity

function loadGisScript(doc) {
  const existing = doc.getElementById(GIS_SCRIPT_ID);
  if (existing !== null) {
    if (existing.dataset.ready !== 'true' && existing.dataset.failed === 'true') {
      existing.remove();
    } else {
      return new Promise((resolve, reject) => {
        if (existing.dataset.ready === 'true') resolve();
        else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => {
            existing.dataset.failed = 'true';
            existing.remove();
            reject(new Error('google identity failed to load'));
          }, { once: true });
        }
      });
    }
  }

  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      script.dataset.ready = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      script.dataset.failed = 'true';
      script.remove();
      reject(new Error('google identity failed to load'));
    }, { once: true });
    doc.head.appendChild(script);
  });
}

async function requestGoogleIdToken(clientId) {
  if (clientId === '') return null;
  const doc = typeof document !== 'undefined' ? document : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;
  if (!doc || !win) return null;

  await loadGisScript(doc);
  const id = win.google?.accounts?.id;
  if (!id) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (credential) => {
      if (settled) return;
      settled = true;
      if (credential === null) id.cancel?.();
      resolve(credential);
    };
    id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (res) => finish(typeof res.credential === 'string' && res.credential !== '' ? res.credential : null),
    });
    id.prompt((moment) => {
      if (moment.isNotDisplayed?.() || moment.isSkippedMoment?.() || moment.isDismissedMoment?.()) {
        finish(null);
      }
    });
  });
}

// ---------------------------------------------------------------- sign in / out

async function readJson(res) {
  try {
    const parsed = await res.json();
    return parsed !== null && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function signInWithIdToken(idToken) {
  let res;
  try {
    res = await fetch(`${ACCOUNTS_WORKER_URL}/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    return { ok: false, error: 'could not reach accounts' };
  }
  const body = await readJson(res);
  if (!res.ok) {
    const fallback = `sign-in failed (${res.status})`;
    return { ok: false, error: (body && typeof body.error === 'string' && body.error) || fallback };
  }
  const token = body && typeof body.sessionToken === 'string' ? body.sessionToken : '';
  const expiresAt = body && typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt) ? body.expiresAt : 0;
  const user = body && body.user !== null && typeof body.user === 'object' ? body.user : {};
  const email = typeof user.email === 'string' ? user.email : '';
  const displayName = typeof user.displayName === 'string' ? user.displayName : undefined;
  if (token === '' || expiresAt <= Date.now())
    return { ok: false, error: 'accounts returned no usable session' };

  const nextSession =
    displayName === undefined ? { token, email, expiresAt } : { token, email, expiresAt, displayName };
  writeSession(nextSession);
  return { ok: true };
}

/** Sign in with Google. Asks the browser for an ID token, then exchanges it
 *  with the accounts worker for a WHOMP session. Returns a plain result so
 *  the caller can show gamer-facing copy instead of a stack trace. */
export async function signIn() {
  let idToken;
  try {
    idToken = await requestGoogleIdToken(GOOGLE_CLIENT_ID);
  } catch {
    return { ok: false, error: 'google sign-in failed to load' };
  }
  if (idToken === null || idToken === '') return { ok: false, error: 'sign-in dismissed' };
  return signInWithIdToken(idToken);
}

/** Sign out. Clears the local session first so the UI reflects it instantly,
 *  then best-effort revokes on the server. A network failure here must not
 *  leave the player looking signed in on this device. */
export async function signOut() {
  const s = session();
  clearSession();
  if (s === null) return;
  try {
    await fetch(`${ACCOUNTS_WORKER_URL}/auth/signout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${s.token}` },
    });
  } catch {
    // the token still expires server-side on its own TTL
  }
}

if (typeof window !== 'undefined') {
  window.whompAuth = { getUser, onChange, signIn, signOut };
}

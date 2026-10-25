/** Which game tree the site step builds from (site-step-deployed-tree, 2026-10-25).
 *
 *  The game's deploy runs bin/deploy-site.sh as its last step. It used to read
 *  `../whomp` unconditionally, so on the Mac it verified the canonical checkout
 *  (which the lander keeps moving mid-wave) instead of the clone the deploy had
 *  built and gated. These tests drive the real script in a throwaway copy of the
 *  site with a stub generator that records the `--repo` it was handed:
 *  WHOMP_GAME_REPO set reads that tree, --repo beats it, unset reads ../whomp.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_GAME_REPO, resolveGameRepo } from '../bin/game-repo.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// A parent dir holding whomp-site/ (script + stub generator, on main, origin
// naming whomp-site), the default ../whomp, and a separate deploy clone.
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'site-game-repo-')));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const site = join(root, 'whomp-site');
  mkdirSync(join(site, 'bin'), { recursive: true });
  copyFileSync(join(SITE, 'bin/deploy-site.sh'), join(site, 'bin/deploy-site.sh'));
  // Records its argv and writes an empty manifest, so the script stages nothing
  // and exits "site unchanged" before any commit or push.
  writeFileSync(join(site, 'bin/generate.mjs'), [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync('.generate-argv.json', JSON.stringify(process.argv.slice(2)));",
    "writeFileSync('.site-outputs', '');",
    '',
  ].join('\n'));
  writeFileSync(join(site, '.gitignore'), '.generate-argv.json\n.site-outputs\n');
  git(site, 'init', '-q', '-b', 'main');
  git(site, 'remote', 'add', 'origin', 'https://example.invalid/KiwiMaddog2020/whomp-site.git');
  const canonical = join(root, 'whomp');
  const deployClone = join(root, 'deploy-clone');
  for (const dir of [canonical, deployClone]) {
    mkdirSync(dir);
    git(dir, 'init', '-q');
  }
  return { root, site, canonical, deployClone };
}

function runDeploySite({ site }, { env = {}, args = [], cwd = site } = {}) {
  const childEnv = { ...process.env, ...env };
  if (!('WHOMP_GAME_REPO' in env)) delete childEnv.WHOMP_GAME_REPO;
  const result = spawnSync('bash', [join(site, 'bin/deploy-site.sh'), ...args], { cwd, env: childEnv, encoding: 'utf8' });
  let argv = null;
  try { argv = JSON.parse(readFileSync(join(site, '.generate-argv.json'), 'utf8')); } catch { /* generator never ran */ }
  return { ...result, argv };
}

const repoArg = (argv) => argv[argv.indexOf('--repo') + 1];

test('unset: the site step reads ../whomp, exactly as a hand run always has', (t) => {
  const fx = fixture(t);
  const run = runDeploySite(fx);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /site unchanged, nothing to deploy/);
  assert.equal(repoArg(run.argv), '../whomp');
});

test('WHOMP_GAME_REPO set: the site step reads the deploy clone, not ../whomp', (t) => {
  const fx = fixture(t);
  const run = runDeploySite(fx, { env: { WHOMP_GAME_REPO: fx.deployClone } });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(repoArg(run.argv), fx.deployClone);
  assert.match(run.stdout, new RegExp(`game tree: ${fx.deployClone}`));
});

test('--repo beats WHOMP_GAME_REPO, and a relative path resolves against the caller', (t) => {
  const fx = fixture(t);
  const run = runDeploySite(fx, {
    env: { WHOMP_GAME_REPO: fx.canonical },
    args: ['--offline', '--repo', 'deploy-clone'],
    cwd: fx.root,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(repoArg(run.argv), fx.deployClone);
  assert.ok(run.argv.includes('--offline'), 'the --offline flag still reaches the generator');
});

test('a named tree that is not a git checkout refuses before the generator runs', (t) => {
  const fx = fixture(t);
  const missing = join(fx.root, 'no-such-clone');
  const run = runDeploySite(fx, { env: { WHOMP_GAME_REPO: missing } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /game repo not found at .*no-such-clone/);
  assert.equal(run.argv, null);
});

test('an unknown argument refuses rather than being silently ignored', (t) => {
  const fx = fixture(t);
  const run = runDeploySite(fx, { args: ['--ofline'] });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /unknown argument '--ofline'/);
});

test('generate.mjs: --repo, then WHOMP_GAME_REPO, then ../whomp', () => {
  const cwd = '/work/whomp-site';
  assert.equal(DEFAULT_GAME_REPO, '../whomp');
  assert.equal(resolveGameRepo([], {}, cwd), '/work/whomp');
  assert.equal(resolveGameRepo([], { WHOMP_GAME_REPO: '/deploy/clone' }, cwd), '/deploy/clone');
  assert.equal(resolveGameRepo([], { WHOMP_GAME_REPO: '' }, cwd), '/work/whomp');
  assert.equal(resolveGameRepo(['--repo', '/explicit'], { WHOMP_GAME_REPO: '/deploy/clone' }, cwd), '/explicit');
  assert.equal(resolveGameRepo(['--repo'], { WHOMP_GAME_REPO: '/deploy/clone' }, cwd), '/deploy/clone');
});

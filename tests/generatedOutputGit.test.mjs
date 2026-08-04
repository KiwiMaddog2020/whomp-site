import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { listTrackedGeneratedFiles } from '../bin/generated-output-git.mjs';

const temporaryDirectory = (t, prefix) => {
  const path = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(path, { force: true, recursive: true }));
  return path;
};

test('a fresh non-repository output has no tracked retirements and never invokes Git', (t) => {
  const outdir = temporaryDirectory(t, 'whomp-site-preflight-');
  let invoked = false;

  const tracked = listTrackedGeneratedFiles(outdir, () => {
    invoked = true;
    throw new Error('Git must not run for a fresh preview directory');
  });

  assert.deepEqual(tracked, []);
  assert.equal(invoked, false);
});

test('a Git worktree returns its tracked generated namespace', (t) => {
  const outdir = temporaryDirectory(t, 'whomp-site-worktree-');
  mkdirSync(join(outdir, 'wiki-assets'));
  writeFileSync(join(outdir, 'wiki.html'), 'wiki');
  writeFileSync(join(outdir, 'wiki-assets', 'portrait.png'), 'png');
  execFileSync('git', ['init', '--quiet', outdir]);
  execFileSync('git', ['-C', outdir, 'add', '--', 'wiki.html', 'wiki-assets/portrait.png']);

  assert.deepEqual(listTrackedGeneratedFiles(outdir), [
    'wiki-assets/portrait.png',
    'wiki.html',
  ]);
});

test('a real Git failure inside a worktree stops generation', (t) => {
  const outdir = temporaryDirectory(t, 'whomp-site-broken-worktree-');
  execFileSync('git', ['init', '--quiet', outdir]);
  writeFileSync(join(outdir, '.git', 'index'), 'broken');

  assert.throws(
    () => listTrackedGeneratedFiles(outdir),
    /Unable to enumerate tracked generated outputs in Git worktree/,
  );
});

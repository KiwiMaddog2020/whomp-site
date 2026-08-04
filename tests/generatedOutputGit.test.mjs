import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

test('a worktree query captures stderr and uses only the generated wiki namespace', (t) => {
  const outdir = temporaryDirectory(t, 'whomp-site-query-');
  mkdirSync(join(outdir, '.git'));
  let invocation;

  const tracked = listTrackedGeneratedFiles(outdir, (file, args, options) => {
    invocation = { file, args, options };
    return 'wiki-assets/portrait.png\nwiki.html\n';
  });

  assert.deepEqual(tracked, ['wiki-assets/portrait.png', 'wiki.html']);
  assert.deepEqual(invocation, {
    file: 'git',
    args: ['-C', outdir, 'ls-files', '--', 'wiki*.html', 'wiki-assets'],
    options: {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  });
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

test('a nested output directory inherits its repository boundary', (t) => {
  const repository = temporaryDirectory(t, 'whomp-site-nested-worktree-');
  const outdir = join(repository, 'preview');
  mkdirSync(outdir);
  writeFileSync(join(outdir, 'wiki.html'), 'wiki');
  execFileSync('git', ['init', '--quiet', repository]);
  execFileSync('git', ['-C', repository, 'add', '--', 'preview/wiki.html']);

  assert.deepEqual(listTrackedGeneratedFiles(outdir), ['wiki.html']);
});

test('a linked worktree .git file remains an authoritative repository marker', (t) => {
  const root = temporaryDirectory(t, 'whomp-site-linked-worktree-');
  const repository = join(root, 'repository');
  const outdir = join(root, 'linked');
  mkdirSync(repository);
  execFileSync('git', ['init', '--quiet', repository]);
  writeFileSync(join(repository, 'seed'), 'seed');
  execFileSync('git', ['-C', repository, 'add', '--', 'seed']);
  execFileSync('git', [
    '-C', repository,
    '-c', 'user.name=WHOMP Test',
    '-c', 'user.email=whomp-test@example.invalid',
    'commit', '--quiet', '-m', 'test seed',
  ]);
  execFileSync('git', ['-C', repository, 'worktree', 'add', '--quiet', '--detach', outdir]);
  assert.equal(lstatSync(join(outdir, '.git')).isFile(), true);
  writeFileSync(join(outdir, 'wiki.html'), 'wiki');
  execFileSync('git', ['-C', outdir, 'add', '--', 'wiki.html']);

  assert.deepEqual(listTrackedGeneratedFiles(outdir), ['wiki.html']);
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

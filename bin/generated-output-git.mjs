import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const gitWorktreeRoot = (start) => {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

/**
 * A fresh preview output directory has no Git state and therefore no tracked
 * deletion to stage. Once a .git worktree marker exists in the directory or an
 * ancestor, Git is authoritative: an unreadable index or unavailable command
 * must stop generation instead of silently omitting retired tracked outputs.
 */
export function listTrackedGeneratedFiles(outdir, runGit = execFileSync) {
  const root = resolve(outdir);
  if (!gitWorktreeRoot(root)) return [];

  try {
    return runGit(
      'git', ['-C', root, 'ls-files', '--', 'wiki*.html', 'wiki-assets'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim().split('\n').filter(Boolean);
  } catch (cause) {
    throw new Error(`Unable to enumerate tracked generated outputs in Git worktree ${root}.`, { cause });
  }
}

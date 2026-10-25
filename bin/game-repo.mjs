/** WHICH GAME TREE THE SITE IS BUILT FROM (site-step-deployed-tree, 2026-10-25).
 *
 *  The game's deploy runs this site's build as its last step, and for months the
 *  site read `../whomp` whatever the deploy had shipped: on the Mac that is the
 *  canonical checkout, where the lander keeps merging rows mid-wave, while the
 *  train builds and gates its own clone. The 6:56 pm 2026-10-24 deploy's site
 *  step refused (wiki-visuals --verify, 411) on a tree that was not the one it
 *  had just published.
 *
 *  So the tree is a parameter. Precedence: an explicit `--repo PATH`, then
 *  `WHOMP_GAME_REPO` (what the game's deploy scripts set to their own checkout),
 *  then `../whomp`, so a hand run from this repo is unchanged. A relative path
 *  resolves against `cwd`, as `--repo` always did.
 */
import { resolve } from 'node:path';

export const DEFAULT_GAME_REPO = '../whomp';

export function resolveGameRepo(args = [], env = {}, cwd = process.cwd()) {
  const i = args.indexOf('--repo');
  const fromFlag = i >= 0 && args[i + 1] ? args[i + 1] : '';
  const fromEnv = typeof env.WHOMP_GAME_REPO === 'string' ? env.WHOMP_GAME_REPO : '';
  return resolve(cwd, fromFlag || fromEnv || DEFAULT_GAME_REPO);
}

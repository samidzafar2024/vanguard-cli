/**
 * `vanguard shell` — open an interactive Claude Code session inside the Kali worker container.
 *
 * Mounts:
 *   ~/.claude         → /root/.claude  (auth tokens, skills, settings — no re-login needed)
 *   vanguard-security → /vanguard      (prompts + scripts for /pentest skill)
 *   <repo>            → /repo          (target repository, set as working directory)
 *
 * Sets VANGUARD_DIR=/vanguard so the /pentest skill resolves prompts from the container path.
 */

import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepo } from '../paths.js';

interface ShellOptions {
  repo: string;
}

export function shell(opts: ShellOptions): void {
  const { hostPath: repoPath } = resolveRepo(opts.repo);
  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');

  // compiled file lives at apps/cli/dist/index.mjs → 3 levels up = vanguard-security/
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const vanguardSecurityDir = path.resolve(__dirname, '..', '..', '..');

  console.log('Starting Kali Linux + Claude Code shell...');
  console.log(`  Repo:    ${repoPath}`);
  console.log(`  Auth:    ${claudeDir}`);
  console.log(`  Prompts: ${vanguardSecurityDir}`);
  console.log('');
  console.log('Inside the container, run:');
  console.log('  /pentest https://your-target.com');
  console.log('');

  try {
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-it',
        '--name', 'vanguard-shell',
        // Bypass worker entrypoint, run as host user so mounted auth files are writable
        '--entrypoint', '',
        '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        '-e', 'HOME=/tmp',
        // Auth tokens file + skills/settings dir — container HOME is /tmp
        '-v', `${path.join(homeDir, '.claude.json')}:/tmp/.claude.json`,
        '-v', `${claudeDir}:/tmp/.claude`,
        // Vanguard prompts + scripts at /vanguard
        '-v', `${vanguardSecurityDir}:/vanguard`,
        // Target repo at /repo
        '-v', `${repoPath}:/repo`,
        // Working directory
        '-w', '/repo',
        // Tell /pentest skill to look in /vanguard
        '-e', 'VANGUARD_DIR=/vanguard',
        'vanguard-worker',
        'claude',
      ],
      { stdio: 'inherit' },
    );
  } catch {
    // Non-zero exit is normal when the user exits the container
    process.exit(0);
  }
}

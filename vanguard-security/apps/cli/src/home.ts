/**
 * Vanguard state directory management.
 *
 * Local mode (cloned repo): uses ./workspaces/, ./credentials/
 * NPX mode: uses ~/.vanguard/workspaces/, ~/.vanguard/
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getMode } from './mode.js';

const VANGUARD_HOME = path.join(os.homedir(), '.vanguard');

export function getConfigFile(): string {
  return path.join(VANGUARD_HOME, 'config.toml');
}

export function getWorkspacesDir(): string {
  return getMode() === 'local' ? path.resolve('workspaces') : path.join(VANGUARD_HOME, 'workspaces');
}

/**
 * Resolve the Vertex credentials file path.
 *
 * Checks GOOGLE_APPLICATION_CREDENTIALS env var first (may be set by TOML resolver),
 * then falls back to mode-appropriate default location.
 */
export function getCredentialsPath(): string {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) return path.resolve(envPath);

  if (getMode() === 'local') {
    return path.resolve('credentials', 'google-sa-key.json');
  }

  return path.join(VANGUARD_HOME, 'google-sa-key.json');
}

/**
 * Initialize state directories.
 * Local mode: creates ./workspaces/ and ./credentials/
 * NPX mode: creates ~/.vanguard/workspaces/
 */
export function initHome(): void {
  if (getMode() === 'local') {
    fs.mkdirSync(path.resolve('workspaces'), { recursive: true });
    fs.mkdirSync(path.resolve('credentials'), { recursive: true });
  } else {
    fs.mkdirSync(path.join(VANGUARD_HOME, 'workspaces'), { recursive: true });
  }
}

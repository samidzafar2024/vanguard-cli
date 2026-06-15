/** TOML config writer for ~/.vanguard/config.toml. */

import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'smol-toml';
import { getConfigFile } from '../home.js';

// === Types ===

export interface VanguardConfig {
  core?: { max_tokens?: number };
  anthropic?: { api_key?: string; oauth_token?: string };
  custom_base_url?: { base_url?: string; auth_token?: string };
  bedrock?: { use?: boolean; region?: string; token?: string };
  vertex?: { use?: boolean; region?: string; project_id?: string; key_path?: string };
  models?: { small?: string; medium?: string; large?: string };
}

// === File Operations ===

/** Write the config to ~/.vanguard/config.toml with 0o600 permissions. */
export function saveConfig(config: VanguardConfig): void {
  const configPath = getConfigFile();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });

  const content = stringify(config);
  fs.writeFileSync(configPath, content, { mode: 0o600 });
}

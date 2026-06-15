/**
 * `vanguard uninstall` command — remove ~/.vanguard/ after confirmation (npx only).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as p from '@clack/prompts';
import { stopInfra, stopWorkers } from '../docker.js';

const VANGUARD_HOME = path.join(os.homedir(), '.vanguard');

export async function uninstall(): Promise<void> {
  p.intro('Vanguard Uninstall');

  if (!fs.existsSync(VANGUARD_HOME)) {
    p.log.info('Nothing to remove. Vanguard is not configured on this machine.');
    p.outro('Done.');
    return;
  }

  const confirmed = await p.confirm({
    message: 'This will permanently remove all past scan data, saved configurations, and API keys. Continue?',
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Aborted.');
    process.exit(0);
  }

  // Stop any running containers first
  stopWorkers();
  stopInfra(false);

  fs.rmSync(VANGUARD_HOME, { recursive: true, force: true });
  p.log.success('All Vanguard data has been removed.');
  p.outro('Vanguard has been uninstalled. Run `npx @copointai/vanguard setup` to start fresh.');
}

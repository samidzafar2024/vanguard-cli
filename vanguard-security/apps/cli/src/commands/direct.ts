// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Maps agent name → prompt template filename (without .txt extension)
// Matches promptTemplate values in apps/worker/src/session-manager.ts
const AGENT_TEMPLATES: Record<string, string> = {
  profiling: 'profiling',
  'pre-recon': 'pre-recon-code',
  sast: 'sast',
  recon: 'recon',
  'nuclei-scan': 'nuclei-scan',
  'ssl-tls-vuln': 'ssl-tls-vuln',
  'cloud-vuln': 'cloud-vuln',
  'container-vuln': 'container-vuln',
  'injection-vuln': 'vuln-injection',
  'xss-vuln': 'vuln-xss',
  'auth-vuln': 'vuln-auth',
  'ssrf-vuln': 'vuln-ssrf',
  'authz-vuln': 'vuln-authz',
  'injection-exploit': 'exploit-injection',
  'xss-exploit': 'exploit-xss',
  'auth-exploit': 'exploit-auth',
  'ssrf-exploit': 'exploit-ssrf',
  'authz-exploit': 'exploit-authz',
  report: 'report-executive',
};

export interface DirectOptions {
  url: string;
  repo: string;
  workspace?: string;
  pipelineTesting: boolean;
  model?: string;
}

// === Directory Resolution ===

interface Dirs {
  promptsDir: string;
  workerScriptsDir: string;
}

function resolveDirs(): Dirs {
  // After bundling: __dirname = apps/cli/dist/
  // apps/worker/ is at ../../worker/ relative to that
  const workerDir = path.resolve(__dirname, '../../worker');
  const promptsDir = path.join(workerDir, 'prompts');
  const workerScriptsDir = path.join(workerDir, 'dist', 'scripts');

  if (!fs.existsSync(promptsDir)) {
    console.error(`\nERROR: Prompts directory not found: ${promptsDir}`);
    console.error('Make sure you are running from the cloned vanguard-security repo.');
    process.exit(1);
  }

  if (!fs.existsSync(workerScriptsDir)) {
    console.error(`\nERROR: Worker scripts not found: ${workerScriptsDir}`);
    console.error('Run: pnpm run build');
    process.exit(1);
  }

  return { promptsDir, workerScriptsDir };
}

// === Bin Wrappers ===
// Creates a temp directory with shell wrappers for save-deliverable and generate-totp,
// so prompts can invoke them as CLI commands without any PATH setup from the user.

interface Bin {
  binDir: string;
  cleanup: () => void;
}

function setupBin(workerScriptsDir: string): Bin {
  const binDir = path.join(os.tmpdir(), `vanguard-bin-${Date.now()}`);
  fs.mkdirSync(binDir);

  for (const script of ['save-deliverable', 'generate-totp']) {
    const scriptPath = path.join(workerScriptsDir, `${script}.js`);
    const wrapperPath = path.join(binDir, script);
    fs.writeFileSync(wrapperPath, `#!/bin/sh\nexec node "${scriptPath}" "$@"\n`);
    fs.chmodSync(wrapperPath, 0o755);
  }

  return {
    binDir,
    cleanup: () => {
      try {
        fs.rmSync(binDir, { recursive: true });
      } catch {}
    },
  };
}

// === Prompt Loading ===

function resolveIncludes(content: string, baseDir: string): string {
  return content.replace(/@include\(([^)]+)\)/g, (match, rawPath: string) => {
    const fullPath = path.resolve(baseDir, rawPath);
    if (!fs.existsSync(fullPath)) return match;
    // Recurse so nested @include() works
    return resolveIncludes(fs.readFileSync(fullPath, 'utf-8'), baseDir);
  });
}

function loadPrompt(
  agentName: string,
  promptsDir: string,
  pipelineTesting: boolean,
  vars: Record<string, string>,
): string {
  const template = AGENT_TEMPLATES[agentName];
  if (!template) throw new Error(`No template mapped for agent: ${agentName}`);

  const ptPath = path.join(promptsDir, 'pipeline-testing', `${template}.txt`);
  const fullPath = path.join(promptsDir, `${template}.txt`);

  const candidate = pipelineTesting && fs.existsSync(ptPath) ? ptPath : fullPath;

  if (!fs.existsSync(candidate)) {
    throw new Error(`Prompt file not found: ${candidate}`);
  }

  let content = fs.readFileSync(candidate, 'utf-8');
  // @include() paths are always relative to the base prompts dir (not pipeline-testing subdir)
  content = resolveIncludes(content, promptsDir);

  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content;
}

// === Agent Runner ===

function runAgent(
  agentName: string,
  prompt: string,
  workspaceDir: string,
  repoPath: string,
  binDir: string,
  model: string | undefined,
  live: boolean,
): Promise<void> {
  const logPath = path.join(workspaceDir, `${agentName}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const claudeArgs = ['-p', '--dangerously-skip-permissions', '--output-format', 'text', '--no-session-persistence'];
  if (model) claudeArgs.push('--model', model);
  claudeArgs.push(prompt); // positional prompt must be last

  return new Promise((resolve, reject) => {
    const proc = spawn('claude', claudeArgs, {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    });

    if (live) {
      proc.stdout?.pipe(process.stdout, { end: false });
      proc.stderr?.pipe(process.stderr, { end: false });
    }
    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);

    proc.on('close', (code) => {
      logStream.end();
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`[${agentName}] exited with code ${code} — log: ${logPath}`));
      }
    });

    proc.on('error', (err) => {
      logStream.end();
      reject(new Error(`[${agentName}] spawn failed: ${err.message} — is 'claude' in your PATH?`));
    });
  });
}

// === Parallel Wave Reporting ===

function reportWave(results: PromiseSettledResult<void>[], agents: string[]): void {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const name = agents[i] ?? '?';
    if (r === undefined || r.status === 'fulfilled') {
      console.log(`  ✓ ${name}`);
    } else {
      const msg =
        (r as PromiseRejectedResult).reason instanceof Error
          ? (r as PromiseRejectedResult).reason.message
          : String((r as PromiseRejectedResult).reason);
      console.log(`  ✗ ${name} — ${msg}`);
    }
  }
}

// === Main Entry ===

export async function runDirect(opts: DirectOptions): Promise<void> {
  const { url, repo, workspace, pipelineTesting, model } = opts;

  // Validate target repo exists
  const repoPath = path.resolve(repo);
  if (!fs.existsSync(repoPath)) {
    console.error(`\nERROR: Repository not found: ${repoPath}`);
    process.exit(1);
  }

  const { promptsDir, workerScriptsDir } = resolveDirs();
  const { binDir, cleanup } = setupBin(workerScriptsDir);

  // Create workspace directory
  const hostname = new URL(url).hostname.replace(/[^a-z0-9-]/gi, '-');
  const workspaceName = workspace ?? `${hostname}_${Date.now()}`;
  const workspaceDir = path.join(process.cwd(), 'workspaces', workspaceName);
  fs.mkdirSync(workspaceDir, { recursive: true });

  // Shared template variables
  const baseVars: Record<string, string> = {
    WEB_URL: url,
    REPO_PATH: repoPath,
    DESCRIPTION: '',
    AUTH_CONTEXT: 'No authentication context provided.',
    LOGIN_INSTRUCTIONS: '',
    RULES_AVOID: '',
    RULES_FOCUS: '',
  };

  const load = (agent: string, extraVars?: Record<string, string>): string =>
    loadPrompt(agent, promptsDir, pipelineTesting, {
      ...baseVars,
      PLAYWRIGHT_SESSION: crypto.randomUUID(),
      ...extraVars,
    });

  const run = (agent: string, live = false): Promise<void> =>
    runAgent(agent, load(agent), workspaceDir, repoPath, binDir, model, live);

  // Each parallel agent gets its own playwright session ID
  const runParallel = (agent: string): Promise<void> =>
    runAgent(
      agent,
      load(agent, { PLAYWRIGHT_SESSION: crypto.randomUUID() }),
      workspaceDir,
      repoPath,
      binDir,
      model,
      false,
    );

  console.log(`\nVanguard Direct — AI Pentest Pipeline`);
  console.log(`  Target    : ${url}`);
  console.log(`  Repo      : ${repoPath}`);
  console.log(`  Workspace : ${workspaceDir}`);
  console.log(`  Mode      : ${pipelineTesting ? 'pipeline-testing (fast)' : 'full'}`);
  if (model) console.log(`  Model     : ${model}`);
  console.log();

  const t0 = Date.now();

  try {
    // Waves 0–3: Sequential profiling + analysis
    for (const agent of ['profiling', 'pre-recon', 'sast', 'recon']) {
      console.log(`[${agent}] starting...`);
      await run(agent, true);
      console.log(`[${agent}] done\n`);
    }

    // Wave 4: Automated scanning (sequential — each feeds the next)
    for (const agent of ['nuclei-scan', 'ssl-tls-vuln', 'cloud-vuln', 'container-vuln']) {
      console.log(`[${agent}] starting...`);
      await run(agent, true);
      console.log(`[${agent}] done\n`);
    }

    // Wave 5: Vulnerability analysis — 5 agents in parallel
    const vulnAgents = ['injection-vuln', 'xss-vuln', 'auth-vuln', 'ssrf-vuln', 'authz-vuln'];
    console.log(`[vuln-wave] Running ${vulnAgents.length} agents in parallel...`);
    console.log(`  (logs → ${workspaceDir}/<agent>.log)\n`);
    const vulnResults = await Promise.allSettled(vulnAgents.map(runParallel));
    reportWave(vulnResults, vulnAgents);
    console.log();

    // Wave 6: Exploitation — 5 agents in parallel
    const exploitAgents = ['injection-exploit', 'xss-exploit', 'auth-exploit', 'ssrf-exploit', 'authz-exploit'];
    console.log(`[exploit-wave] Running ${exploitAgents.length} agents in parallel...`);
    console.log(`  (logs → ${workspaceDir}/<agent>.log)\n`);
    const exploitResults = await Promise.allSettled(exploitAgents.map(runParallel));
    reportWave(exploitResults, exploitAgents);
    console.log();

    // Wave 7: Final report
    console.log('[report] Generating executive report...');
    await run('report', true);
    console.log('[report] done\n');
  } finally {
    cleanup();
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  console.log(`  Pentest complete in ${mins}m ${secs}s`);
  console.log(`  Deliverables : ${repoPath}/.vanguard/deliverables/`);
  console.log(`  Logs         : ${workspaceDir}/\n`);
}

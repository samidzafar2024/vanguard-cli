/**
 * Vanguard CLI — AI Penetration Testing Framework
 *
 * Unified CLI supporting two modes:
 *   Local mode: Run from cloned repo — builds locally, mounts prompts, uses ./workspaces/
 *   NPX mode:   Run via npx — pulls from Docker Hub, uses ~/.vanguard/
 *
 * Mode is auto-detected based on presence of Dockerfile + docker-compose.yml + prompts/
 * in the current working directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approve } from './commands/approve.js';
import { shell } from './commands/shell.js';
import { build } from './commands/build.js';
import { runDirect } from './commands/direct.js';
import { installDeps } from './commands/install-deps.js';
import { logs } from './commands/logs.js';
import { setup } from './commands/setup.js';
import { start } from './commands/start.js';
import { status } from './commands/status.js';
import { stop } from './commands/stop.js';
import { uninstall } from './commands/uninstall.js';
import { workspaces } from './commands/workspaces.js';
import { getMode } from './mode.js';
import { displaySplash } from './splash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function showHelp(): void {
  const mode = getMode();
  const prefix = mode === 'local' ? './vanguard' : 'npx @copointai/vanguard';

  console.log(`
Vanguard - AI Penetration Testing Framework

Usage:${
    mode === 'local'
      ? ''
      : `
  ${prefix} setup                                       Configure credentials`
  }
  ${prefix} start --url <url> --repo <path> [options]   Start a pentest scan
  ${prefix} stop [--clean]                               Stop all containers
  ${prefix} workspaces                                   List all workspaces
  ${prefix} logs <workspace>                             Tail workflow log
  ${prefix} approve <workspace>                          Approve kill-chain phase
  ${prefix} status                                       Show running workers${
    mode === 'local'
      ? `
  ${prefix} build [--no-cache]                           Build worker image`
      : `
  ${prefix} uninstall                                    Remove ~/.vanguard/ and all data`
  }
  ${prefix} shell -r <path>                               Open Kali Linux + Claude Code interactive shell
  ${prefix} install-deps [--install]                     Check and optionally install required security tools
  ${prefix} direct -u <url> -r <path> [options]          Run full pipeline via Claude Code (no Docker)
  ${prefix} info                                         Show splash screen
  ${prefix} help                                         Show this help

Options for 'start':
  -u, --url <url>           Target URL (required)
  -r, --repo <path>         Repository path${mode === 'local' ? ' or bare name' : ''} (required)
  -c, --config <path>       Configuration file (YAML)
  -o, --output <path>       Copy deliverables to this directory after run
  -w, --workspace <name>    Named workspace (auto-resumes if exists)
      --recon-url <url>     Separate URL for OSINT/recon phases (default: --url)
      --pipeline-testing    Use minimal prompts for fast testing
      --debug               Preserve worker container after exit for log inspection

Options for 'direct' (no Docker required — uses Claude Code CLI):
  -u, --url <url>           Target URL (required)
  -r, --repo <path>         Repository path (required)
  -w, --workspace <name>    Named workspace for logs
      --model <model>       Claude model (e.g. opus, sonnet, claude-opus-4-7)
      --pipeline-testing    Use minimal prompts for fast testing

Examples:
  ${prefix} start -u https://example.com -r ${mode === 'local' ? 'my-repo' : './my-repo'}
  ${prefix} start -u https://example.com -r /path/to/repo -c config.yaml -w q1-audit
  ${prefix} direct -u https://example.com -r /path/to/repo
  ${prefix} direct -u https://example.com -r /path/to/repo --pipeline-testing
  ${prefix} logs q1-audit
  ${prefix} stop --clean
${
  mode === 'local'
    ? `
State directory: ./workspaces/`
    : `
State directory: ~/.vanguard/`
}
Monitor workflows at http://localhost:8233
`);
}

interface ParsedStartArgs {
  url: string;
  reconUrl?: string;
  repo: string;
  config?: string;
  workspace?: string;
  output?: string;
  pipelineTesting: boolean;
  debug: boolean;
}

function parseStartArgs(argv: string[]): ParsedStartArgs {
  let url = '';
  let repo = '';
  let config: string | undefined;
  let workspace: string | undefined;
  let output: string | undefined;
  let reconUrl: string | undefined;
  let pipelineTesting = false;
  let debug = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '-u':
      case '--url':
        if (next && !next.startsWith('-')) {
          url = next;
          i++;
        }
        break;
      case '-r':
      case '--repo':
        if (next && !next.startsWith('-')) {
          repo = next;
          i++;
        }
        break;
      case '-c':
      case '--config':
        if (next && !next.startsWith('-')) {
          config = next;
          i++;
        }
        break;
      case '-w':
      case '--workspace':
        if (next && !next.startsWith('-')) {
          workspace = next;
          i++;
        }
        break;
      case '-o':
      case '--output':
        if (next && !next.startsWith('-')) {
          output = next;
          i++;
        }
        break;
      case '--pipeline-testing':
        pipelineTesting = true;
        break;
      case '--debug':
        debug = true;
        break;
      case '--recon-url':
        if (next && !next.startsWith('-')) {
          reconUrl = next;
          i++;
        }
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error(`Run "${getMode() === 'local' ? './vanguard' : 'npx @copointai/vanguard'} help" for usage`);
        process.exit(1);
    }
  }

  if (!url || !repo) {
    console.error('ERROR: --url and --repo are required');
    console.error(
      `Usage: ${getMode() === 'local' ? './vanguard' : 'npx @copointai/vanguard'} start -u <url> -r <path>`,
    );
    process.exit(1);
  }

  return {
    url,
    repo,
    pipelineTesting,
    debug,
    ...(config && { config }),
    ...(workspace && { workspace }),
    ...(output && { output }),
    ...(reconUrl && { reconUrl }),
  };
}

function parseDirectArgs(argv: string[]): import('./commands/direct.js').DirectOptions {
  let url = '';
  let repo = '';
  let workspace: string | undefined;
  let model: string | undefined;
  let pipelineTesting = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '-u':
      case '--url':
        if (next && !next.startsWith('-')) {
          url = next;
          i++;
        }
        break;
      case '-r':
      case '--repo':
        if (next && !next.startsWith('-')) {
          repo = next;
          i++;
        }
        break;
      case '-w':
      case '--workspace':
        if (next && !next.startsWith('-')) {
          workspace = next;
          i++;
        }
        break;
      case '--model':
        if (next && !next.startsWith('-')) {
          model = next;
          i++;
        }
        break;
      case '--pipeline-testing':
        pipelineTesting = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  if (!url || !repo) {
    console.error('ERROR: --url and --repo are required');
    console.error('Usage: ./vanguard direct -u <url> -r <path>');
    process.exit(1);
  }

  return {
    url,
    repo,
    pipelineTesting,
    ...(workspace && { workspace }),
    ...(model && { model }),
  };
}

// === Main Dispatch ===

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'start': {
    const parsed = parseStartArgs(args.slice(1));
    await start({ ...parsed, version: getVersion() });
    break;
  }
  case 'stop':
    stop(args.includes('--clean'));
    break;
  case 'logs': {
    const workspaceId = args[1];
    if (!workspaceId) {
      console.error('ERROR: Workspace ID is required');
      console.error(`Usage: ${getMode() === 'local' ? './vanguard' : 'npx @copointai/vanguard'} logs <workspace>`);
      process.exit(1);
    }
    logs(workspaceId);
    break;
  }
  case 'approve': {
    const workspaceName = args[1];
    if (!workspaceName) {
      console.error('ERROR: Workspace name is required');
      console.error(`Usage: ${getMode() === 'local' ? './vanguard' : 'npx @copointai/vanguard'} approve <workspace>`);
      process.exit(1);
    }
    approve(workspaceName);
    break;
  }
  case 'workspaces':
    workspaces(getVersion());
    break;
  case 'status':
    status();
    break;
  case 'setup':
    if (getMode() === 'local') {
      console.error('ERROR: setup is only available in npx mode. In local mode, use .env');
      process.exit(1);
    }
    setup();
    break;
  case 'build':
    build(args.includes('--no-cache'));
    break;
  case 'uninstall':
    if (getMode() === 'local') {
      console.error('ERROR: uninstall is only available in npx mode.');
      process.exit(1);
    }
    uninstall();
    break;
  case 'shell': {
    const shellRepo = args[1] === '-r' ? args[2] : args[1];
    if (!shellRepo) {
      console.error('ERROR: repo path is required');
      console.error(`Usage: ${getMode() === 'local' ? './vanguard' : 'npx @copointai/vanguard'} shell -r <path>`);
      process.exit(1);
    }
    shell({ repo: shellRepo });
    break;
  }
  case 'install-deps':
    installDeps(args.includes('--install'));
    break;
  case 'direct': {
    const directArgs = args.slice(1);
    const directParsed = parseDirectArgs(directArgs);
    await runDirect(directParsed);
    break;
  }
  case 'info':
    displaySplash(getMode() === 'local' ? undefined : getVersion());
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}

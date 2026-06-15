// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';

interface DepStatus {
  name: string;
  installed: boolean;
  version?: string;
  installHint: string;
}

function checkCommand(cmd: string): { installed: boolean; version?: string } {
  try {
    const result = spawnSync(cmd, ['--version'], { timeout: 5000 });
    if (result.status === 0) {
      const out = result.stdout ? result.stdout.toString() : '';
      const err = result.stderr ? result.stderr.toString() : '';
      const ver = (out || err).split('\n')[0]?.trim() ?? '';
      return { installed: true, version: ver };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

function checkCommandAlt(cmd: string, args: string[]): { installed: boolean; version?: string } {
  try {
    const result = spawnSync(cmd, args, { timeout: 5000 });
    if (result.status === 0 || result.status === 1) {
      const out = result.stdout ? result.stdout.toString() : '';
      const err = result.stderr ? result.stderr.toString() : '';
      const ver = (out || err).split('\n')[0]?.trim() ?? '';
      return { installed: true, version: ver };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

function isMac(): boolean {
  return os.platform() === 'darwin';
}

function isLinux(): boolean {
  return os.platform() === 'linux';
}

function hasBrewCommand(): boolean {
  return checkCommand('brew').installed;
}

function hasGoCommand(): boolean {
  return checkCommand('go').installed;
}

function hasPipCommand(): boolean {
  return checkCommand('pip3').installed || checkCommand('pip').installed;
}

export function installDeps(installMissing: boolean): void {
  console.log('\nVanguard — Security Tool Dependency Checker\n');
  console.log('Checking required tools for the full 6-wave pipeline...\n');

  const deps: Array<{
    name: string;
    check: () => { installed: boolean; version?: string };
    category: string;
    brewFormula?: string;
    goInstall?: string;
    pipInstall?: string;
    aptInstall?: string;
    manual?: string;
  }> = [
    // Recon / profiling
    { name: 'nmap', check: () => checkCommand('nmap'), category: 'Recon', brewFormula: 'nmap', aptInstall: 'nmap' },
    {
      name: 'subfinder',
      check: () => checkCommand('subfinder'),
      category: 'Recon',
      goInstall: 'github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest',
      manual: 'https://github.com/projectdiscovery/subfinder',
    },
    {
      name: 'httpx',
      check: () => checkCommandAlt('httpx', ['-version']),
      category: 'Recon',
      goInstall: 'github.com/projectdiscovery/httpx/cmd/httpx@latest',
      manual: 'https://github.com/projectdiscovery/httpx',
    },
    {
      name: 'whatweb',
      check: () => checkCommand('whatweb'),
      category: 'Recon',
      brewFormula: 'whatweb',
      aptInstall: 'whatweb',
    },

    // SAST
    {
      name: 'semgrep',
      check: () => checkCommand('semgrep'),
      category: 'SAST',
      pipInstall: 'semgrep',
      manual: 'https://semgrep.dev/docs/getting-started/',
    },
    {
      name: 'gitleaks',
      check: () => checkCommand('gitleaks'),
      category: 'SAST',
      brewFormula: 'gitleaks',
      goInstall: 'github.com/gitleaks/gitleaks/v8@latest',
      manual: 'https://github.com/gitleaks/gitleaks',
    },
    {
      name: 'trivy',
      check: () => checkCommand('trivy'),
      category: 'SAST/Container',
      brewFormula: 'aquasecurity/trivy/trivy',
      manual: 'https://aquasecurity.github.io/trivy/latest/getting-started/installation/',
    },

    // Automated scanning
    {
      name: 'nuclei',
      check: () => checkCommand('nuclei'),
      category: 'Scanner',
      goInstall: 'github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest',
      manual: 'https://github.com/projectdiscovery/nuclei',
    },
    {
      name: 'ffuf',
      check: () => checkCommand('ffuf'),
      category: 'Fuzzing',
      goInstall: 'github.com/ffuf/ffuf/v2@latest',
      brewFormula: 'ffuf',
      manual: 'https://github.com/ffuf/ffuf',
    },
    {
      name: 'nikto',
      check: () => checkCommand('nikto'),
      category: 'Scanner',
      brewFormula: 'nikto',
      aptInstall: 'nikto',
    },

    // SSL/TLS
    {
      name: 'testssl',
      check: () => checkCommandAlt('testssl', ['--help']),
      category: 'SSL/TLS',
      manual: 'https://testssl.sh — download and add to PATH',
    },
    {
      name: 'openssl',
      check: () => checkCommand('openssl'),
      category: 'SSL/TLS',
      brewFormula: 'openssl',
      aptInstall: 'openssl',
    },

    // Vulnerability testing
    {
      name: 'sqlmap',
      check: () => checkCommand('sqlmap'),
      category: 'Vuln Testing',
      pipInstall: 'sqlmap',
      manual: 'https://sqlmap.org',
    },
    {
      name: 'dalfox',
      check: () => checkCommand('dalfox'),
      category: 'Vuln Testing',
      goInstall: 'github.com/hahwul/dalfox/v2@latest',
      brewFormula: 'dalfox',
      manual: 'https://github.com/hahwul/dalfox',
    },
    {
      name: 'jwt_tool',
      check: () => checkCommandAlt('jwt_tool', ['-h']),
      category: 'Vuln Testing',
      manual: 'https://github.com/ticarpi/jwt_tool — pip install jwt_tool',
    },

    // Cloud security
    {
      name: 'prowler',
      check: () => checkCommand('prowler'),
      category: 'Cloud',
      pipInstall: 'prowler',
      manual: 'https://github.com/prowler-cloud/prowler',
    },
    {
      name: 'checkov',
      check: () => checkCommand('checkov'),
      category: 'IaC',
      pipInstall: 'checkov',
      manual: 'https://github.com/bridgecrewio/checkov',
    },

    // System tools
    { name: 'dig', check: () => checkCommand('dig'), category: 'DNS', aptInstall: 'bind-utils', brewFormula: 'bind' },
    { name: 'whois', check: () => checkCommand('whois'), category: 'OSINT', brewFormula: 'whois', aptInstall: 'whois' },
    { name: 'curl', check: () => checkCommand('curl'), category: 'HTTP', brewFormula: 'curl', aptInstall: 'curl' },
  ];

  const statuses: DepStatus[] = [];
  let installed = 0;
  let missing = 0;

  for (const dep of deps) {
    const result = dep.check();
    let installHint = '';

    if (!result.installed) {
      missing++;
      if (isMac() && hasBrewCommand() && dep.brewFormula) {
        installHint = `brew install ${dep.brewFormula}`;
      } else if (hasGoCommand() && dep.goInstall) {
        installHint = `go install ${dep.goInstall}`;
      } else if (hasPipCommand() && dep.pipInstall) {
        installHint = `pip3 install ${dep.pipInstall}`;
      } else if (isLinux() && dep.aptInstall) {
        installHint = `apt install ${dep.aptInstall}`;
      } else {
        installHint = dep.manual ?? 'manual install required';
      }
    } else {
      installed++;
    }

    statuses.push({
      name: dep.name,
      installed: result.installed,
      installHint,
      ...(result.version !== undefined && { version: result.version }),
    });
  }

  // Print results grouped by category
  const categories = [...new Set(deps.map((d) => d.category))];

  for (const cat of categories) {
    const catDeps = statuses.filter((s) => deps.find((d) => d.name === s.name)?.category === cat);
    console.log(`\n  ${cat}`);
    console.log('  ' + '─'.repeat(40));
    for (const s of catDeps) {
      const icon = s.installed ? '✓' : '✗';
      const nameCol = s.name.padEnd(16);
      if (s.installed) {
        const ver = s.version ? ` (${s.version.substring(0, 40)})` : '';
        console.log(`  ${icon} ${nameCol}${ver}`);
      } else {
        console.log(`  ${icon} ${nameCol}→ ${s.installHint}`);
      }
    }
  }

  console.log(`\n  ─────────────────────────────────────────`);
  console.log(`  ${installed}/${statuses.length} tools installed, ${missing} missing`);

  if (missing > 0 && installMissing) {
    console.log('\n  Auto-installing missing tools...\n');
    const macBrew = isMac() && hasBrewCommand();
    const hasGo = hasGoCommand();
    const hasPip = hasPipCommand();

    for (const dep of deps) {
      const s = statuses.find((x) => x.name === dep.name);
      if (!s || s.installed) continue;

      let cmd = '';
      if (macBrew && dep.brewFormula) {
        cmd = `brew install ${dep.brewFormula}`;
      } else if (hasGo && dep.goInstall) {
        cmd = `go install ${dep.goInstall}`;
      } else if (hasPip && dep.pipInstall) {
        cmd = `pip3 install ${dep.pipInstall}`;
      }

      if (cmd) {
        console.log(`  Installing ${dep.name}: ${cmd}`);
        try {
          execSync(cmd, { stdio: 'inherit' });
          console.log(`  ✓ ${dep.name} installed`);
        } catch {
          console.log(`  ✗ ${dep.name} failed — install manually: ${s.installHint}`);
        }
      } else {
        console.log(`  ⚠ ${dep.name} — manual install required: ${s.installHint}`);
      }
    }
  } else if (missing > 0) {
    console.log('\n  Run with --install to auto-install missing tools where possible.\n');
  } else {
    console.log('\n  All tools ready. Run vanguard start to begin a scan.\n');
  }
}

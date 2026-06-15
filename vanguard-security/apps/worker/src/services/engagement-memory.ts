// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Cross-engagement memory service.
 *
 * Persists key findings from each scan run to a per-domain JSON file.
 * Before a new scan on the same domain, previous findings are loaded and
 * passed to the brain-planner for history-aware prioritization.
 *
 * Memory files are stored at: <workspacesDir>/_memory/<sanitized-domain>.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface EngagementMemoryEntry {
  timestamp: string;
  workspaceId: string;
  findings: string[]; // high-level finding summaries
  criticalChains: string[]; // exploit chains found
  techStack: string[]; // detected technologies
}

export interface DomainMemory {
  domain: string;
  engagements: EngagementMemoryEntry[];
}

/**
 * Sanitize a domain string for use as a filename.
 * Replaces dots, slashes, colons, and other special characters with underscores.
 */
function sanitizeDomain(domain: string): string {
  return domain.replace(/[./\\:@?#&=%+]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Derive the memory file path for a given domain.
 */
function memoryFilePath(domain: string, workspacesDir: string): string {
  const memoryDir = path.join(workspacesDir, '_memory');
  return path.join(memoryDir, `${sanitizeDomain(domain)}.json`);
}

/**
 * Extract the domain from a URL string.
 * Falls back to the raw value if URL parsing fails.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch {
    return url;
  }
}

/**
 * Load previous engagement memory for a domain.
 *
 * Returns null if no memory file exists yet (first scan for this domain).
 */
export async function loadDomainMemory(domain: string, workspacesDir: string): Promise<DomainMemory | null> {
  const normalized = extractDomain(domain);
  const filePath = memoryFilePath(normalized, workspacesDir);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as DomainMemory;
  } catch {
    return null;
  }
}

/**
 * Save findings from the current engagement to persistent domain memory.
 *
 * Creates the memory directory and file if they do not yet exist.
 * Appends a new entry to existing memory (up to 10 most recent entries).
 */
export async function saveEngagementFindings(
  domain: string,
  workspaceId: string,
  workspacesDir: string,
  entry: Omit<EngagementMemoryEntry, 'timestamp' | 'workspaceId'>,
): Promise<void> {
  const normalized = extractDomain(domain);
  const filePath = memoryFilePath(normalized, workspacesDir);
  const memoryDir = path.dirname(filePath);

  await fs.mkdir(memoryDir, { recursive: true });

  let existing: DomainMemory;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    existing = JSON.parse(content) as DomainMemory;
  } catch {
    existing = { domain: normalized, engagements: [] };
  }

  const newEntry: EngagementMemoryEntry = {
    timestamp: new Date().toISOString(),
    workspaceId,
    ...entry,
  };

  // Keep the 10 most recent engagements to bound file size
  existing.engagements = [...existing.engagements, newEntry].slice(-10);

  await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf8');
}

/**
 * Format domain memory as a human-readable string for injection into the brain-planner prompt.
 *
 * Produces a compact multi-engagement summary that highlights repeated findings,
 * confirmed exploit chains, and the known tech stack.
 */
export function formatMemoryForPrompt(memory: DomainMemory): string {
  if (memory.engagements.length === 0) {
    return '';
  }

  const lines: string[] = [
    `Domain: ${memory.domain}`,
    `Previous engagements: ${memory.engagements.length}`,
    '',
  ];

  for (const [index, engagement] of memory.engagements.entries()) {
    const date = new Date(engagement.timestamp).toISOString().split('T')[0];
    lines.push(`### Engagement ${index + 1} (${date}, workspace: ${engagement.workspaceId})`);

    if (engagement.techStack.length > 0) {
      lines.push(`Tech stack: ${engagement.techStack.join(', ')}`);
    }

    if (engagement.findings.length > 0) {
      lines.push('Key findings:');
      for (const finding of engagement.findings) {
        lines.push(`- ${finding}`);
      }
    }

    if (engagement.criticalChains.length > 0) {
      lines.push('Critical chains:');
      for (const chain of engagement.criticalChains) {
        lines.push(`- ${chain}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

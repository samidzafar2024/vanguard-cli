/**
 * `vanguard approve` command — unblock a paused kill-chain phase.
 *
 * Reads the workflow ID from the workspace's session.json and sends
 * the approveKillChain signal via the Temporal CLI running inside
 * the vanguard-temporal container.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getWorkspacesDir } from '../home.js';

interface SessionJson {
  session: {
    id: string;
    originalWorkflowId?: string;
    resumeAttempts?: Array<{ workflowId: string }>;
  };
}

function resolveWorkflowId(workspaceName: string): string {
  const workspacesDir = getWorkspacesDir();
  const sessionPath = path.join(workspacesDir, workspaceName, 'session.json');

  if (!fs.existsSync(sessionPath)) {
    console.error(`ERROR: Workspace not found: ${workspaceName}`);
    console.error(`  Expected: ${sessionPath}`);
    process.exit(1);
  }

  let session: SessionJson;
  try {
    session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) as SessionJson;
  } catch {
    console.error(`ERROR: Could not read session.json for workspace: ${workspaceName}`);
    process.exit(1);
  }

  // Prefer the most recent workflow: last resume attempt, then originalWorkflowId, then id
  const resumeAttempts = session.session.resumeAttempts ?? [];
  const workflowId =
    resumeAttempts.at(-1)?.workflowId ?? session.session.originalWorkflowId ?? session.session.id;

  if (!workflowId) {
    console.error(`ERROR: No workflow ID found in session.json for workspace: ${workspaceName}`);
    process.exit(1);
  }

  return workflowId;
}

export function approve(workspaceName: string): void {
  const workflowId = resolveWorkflowId(workspaceName);

  console.log(`Approving kill chain for workflow: ${workflowId}`);

  try {
    execFileSync(
      'docker',
      [
        'exec',
        'vanguard-temporal',
        'temporal',
        'workflow',
        'signal',
        '--workflow-id',
        workflowId,
        '--name',
        'approveKillChain',
        '--address',
        'localhost:7233',
      ],
      { stdio: 'inherit' },
    );
    console.log('Kill chain approved — pipeline will continue.');
  } catch {
    console.error('ERROR: Failed to send approval signal.');
    console.error('  Make sure the Temporal container is running: docker ps | grep vanguard-temporal');
    console.error(`  And the workflow is still paused: http://localhost:8233/namespaces/default/workflows/${workflowId}`);
    process.exit(1);
  }
}

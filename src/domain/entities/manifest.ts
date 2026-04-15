import type { AgentRole } from './agent.js'
import type { ProjectType, Track } from './project.js'

/**
 * Document status in the workflow.
 */
export type DocumentStatus = 'draft' | 'in-review' | 'approved' | 'superseded'

/**
 * Task status for tracking progress.
 */
export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'completed'

/**
 * Phase definition in the manifest.
 * Maps workflow phases to their agents, inputs, outputs, and templates.
 */
export interface ManifestPhase {
	readonly agent: AgentRole
	readonly description: string
	readonly inputs: readonly string[]
	readonly outputs: readonly string[]
	readonly templates?: readonly string[] | undefined
}

/**
 * Agent reference in the manifest.
 * Provides quick lookup without loading full agent file.
 */
export interface ManifestAgent {
	readonly role: AgentRole
	readonly file: string
	readonly capabilities: readonly string[]
}

/**
 * Document entry with summary for context-efficient lookup.
 * The summary allows Claude to find relevant docs without reading full content.
 */
export interface ManifestDocument {
	readonly path: string
	readonly summary: string
	readonly keywords: readonly string[]
	readonly status: DocumentStatus
	readonly createdAt: string
	readonly updatedAt: string
	readonly dependsOn?: readonly string[] | undefined
}

/**
 * Task entry with full context for workflow tracking.
 */
export interface ManifestTask {
	readonly path: string
	readonly title: string
	readonly summary: string
	readonly status: TaskStatus
	readonly feature: string
	readonly sequence: number
	readonly dependsOn?: readonly string[] | undefined
	readonly blockedBy?: string | undefined
	readonly assignedAgent?: AgentRole | undefined
}

/**
 * Document registry organized by type.
 */
export interface ManifestDocuments {
	readonly constitution: string
	readonly specs: Record<string, ManifestDocument>
	readonly plans: Record<string, ManifestDocument>
	readonly tasks: Record<string, ManifestTask>
}

/**
 * Project Manifest - the central registry for Vanguard project structure.
 *
 * The manifest serves three purposes:
 * 1. **Discovery** - Claude reads one file to understand project structure
 * 2. **State tracking** - Documents and tasks have status, enabling workflow awareness
 * 3. **Context efficiency** - Summaries and keywords enable finding relevant docs without loading all
 *
 * Developer Experience:
 * - `vanguard init` generates initial manifest
 * - `vanguard sync` updates manifest from file system
 * - Phase commands read manifest first to understand current state
 * - Agents can update manifest when creating/completing documents
 */
export interface Manifest {
	readonly vanguard: {
		readonly version: string
		readonly generatedAt: string
	}

	readonly project: {
		readonly name: string
		readonly type: ProjectType
		readonly track: Track
		readonly rootPath: string
	}

	readonly phases: Record<string, ManifestPhase>

	readonly agents: Record<string, ManifestAgent>

	readonly documents: ManifestDocuments
}

/**
 * Factory functions for creating manifest entries.
 */
export const ManifestFactory = {
	/**
	 * Create a new document entry.
	 */
	createDocument(params: {
		path: string
		summary: string
		keywords: string[]
		status?: DocumentStatus
		dependsOn?: string[]
	}): ManifestDocument {
		const now = new Date().toISOString()
		return {
			path: params.path,
			summary: params.summary,
			keywords: params.keywords,
			status: params.status ?? 'draft',
			createdAt: now,
			updatedAt: now,
			dependsOn: params.dependsOn,
		}
	},

	/**
	 * Create a new task entry.
	 */
	createTask(params: {
		path: string
		title: string
		summary: string
		feature: string
		sequence: number
		status?: TaskStatus
		dependsOn?: string[]
	}): ManifestTask {
		return {
			path: params.path,
			title: params.title,
			summary: params.summary,
			status: params.status ?? 'pending',
			feature: params.feature,
			sequence: params.sequence,
			dependsOn: params.dependsOn,
		}
	},

	/**
	 * Update document status.
	 */
	updateDocumentStatus(doc: ManifestDocument, status: DocumentStatus): ManifestDocument {
		return {
			...doc,
			status,
			updatedAt: new Date().toISOString(),
		}
	},

	/**
	 * Update task status.
	 */
	updateTaskStatus(task: ManifestTask, status: TaskStatus, blockedBy?: string): ManifestTask {
		return {
			...task,
			status,
			blockedBy: status === 'blocked' ? blockedBy : undefined,
		}
	},
}

import type { Agent, AgentRole } from '../entities/agent.js'
import type { Identifier } from '../value-objects/identifier.js'

/**
 * Repository interface for Agent entities.
 */
export interface AgentRepository {
	/**
	 * Find an agent by its identifier.
	 */
	findById(id: Identifier): Promise<Agent | undefined>

	/**
	 * Find an agent by its role.
	 */
	findByRole(role: AgentRole): Promise<Agent | undefined>

	/**
	 * Find all agents.
	 */
	findAll(): Promise<readonly Agent[]>

	/**
	 * Find the agent that handles a specific phase.
	 */
	findByPhase(phase: string): Promise<Agent | undefined>

	/**
	 * Check if an agent exists.
	 */
	exists(id: Identifier): Promise<boolean>
}

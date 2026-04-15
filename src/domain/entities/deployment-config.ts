/**
 * Supported deployment platforms.
 */
export type DeploymentTarget = 'vercel' | 'railway' | 'azure-aca' | 'aws-ecs' | 'none'

/**
 * Deployment environment names.
 */
export type DeploymentEnvironment = 'development' | 'staging' | 'production'

/**
 * Deployment configuration for a project.
 * Defines deployment targets, primary platform, and environments.
 */
export interface DeploymentConfig {
	/**
	 * Available deployment targets for this project.
	 * Multiple targets allow deploying to different platforms for different purposes.
	 */
	readonly targets: readonly DeploymentTarget[]

	/**
	 * Primary deployment target - the main production environment.
	 */
	readonly primary: DeploymentTarget

	/**
	 * Deployment environments (development, staging, production).
	 */
	readonly environments: readonly DeploymentEnvironment[]
}

/**
 * Create a default deployment configuration with no deployment.
 */
export function createDefaultDeploymentConfig(): DeploymentConfig {
	return {
		targets: ['none'],
		primary: 'none',
		environments: ['development'],
	}
}

/**
 * Validate deployment configuration.
 */
export function validateDeploymentConfig(config: DeploymentConfig): void {
	if (config.targets.length === 0) {
		throw new Error('Deployment config must have at least one target')
	}

	if (!config.targets.includes(config.primary)) {
		throw new Error(`Primary deployment target '${config.primary}' must be in targets list`)
	}

	if (config.environments.length === 0) {
		throw new Error('Deployment config must have at least one environment')
	}
}

/**
 * Get the deployment platform display name.
 */
export function getDeploymentTargetName(target: DeploymentTarget): string {
	switch (target) {
		case 'vercel':
			return 'Vercel'
		case 'railway':
			return 'Railway'
		case 'azure-aca':
			return 'Azure Container Apps'
		case 'aws-ecs':
			return 'AWS ECS'
		case 'none':
			return 'No Deployment'
	}
}

/**
 * Get the deployment platform description.
 */
export function getDeploymentTargetDescription(target: DeploymentTarget): string {
	switch (target) {
		case 'vercel':
			return 'Next.js, React, static sites, serverless functions'
		case 'railway':
			return 'Full-stack apps, databases, background workers'
		case 'azure-aca':
			return 'Enterprise containerized apps, microservices'
		case 'aws-ecs':
			return 'Production-grade container orchestration'
		case 'none':
			return 'Manual deployment or not configured'
	}
}

import type { Project, ProjectConfig } from '../entities/project.js'
import type { FilePath } from '../value-objects/file-path.js'

/**
 * Repository interface for Project entities.
 */
export interface ProjectRepository {
	/**
	 * Save a project configuration.
	 */
	save(project: Project): Promise<void>

	/**
	 * Load a project from a directory.
	 */
	load(rootPath: FilePath): Promise<Project | undefined>

	/**
	 * Check if a Vanguard project exists at the given path.
	 */
	exists(rootPath: FilePath): Promise<boolean>

	/**
	 * Delete a project configuration.
	 */
	delete(rootPath: FilePath): Promise<void>
}

/**
 * Service interface for project file operations.
 */
export interface ProjectFileService {
	/**
	 * Initialize the .vanguard directory structure.
	 */
	initializeDirectory(project: Project): Promise<void>

	/**
	 * Write the constitution document.
	 */
	writeConstitution(project: Project, content: string): Promise<void>

	/**
	 * Read the constitution document.
	 */
	readConstitution(project: Project): Promise<string | undefined>

	/**
	 * Write project configuration.
	 */
	writeConfig(project: Project): Promise<void>

	/**
	 * Read project configuration.
	 */
	readConfig(rootPath: FilePath): Promise<ProjectConfig | undefined>

	/**
	 * Generate Claude Code slash commands.
	 */
	generateSlashCommands(project: Project): Promise<void>

	/**
	 * Generate CLAUDE.md file.
	 */
	generateClaudeMd(project: Project): Promise<void>
}

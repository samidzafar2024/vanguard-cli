/**
 * Auth Command Group - Manage Vanguard authentication
 */

import { Command } from 'commander'
import { createAuthStatusCommand, createLoginCommand, createLogoutCommand } from './login.js'

export const authCommand = new Command('auth')
	.description('Manage Vanguard authentication')
	.addCommand(createLoginCommand())
	.addCommand(createLogoutCommand())
	.addCommand(createAuthStatusCommand())

// Also export standalone commands for convenience
export const loginCommand = createLoginCommand()
export const logoutCommand = createLogoutCommand()

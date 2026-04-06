import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

function getProjectRoot(): string {
	return process.cwd()
}

function getVanguardDir(): string {
	const dir = path.join(getProjectRoot(), '.vanguard')
	if (!fs.existsSync(dir)) {
		console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
		process.exit(1)
	}
	return dir
}

function ensureClaudeDir(): string {
	const claudeDir = path.join(getProjectRoot(), '.claude')
	fs.mkdirSync(claudeDir, { recursive: true })
	return claudeDir
}

export const hooksCommand = new Command('hooks')
	.description('Configure Claude Code hooks for automated workflows')

// vanguard hooks install
hooksCommand
	.command('install')
	.description('Install pre-task and post-task hooks for Claude Code')
	.option('--force', 'Overwrite existing hooks')
	.action((options) => {
		getVanguardDir()
		const claudeDir = ensureClaudeDir()

		const s = p.spinner()
		s.start('Installing hooks...')

		// Create hooks directory
		const hooksDir = path.join(claudeDir, 'hooks')
		fs.mkdirSync(hooksDir, { recursive: true })

		// Pre-task hook: injects constitution + current task context
		const preTaskHook = `#!/bin/bash
# Vanguard Pre-Task Hook
# Runs before Claude Code starts working — injects project context

VANGUARD_DIR=".vanguard"
CLAUDE_DIR=".claude"

# Check if vanguard project
if [ ! -d "$VANGUARD_DIR" ]; then
  exit 0
fi

echo "--- Vanguard Context ---"

# Inject constitution summary
if [ -f "$VANGUARD_DIR/constitution.md" ]; then
  echo ""
  echo "## Project Constitution"
  head -30 "$VANGUARD_DIR/constitution.md"
  echo "..."
  echo ""
fi

# Find current in-progress task
CURRENT_TASK=$(grep -rl "status: in-progress" "$VANGUARD_DIR/tasks/" 2>/dev/null | head -1)
if [ -n "$CURRENT_TASK" ]; then
  echo "## Current Task"
  cat "$CURRENT_TASK"
  echo ""
fi

# Inject recent memory items
MEMORY_DIR="$VANGUARD_DIR/memory/items"
if [ -d "$MEMORY_DIR" ]; then
  RECENT=$(find "$MEMORY_DIR" -name "*.md" -type f -newer "$MEMORY_DIR/../config.yaml" 2>/dev/null | head -5)
  if [ -n "$RECENT" ]; then
    echo "## Recent Knowledge"
    for f in $RECENT; do
      echo "- $(head -5 "$f" | grep "title:" | sed 's/title: //' | sed 's/"//g')"
    done
    echo ""
  fi
fi

echo "--- End Vanguard Context ---"
`

		// Post-task hook: prompts to save learnings
		const postTaskHook = `#!/bin/bash
# Vanguard Post-Task Hook
# Runs after Claude Code completes — prompts for knowledge capture

VANGUARD_DIR=".vanguard"

if [ ! -d "$VANGUARD_DIR" ]; then
  exit 0
fi

echo ""
echo "--- Vanguard Post-Task ---"
echo "Consider saving learnings:"
echo "  vanguard memory add    — Store a pattern, decision, or solution"
echo "  vanguard task done     — Mark current task as complete"
echo "--- End ---"
`

		// Session start hook: shows project status
		const sessionHook = `#!/bin/bash
# Vanguard Session Hook
# Runs when Claude Code session starts

VANGUARD_DIR=".vanguard"

if [ ! -d "$VANGUARD_DIR" ]; then
  exit 0
fi

# Quick status
TASK_COUNT=$(find "$VANGUARD_DIR/tasks" -name "*.md" 2>/dev/null | wc -l)
IN_PROGRESS=$(grep -rl "status: in-progress" "$VANGUARD_DIR/tasks/" 2>/dev/null | wc -l)
MEMORY_COUNT=$(find "$VANGUARD_DIR/memory/items" -name "*.md" 2>/dev/null | wc -l)

echo "Vanguard: $TASK_COUNT tasks ($IN_PROGRESS active), $MEMORY_COUNT memory items"
`

		// Write hook files
		const hookFiles = [
			{ name: 'pre-task.sh', content: preTaskHook },
			{ name: 'post-task.sh', content: postTaskHook },
			{ name: 'session-start.sh', content: sessionHook },
		]

		for (const hook of hookFiles) {
			const hookPath = path.join(hooksDir, hook.name)
			if (!options.force && fs.existsSync(hookPath)) continue
			fs.writeFileSync(hookPath, hook.content, 'utf-8')
			// Make executable on Unix
			try { fs.chmodSync(hookPath, 0o755) } catch { /* Windows */ }
		}

		// Update .claude/settings.json with hook config
		const settingsPath = path.join(claudeDir, 'settings.json')
		let settings: Record<string, unknown> = {}
		if (fs.existsSync(settingsPath)) {
			try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) } catch { /* corrupted */ }
		}

		settings['hooks'] = {
			PreToolUse: [
				{
					matcher: '*',
					hooks: [
						{
							type: 'command',
							command: 'bash .claude/hooks/pre-task.sh',
						},
					],
				},
			],
			PostToolUse: [
				{
					matcher: '*',
					hooks: [
						{
							type: 'command',
							command: 'bash .claude/hooks/post-task.sh',
						},
					],
				},
			],
			SessionStart: [
				{
					hooks: [
						{
							type: 'command',
							command: 'bash .claude/hooks/session-start.sh',
						},
					],
				},
			],
		}

		fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')

		s.stop('Hooks installed!')

		console.log('')
		console.log(pc.bold('  Installed:'))
		console.log(`  ${pc.cyan('.claude/hooks/pre-task.sh')}      — Inject context before work`)
		console.log(`  ${pc.cyan('.claude/hooks/post-task.sh')}     — Prompt for learnings after work`)
		console.log(`  ${pc.cyan('.claude/hooks/session-start.sh')} — Show status on session start`)
		console.log(`  ${pc.cyan('.claude/settings.json')}          — Hook configuration`)
		console.log('')
		console.log(pc.dim('  Hooks run automatically in Claude Code sessions.'))
		console.log('')
	})

// vanguard hooks list
hooksCommand
	.command('list')
	.description('List installed hooks')
	.action(() => {
		const hooksDir = path.join(getProjectRoot(), '.claude', 'hooks')
		if (!fs.existsSync(hooksDir)) {
			console.log(pc.dim('\n  No hooks installed. Run `vanguard hooks install`.\n'))
			return
		}

		const files = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.sh'))
		console.log('')
		console.log(pc.bold(`  Hooks (${files.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))
		for (const file of files) {
			const name = file.replace('.sh', '')
			const icon = name === 'pre-task' ? pc.cyan('→') :
				name === 'post-task' ? pc.green('←') : pc.yellow('●')
			console.log(`  ${icon} ${name}`)
		}
		console.log('')
	})

// vanguard hooks remove
hooksCommand
	.command('remove')
	.description('Remove all hooks')
	.action(() => {
		const hooksDir = path.join(getProjectRoot(), '.claude', 'hooks')
		if (fs.existsSync(hooksDir)) {
			fs.rmSync(hooksDir, { recursive: true, force: true })
		}

		// Remove hooks from settings.json
		const settingsPath = path.join(getProjectRoot(), '.claude', 'settings.json')
		if (fs.existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
				delete settings['hooks']
				fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
			} catch { /* skip */ }
		}

		console.log(pc.green('\n  Hooks removed.\n'))
	})

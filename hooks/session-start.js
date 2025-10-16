#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSkillsRoot, getPluginRoot } from '../lib/paths.js';

// Get the directory where this script lives
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Escape string for JSON
 */
function escapeForJson(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Run a command and capture output
 */
function runCommand(command, args = [], cwd = undefined) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  // Set SUPERPOWERS_SKILLS_ROOT environment variable
  const skillsRoot = getSkillsRoot();
  process.env.SUPERPOWERS_SKILLS_ROOT = skillsRoot;

  // Run skills initialization script (handles clone/fetch/auto-update)
  const pluginRoot = getPluginRoot();
  const initScript = path.join(pluginRoot, 'lib', 'initialize-skills.js');

  let initOutput = '';
  try {
    const result = await runCommand('node', [initScript]);
    initOutput = result.stdout + result.stderr;
  } catch (err) {
    initOutput = err.message || '';
  }

  // Extract status flags
  const skillsUpdated = initOutput.includes('SKILLS_UPDATED=true');
  const skillsBehind = initOutput.includes('SKILLS_BEHIND=true');

  // Remove status flags from display output
  initOutput = initOutput
    .replace(/SKILLS_UPDATED=true\n?/g, '')
    .replace(/SKILLS_BEHIND=true\n?/g, '')
    .trim();

  // Run find-skills to show all available skills
  const findSkillsScript = path.join(skillsRoot, 'skills', 'using-skills', 'find-skills.js');
  let findSkillsOutput = '';

  if (fs.existsSync(findSkillsScript)) {
    try {
      const result = await runCommand('node', [findSkillsScript]);
      findSkillsOutput = result.stdout || 'Error running find-skills';
    } catch (err) {
      findSkillsOutput = 'Error running find-skills';
    }
  } else {
    // Fallback to bash version if JS doesn't exist yet
    const findSkillsBash = path.join(skillsRoot, 'skills', 'using-skills', 'find-skills');
    if (fs.existsSync(findSkillsBash)) {
      try {
        const result = await runCommand(findSkillsBash, []);
        findSkillsOutput = result.stdout || 'Error running find-skills';
      } catch (err) {
        findSkillsOutput = 'Error running find-skills';
      }
    } else {
      findSkillsOutput = 'find-skills not found';
    }
  }

  // Read using-skills content
  const usingSkillsPath = path.join(skillsRoot, 'skills', 'using-skills', 'SKILL.md');
  let usingSkillsContent = '';

  if (fs.existsSync(usingSkillsPath)) {
    try {
      usingSkillsContent = fs.readFileSync(usingSkillsPath, 'utf8');
    } catch (err) {
      usingSkillsContent = 'Error reading using-skills';
    }
  } else {
    usingSkillsContent = 'using-skills SKILL.md not found';
  }

  // Escape outputs for JSON
  const initEscaped = escapeForJson(initOutput);
  const findSkillsEscaped = escapeForJson(findSkillsOutput);
  const usingSkillsEscaped = escapeForJson(usingSkillsContent);

  // Build initialization output message if present
  let initMessage = '';
  if (initOutput) {
    initMessage = `${initEscaped}\\n\\n`;
  }

  // Build status messages that go at the end
  let statusMessage = '';
  if (skillsBehind) {
    statusMessage = '\\n\\n⚠️ New skills available from upstream. Ask me to use the pulling-updates-from-skills-repository skill.';
  }

  // Output context injection as JSON
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n${initMessage}**The content below is from skills/using-skills/SKILL.md - your introduction to using skills:**\n\n${usingSkillsEscaped}\n\n**Tool paths (use these when you need to search for or run skills):**\n- find-skills: ${skillsRoot}/skills/using-skills/find-skills\n- skill-run: ${skillsRoot}/skills/using-skills/skill-run\n\n**Skills live in:** ${skillsRoot}/skills/ (you work on your own branch and can edit any skill)\n\n**Available skills (output of find-skills):**\n\n${findSkillsEscaped}${statusMessage}\n</EXTREMELY_IMPORTANT>`
    }
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Error in session-start:', err);
  process.exit(1);
});

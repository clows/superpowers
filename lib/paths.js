#!/usr/bin/env node

import os from 'os';
import path from 'path';

/**
 * Get the superpowers skills root directory
 *
 * Precedence:
 * 1. SUPERPOWERS_SKILLS_ROOT env var (if set)
 * 2. Platform-specific defaults:
 *    - Windows: %LOCALAPPDATA%\superpowers\skills
 *    - Mac/Linux: ~/.config/superpowers/skills
 */
export function getSkillsRoot() {
  if (process.env.SUPERPOWERS_SKILLS_ROOT) {
    return process.env.SUPERPOWERS_SKILLS_ROOT;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'superpowers', 'skills');
  }

  return path.join(os.homedir(), '.config', 'superpowers', 'skills');
}

/**
 * Get the superpowers base directory
 */
export function getSuperpowersDir() {
  const skillsRoot = getSkillsRoot();
  return path.dirname(skillsRoot);
}

/**
 * Get the plugin root directory (where this script lives)
 */
export function getPluginRoot() {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  // On Windows, remove leading slash from file:// URLs
  const normalizedScriptDir = process.platform === 'win32' && scriptDir.startsWith('/')
    ? scriptDir.substring(1)
    : scriptDir;
  return path.resolve(normalizedScriptDir, '..');
}

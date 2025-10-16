#!/usr/bin/env node

import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { getSkillsRoot } from './paths.js';
import { spawn } from 'child_process';

const SKILLS_REPO = 'https://github.com/obra/superpowers-skills.git';

async function main() {
  const skillsDir = getSkillsRoot();
  const gitDir = path.join(skillsDir, '.git');

  // Check if skills directory exists and is a valid git repo
  if (fs.existsSync(gitDir)) {
    const git = simpleGit(skillsDir);

    try {
      // Get the remote name for the current tracking branch
      let trackingRemote = '';
      try {
        const branch = await git.revparse(['--abbrev-ref', '--symbolic-full-name', '@{u}']);
        trackingRemote = branch.trim().split('/')[0];
      } catch (err) {
        // No tracking branch set
      }

      // Fetch from tracking remote if set, otherwise try upstream then origin
      if (trackingRemote) {
        try {
          await git.fetch(trackingRemote);
        } catch (err) {
          // Fetch failed, continue
        }
      } else {
        try {
          await git.fetch('upstream');
        } catch (err) {
          try {
            await git.fetch('origin');
          } catch (err2) {
            // Both failed, continue
          }
        }
      }

      // Check if we can fast-forward
      let local, remote, base;
      try {
        local = (await git.revparse(['@'])).trim();
        remote = (await git.revparse(['@{u}'])).trim();
        base = (await git.raw(['merge-base', '@', '@{u}'])).trim();
      } catch (err) {
        // Can't determine merge base, exit
        process.exit(0);
      }

      // Try to fast-forward merge first
      if (local && remote && local !== remote) {
        // Check if we can fast-forward (local is ancestor of remote)
        if (local === base) {
          // Fast-forward merge is possible - local is behind
          console.log('Updating skills to latest version...');
          try {
            await git.merge(['--ff-only', '@{u}']);
            console.log('✓ Skills updated successfully');
            console.log('SKILLS_UPDATED=true');
          } catch (err) {
            console.log('Failed to update skills');
          }
        } else if (remote !== base) {
          // Remote has changes (local is behind or diverged)
          console.log('SKILLS_BEHIND=true');
        }
        // If REMOTE = BASE, local is ahead - no action needed
      }

      process.exit(0);
    } catch (err) {
      console.error('Error updating skills:', err.message);
      process.exit(1);
    }
  }

  // Skills directory doesn't exist or isn't a git repo - initialize it
  console.log('Initializing skills repository...');

  // Handle migration from old installation
  const oldGitDir = path.join(path.dirname(skillsDir), '.git');
  if (fs.existsSync(oldGitDir)) {
    console.log('Found existing installation. Backing up...');
    fs.renameSync(oldGitDir, path.join(path.dirname(skillsDir), '.git.bak'));

    const oldSkillsDir = path.join(path.dirname(skillsDir), 'skills');
    if (fs.existsSync(oldSkillsDir)) {
      fs.renameSync(oldSkillsDir, path.join(path.dirname(skillsDir), 'skills.bak'));
      console.log('Your old skills are in ~/.config/superpowers/skills.bak');
    }
  }

  // Create parent directory if needed
  const parentDir = path.dirname(skillsDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Clone the skills repository
  try {
    const git = simpleGit();
    await git.clone(SKILLS_REPO, skillsDir);
  } catch (err) {
    console.error('Failed to clone skills repository:', err.message);
    process.exit(1);
  }

  // Check if gh is installed
  const ghAvailable = await new Promise((resolve) => {
    const proc = spawn(process.platform === 'win32' ? 'where' : 'which', ['gh'], {
      stdio: 'ignore'
    });
    proc.on('close', (code) => resolve(code === 0));
  });

  if (ghAvailable) {
    console.log('');
    console.log('GitHub CLI detected. Would you like to fork superpowers-skills?');
    console.log('Forking allows you to share skill improvements with the community.');
    console.log('');

    // For now, skip interactive prompt in automated contexts
    // TODO: Add prompts package support for interactive mode
    const git = simpleGit(skillsDir);
    await git.addRemote('upstream', SKILLS_REPO);
  } else {
    // No gh, just set up upstream remote
    const git = simpleGit(skillsDir);
    await git.addRemote('upstream', SKILLS_REPO);
  }

  console.log(`Skills repository initialized at ${skillsDir}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

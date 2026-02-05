#!/usr/bin/env node
/**
 * Fleet Deck Status Hook for fleet-dev plugin (v3 - NO STDIN)
 * Updates .fleet-deck-status.json in the project directory
 *
 * Usage: node fleet-deck-status.js [EventName]
 * Events: SessionStart, PostToolUse, Stop, Notification, SessionEnd
 *
 * Uses ONLY environment variables and argv - NO STDIN AT ALL
 */

const fs = require('fs');
const path = require('path');

// Get event from command line arg
const event = process.argv[2] || 'unknown';

// Get project directory from env (Claude Code sets this)
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const statusFile = path.join(projectDir, '.fleet-deck-status.json');

// Determine instance name
const instanceName = getInstanceName(projectDir);

// Read existing status or create new
let status = readExistingStatus(statusFile);

// Update based on event
switch (event) {
  case 'SessionStart':
    status = {
      instance: instanceName,
      project: projectDir,
      status: 'running',
      context_percent: 0,
      needs_attention: false,
      attention_reason: null,
      last_activity: new Date().toISOString(),
      last_tool: null,
      error: null
    };
    break;

  case 'SessionEnd':
    status.status = 'stopped';
    status.last_activity = new Date().toISOString();
    status.needs_attention = false;
    break;

  case 'PostToolUse':
    status.status = 'running';
    status.last_activity = new Date().toISOString();
    // Can't get tool_name without stdin, but that's OK
    status.needs_attention = false;
    status.error = null;
    break;

  case 'Notification':
    status.needs_attention = true;
    status.attention_reason = 'Notification pending';
    status.last_activity = new Date().toISOString();
    break;

  case 'Stop':
    status.status = 'waiting';
    status.needs_attention = true;
    status.attention_reason = 'Task completed or waiting';
    status.last_activity = new Date().toISOString();
    break;

  default:
    status.last_activity = new Date().toISOString();
}

// Ensure instance name is set
status.instance = status.instance || instanceName;
status.project = status.project || projectDir;

// Write status file
try {
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
} catch (err) {
  // Silent fail
}

// Output empty JSON (hook success) and exit immediately
console.log('{}');

// === Helper Functions ===

function getInstanceName(projectDir) {
  const configFile = path.join(projectDir, '.fleet-deck.json');
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (config.instance) return config.instance;
    } catch (e) {
      // Fall through
    }
  }
  return path.basename(projectDir);
}

function readExistingStatus(statusFile) {
  if (fs.existsSync(statusFile)) {
    try {
      return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    } catch (e) {
      // Corrupt file
    }
  }
  return {};
}

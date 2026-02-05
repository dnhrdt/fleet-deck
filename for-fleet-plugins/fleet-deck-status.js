#!/usr/bin/env node
/**
 * Fleet Deck Status Hook (v5 - WITH LOGGING)
 * Updates .fleet-deck-status.json in the project directory
 * Writes event log to .fleet-deck-events.log for debugging
 *
 * Usage: node fleet-deck-status.js [EventName]
 * Events: SessionStart, PostToolUse, Stop, Notification, SessionEnd, UserPromptSubmit, PermissionRequest
 *
 * CHANGELOG:
 * v6 (2026-02-05): PostToolUse only changes status if blocked → running (permission granted)
 * v5 (2026-02-05): Added logging to .fleet-deck-events.log
 * v4 (2026-02-05): DESTROY STDIN immediately to fix Windows blocking
 * v3 (2026-02-05): No stdin at all - still blocked (Windows bug)
 * v2 (2026-02-05): Sync stdin read - still blocked
 * v1 (2026-02-04): Async stdin listeners - blocked Claude input
 *
 * INSTALLATION:
 * Copy to: ~/.claude/scripts/fleet-deck-status.js
 * Then add hooks to ~/.claude/settings.json (see hooks-reference.json)
 */

// IMMEDIATELY destroy stdin to release the handle - BEFORE anything else
process.stdin.destroy();

const fs = require('fs');
const path = require('path');

// Get event from command line arg
const event = process.argv[2] || 'unknown';

// Get project directory from env (Claude Code sets this)
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const statusFile = path.join(projectDir, '.fleet-deck-status.json');
const logFile = path.join(projectDir, '.fleet-deck-events.log');

// Determine instance name
const instanceName = getInstanceName(projectDir);

// Read existing status or create new
let status = readExistingStatus(statusFile);
const previousStatus = status.status || 'none';

// Update based on event
switch (event) {
  case 'SessionStart':
  case 'UserPromptSubmit':
    // UserPromptSubmit: User sent a prompt → session is active
    // NOTE: SessionStart is BROKEN on Windows (Issue #9542) - use UserPromptSubmit instead
    status.status = 'running';
    status.needs_attention = false;
    status.attention_reason = null;
    status.last_activity = new Date().toISOString();
    // Initialize if new session
    if (!status.instance) status.instance = instanceName;
    if (!status.project) status.project = projectDir;
    if (status.context_percent === undefined) status.context_percent = 0;
    break;

  case 'SessionEnd':
    status.status = 'stopped';
    status.last_activity = new Date().toISOString();
    status.needs_attention = false;
    break;

  case 'PostToolUse':
    // Only change status if currently blocked (= permission was just granted)
    // This avoids 7500+ unnecessary status changes per session
    if (previousStatus === 'blocked') {
      status.status = 'running';
      status.needs_attention = false;
      status.error = null;
    }
    // Always update activity timestamp
    status.last_activity = new Date().toISOString();
    break;

  case 'Notification':
  case 'PermissionRequest':
    // URGENT: Claude is blocked, needs permission/input to continue
    // NOTE: These events are BROKEN in VSCode Extension (Issues #13203, #16114)
    status.status = 'blocked';
    status.needs_attention = true;
    status.attention_reason = 'Permission or input required';
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

// Write to log file for debugging
logEvent(event, previousStatus, status.status);

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

function logEvent(event, previousStatus, newStatus) {
  try {
    const now = new Date();
    const timestamp = now.toISOString();
    const ms = now.getTime();

    // Format: [timestamp] [ms_since_epoch] EVENT: prev_status → new_status
    const logLine = `[${timestamp}] [${ms}] ${event}: ${previousStatus} → ${newStatus}\n`;

    fs.appendFileSync(logFile, logLine);
  } catch (err) {
    // Silent fail - logging should never break the hook
  }
}

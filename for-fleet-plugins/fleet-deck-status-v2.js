#!/usr/bin/env node
/**
 * Fleet Deck Status Hook for fleet-dev plugin (v2 - non-blocking)
 * Updates .fleet-deck-status.json in the project directory
 *
 * Usage: node fleet-deck-status.js [EventName]
 * Events: SessionStart, PostToolUse, Stop, Notification, SessionEnd
 *
 * Reads stdin synchronously to avoid blocking Claude Code's input
 */

const fs = require('fs');
const path = require('path');

// Get event from command line arg
const eventArg = process.argv[2];

// Quick synchronous stdin read with immediate timeout
let hookData = {};
try {
  // Only try to read stdin if there's data available (non-blocking check)
  if (process.stdin.isTTY === false) {
    const chunks = [];
    const BUFSIZE = 256;
    let buf = Buffer.alloc(BUFSIZE);
    let bytesRead;

    // Set stdin to non-blocking
    try {
      fs.readSync(0, buf, 0, BUFSIZE, null);
      // If we got here, there's data
      const input = buf.toString('utf8').trim();
      if (input) {
        hookData = JSON.parse(input);
      }
    } catch (e) {
      // No data available or read error - that's fine
    }
  }
} catch (e) {
  // stdin not available - that's fine
}

// Run immediately
updateStatus(hookData, eventArg);

function updateStatus(hookData, event) {
  const projectDir = hookData.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const statusFile = path.join(projectDir, '.fleet-deck-status.json');

  // Determine instance name
  const instanceName = getInstanceName(projectDir);

  // Read existing status or create new
  let status = readExistingStatus(statusFile);

  // Use event from arg or hookData
  const hookEvent = event || hookData.hook_event_name || 'unknown';

  switch (hookEvent) {
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
      status.last_tool = hookData.tool_name || null;
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
      status.attention_reason = hookData.stop_hook_reason || 'Task completed or waiting';
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

  // Output empty JSON (hook success)
  console.log('{}');
}

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

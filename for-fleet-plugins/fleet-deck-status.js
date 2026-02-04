#!/usr/bin/env node
/**
 * Fleet Deck Status Hook for fleet-dev plugin
 * Updates .fleet-deck-status.json in the project directory
 *
 * Usage: node fleet-deck-status.js [EventName]
 * Events: SessionStart, PostToolUse, Stop, Notification, SessionEnd
 */

const fs = require('fs');
const path = require('path');

// Get event from command line arg (fallback to stdin parsing)
const eventArg = process.argv[2];

// Read hook input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const hookData = input ? JSON.parse(input) : {};
    updateStatus(hookData, eventArg);
  } catch (err) {
    // Silent fail - don't break Claude's workflow
    process.exit(0);
  }
});

// Timeout fallback if no stdin (some events might not provide input)
setTimeout(() => {
  updateStatus({}, eventArg);
}, 100);

let hasRun = false;

function updateStatus(hookData, event) {
  if (hasRun) return;
  hasRun = true;

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
  process.exit(0);
}

function getInstanceName(projectDir) {
  // Check for .fleet-deck.json config
  const configFile = path.join(projectDir, '.fleet-deck.json');
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (config.instance) return config.instance;
    } catch (e) {
      // Fall through to default
    }
  }

  // Default: use folder name
  return path.basename(projectDir);
}

function readExistingStatus(statusFile) {
  if (fs.existsSync(statusFile)) {
    try {
      return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    } catch (e) {
      // Return empty object if file is corrupt
    }
  }
  return {};
}

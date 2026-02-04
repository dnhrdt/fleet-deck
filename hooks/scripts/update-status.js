#!/usr/bin/env node
/**
 * Fleet Deck Status Hook
 * Updates .fleet-deck-status.json in the project directory
 *
 * Used by: PostToolUse, SessionStart, SessionEnd, Notification hooks
 */

const fs = require('fs');
const path = require('path');

// Read hook input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);
    updateStatus(hookData);
  } catch (err) {
    // Silent fail - don't break Claude's workflow
    process.exit(0);
  }
});

function updateStatus(hookData) {
  const projectDir = hookData.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const statusFile = path.join(projectDir, '.fleet-deck-status.json');

  // Determine instance name
  const instanceName = getInstanceName(projectDir);

  // Read existing status or create new
  let status = readExistingStatus(statusFile);

  // Update based on hook event
  const event = hookData.hook_event_name || process.env.HOOK_EVENT || 'unknown';

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
      status.last_tool = hookData.tool_name || null;
      status.needs_attention = false;
      status.error = null;
      break;

    case 'Notification':
      // Claude is waiting for user input
      status.needs_attention = true;
      status.attention_reason = 'Notification pending';
      status.last_activity = new Date().toISOString();
      break;

    case 'Stop':
      // Agent is about to stop - might be waiting or done
      status.status = 'waiting';
      status.needs_attention = true;
      status.attention_reason = hookData.stop_hook_reason || 'Task completed or waiting';
      status.last_activity = new Date().toISOString();
      break;

    default:
      // Generic update
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

  // Output empty JSON (hook success, no message needed)
  console.log('{}');
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

// Stream Deck Property Inspector Communication
let websocket = null;
let uuid = null;
let actionInfo = null;

// Connect to Stream Deck
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  actionInfo = JSON.parse(inActionInfo);

  websocket = new WebSocket('ws://127.0.0.1:' + inPort);

  websocket.onopen = function() {
    // Register the Property Inspector
    const json = {
      event: inRegisterEvent,
      uuid: inUUID
    };
    websocket.send(JSON.stringify(json));

    // Load current settings
    loadSettings(actionInfo.payload.settings);
  };

  websocket.onmessage = function(evt) {
    const jsonObj = JSON.parse(evt.data);
    if (jsonObj.event === 'didReceiveSettings') {
      loadSettings(jsonObj.payload.settings);
    }
  };
}

// Load settings into form fields
function loadSettings(settings) {
  if (!settings) return;

  const projectPath = document.getElementById('project_path');
  const instanceName = document.getElementById('instance_name');
  const autoStart = document.getElementById('auto_start');

  if (projectPath && settings.project_path !== undefined) {
    projectPath.value = settings.project_path;
  }
  if (instanceName && settings.instance_name !== undefined) {
    instanceName.value = settings.instance_name;
  }
  if (autoStart && settings.auto_start !== undefined) {
    autoStart.checked = settings.auto_start;
  }
}

// Save settings when changed
function saveSettings() {
  const projectPath = document.getElementById('project_path');
  const instanceName = document.getElementById('instance_name');
  const autoStart = document.getElementById('auto_start');

  const settings = {
    project_path: projectPath ? projectPath.value : '',
    instance_name: instanceName ? instanceName.value : '',
    auto_start: autoStart ? autoStart.checked : false
  };

  if (websocket && websocket.readyState === WebSocket.OPEN) {
    const json = {
      event: 'setSettings',
      context: uuid,
      payload: settings
    };
    websocket.send(JSON.stringify(json));
  }
}

// Attach event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Save on input change
  document.querySelectorAll('.sdpi-item-value').forEach(function(el) {
    el.addEventListener('change', saveSettings);
    el.addEventListener('input', saveSettings);
  });
});

import {
  action,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type KeyDownEvent,
  type DidReceiveSettingsEvent,
  type JsonObject
} from '@elgato/streamdeck';
import { StatusWatcher, type FleetDeckStatus } from '../utils/status-watcher.js';
import { launchTerminal } from '../utils/terminal.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SessionSettings extends JsonObject {
  project_path?: string;
  instance_name?: string;
  auto_start?: boolean;
  [key: string]: unknown;
}

// Get the directory where the plugin is located
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');

// Pre-load SVG icons as base64 data URIs
function loadIcon(name: string): string {
  try {
    const svgPath = join(PLUGIN_ROOT, 'imgs', 'actions', 'session', `${name}.svg`);
    const svgContent = readFileSync(svgPath, 'utf-8');
    const base64 = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    return '';
  }
}

const ICONS = {
  running: loadIcon('running'),
  waiting: loadIcon('waiting'),
  error: loadIcon('error'),
  idle: loadIcon('idle')
};

@action({ UUID: 'com.fleet.deck.session' })
export class SessionAction extends SingletonAction<SessionSettings> {
  private watchers: Map<string, StatusWatcher> = new Map();

  override async onWillAppear(ev: WillAppearEvent<SessionSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const projectPath = settings.project_path;

    if (!projectPath) {
      await ev.action.setTitle('Config\nneeded');
      await ev.action.setImage(ICONS.idle);
      return;
    }

    // Start watching this project
    this.startWatching(ev.action.id, projectPath, async (status) => {
      await this.updateButton(ev, status, settings.instance_name);
    });

    // Set initial state
    await ev.action.setImage(ICONS.idle);
    await ev.action.setTitle(settings.instance_name || 'IDLE');
  }

  override async onWillDisappear(ev: WillDisappearEvent<SessionSettings>): Promise<void> {
    this.stopWatching(ev.action.id);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SessionSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const projectPath = settings.project_path;

    // Stop existing watcher
    this.stopWatching(ev.action.id);

    if (!projectPath) {
      await ev.action.setTitle('Config\nneeded');
      await ev.action.setImage(ICONS.idle);
      return;
    }

    // Start new watcher with updated path
    this.startWatching(ev.action.id, projectPath, async (status) => {
      await this.updateButton(ev, status, settings.instance_name);
    });
  }

  override async onKeyDown(ev: KeyDownEvent<SessionSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const projectPath = settings.project_path;

    if (!projectPath) {
      return;
    }

    launchTerminal(projectPath, settings.auto_start ?? false);
  }

  private startWatching(
    actionId: string,
    projectPath: string,
    callback: (status: FleetDeckStatus | null) => void
  ): void {
    const watcher = new StatusWatcher(projectPath, callback);
    watcher.start();
    this.watchers.set(actionId, watcher);
  }

  private stopWatching(actionId: string): void {
    const watcher = this.watchers.get(actionId);
    if (watcher) {
      watcher.stop();
      this.watchers.delete(actionId);
    }
  }

  private async updateButton(
    ev: WillAppearEvent<SessionSettings> | DidReceiveSettingsEvent<SessionSettings>,
    status: FleetDeckStatus | null,
    instanceName?: string
  ): Promise<void> {
    // Determine icon based on status
    let icon: string;
    let title: string;

    if (status === null) {
      icon = ICONS.idle;
      title = instanceName || 'IDLE';
    } else if (status.status === 'error') {
      icon = ICONS.error;
      title = instanceName ? `${instanceName}\nERROR` : 'ERROR';
    } else if (status.status === 'blocked') {
      // Permission request - needs immediate attention (RED)
      icon = ICONS.error;
      title = instanceName ? `${instanceName}\nBLOCKED` : 'BLOCKED';
    } else if (status.needs_attention || status.status === 'waiting') {
      icon = ICONS.waiting;
      title = instanceName ? `${instanceName}\nINPUT` : 'INPUT';
    } else if (status.status === 'running') {
      icon = ICONS.running;
      title = instanceName || 'RUNNING';
    } else {
      icon = ICONS.idle;
      title = instanceName || status.status.toUpperCase();
    }

    await ev.action.setImage(icon);
    await ev.action.setTitle(title);
  }
}

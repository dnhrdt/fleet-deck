import { watch, readFileSync, existsSync, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

export interface FleetDeckStatus {
  instance: string;
  project: string;
  status: 'running' | 'waiting' | 'idle' | 'error' | 'stopped' | 'blocked';
  context_percent: number;
  needs_attention: boolean;
  attention_reason: string | null;
  last_activity: string;
  last_tool: string | null;
  error: string | null;
}

export type StatusCallback = (status: FleetDeckStatus | null) => void;

export class StatusWatcher {
  private projectPath: string;
  private statusFilePath: string;
  private onUpdate: StatusCallback;
  private watcher: FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private lastContent: string = '';

  constructor(projectPath: string, onUpdate: StatusCallback) {
    this.projectPath = projectPath;
    this.statusFilePath = join(projectPath, '.fleet-deck-status.json');
    this.onUpdate = onUpdate;
  }

  start(): void {
    // Initial read
    this.readAndNotify();

    // Try to use fs.watch
    try {
      this.watcher = watch(this.projectPath, (eventType, filename) => {
        if (filename === '.fleet-deck-status.json') {
          this.debouncedRead();
        }
      });

      this.watcher.on('error', () => {
        // Fall back to polling if watch fails
        this.startPolling();
      });
    } catch {
      // Fall back to polling
      this.startPolling();
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  }

  private startPolling(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    // Poll every 2 seconds
    this.pollInterval = setInterval(() => this.readAndNotify(), 2000);
  }

  private debouncedRead(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => this.readAndNotify(), 100);
  }

  private readAndNotify(): void {
    const status = this.readStatusFile();

    // Only notify if content actually changed
    const content = JSON.stringify(status);
    if (content !== this.lastContent) {
      this.lastContent = content;
      this.onUpdate(status);
    }
  }

  private readStatusFile(): FleetDeckStatus | null {
    try {
      if (!existsSync(this.statusFilePath)) {
        return null;
      }
      const content = readFileSync(this.statusFilePath, 'utf-8');
      return JSON.parse(content) as FleetDeckStatus;
    } catch {
      return null;
    }
  }
}

import { spawn } from 'node:child_process';

/**
 * Launch Windows Terminal in the specified directory
 */
export function launchTerminal(projectPath: string, autoStartClaude: boolean = false): void {
  const args: string[] = ['-d', projectPath];

  if (autoStartClaude) {
    // Open terminal and run claude command
    args.push('--', 'bash', '-c', 'claude');
  }

  spawn('wt.exe', args, {
    detached: true,
    stdio: 'ignore',
    shell: true
  }).unref();
}

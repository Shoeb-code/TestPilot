import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private static instance: Logger;
  private channel: vscode.OutputChannel;
  private minLevel: LogLevel = 'INFO';

  private constructor() {
    this.channel = vscode.window.createOutputChannel('TestPilot');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public getChannel(): vscode.OutputChannel {
    return this.channel;
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  public log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const line = `[${timestamp}] [${level}] ${message}`;
    this.channel.appendLine(line);
    if (data !== undefined) {
      if (typeof data === 'string') {
        this.channel.appendLine(`  ${data}`);
      } else {
        try {
          this.channel.appendLine(`  ${JSON.stringify(data, null, 2)}`);
        } catch {
          this.channel.appendLine(`  [Unserializable Data]`);
        }
      }
    }
  }

  public debug(message: string, data?: unknown): void {
    this.log('DEBUG', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.log('INFO', message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.log('WARN', message, data);
  }

  public error(message: string, data?: unknown): void {
    this.log('ERROR', message, data);
  }

  public show(): void {
    this.channel.show(true);
  }
}

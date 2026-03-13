import * as vscode from "vscode";

export type LogLevel = "debug" | "warning" | "error";

export class OutputLogger {
  private readonly channel: vscode.OutputChannel;

  public constructor(channelName = "Codex Onboarding") {
    this.channel = vscode.window.createOutputChannel(channelName);
  }

  public dispose(): void {
    this.channel.dispose();
  }

  public log(level: LogLevel, message: string, fields: Record<string, string> = {}): void {
    const ts = new Date().toISOString();
    const payload = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

    this.channel.appendLine(`[${ts}] [${level}] ${message}${payload ? ` ${payload}` : ""}`);
  }

  public show(): void {
    this.channel.show(true);
  }
}

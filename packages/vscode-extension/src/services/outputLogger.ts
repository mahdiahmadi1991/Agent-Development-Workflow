import * as vscode from "vscode";

export type LogLevel = "debug" | "warning" | "error";
export type LogValue = string | number | boolean | null | undefined;

export class OutputLogger {
  private readonly channel: vscode.OutputChannel;

  public constructor(channelName = "Codex Onboarding") {
    this.channel = vscode.window.createOutputChannel(channelName);
  }

  public dispose(): void {
    this.channel.dispose();
  }

  public log(level: LogLevel, message: string, fields: Record<string, LogValue> = {}): void {
    const ts = new Date().toISOString();
    const payload = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");

    this.channel.appendLine(`[${ts}] [${level}] ${message}${payload ? ` ${payload}` : ""}`);
  }

  public show(): void {
    // Keep Output visible for live tracing without stealing keyboard focus from active prompts.
    this.channel.show(true);
  }
}

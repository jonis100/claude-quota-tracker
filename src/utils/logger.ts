import * as vscode from "vscode";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private output_channel: vscode.OutputChannel | null = null;
  private log_level: LogLevel = LogLevel.DEBUG;
  private prefix = "[ClaudeQuota]";

  init(context?: vscode.ExtensionContext) {
    if (!this.output_channel) {
      this.output_channel = vscode.window.createOutputChannel(
        "Claude Quota Tracker",
      );
      if (context) {
        context.subscriptions.push(this.output_channel);
      }
    }
  }

  set_level(level: LogLevel) {
    this.log_level = level;
  }

  show() {
    this.output_channel?.show();
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    ...args: any[]
  ) {
    if (level < this.log_level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const level_str = LogLevel[level].padEnd(5);
    const formatted = `${timestamp} ${level_str} ${this.prefix}[${category}] ${message}`;

    const console_method =
      level === LogLevel.ERROR
        ? console.error
        : level === LogLevel.WARN
          ? console.warn
          : console.log;
    if (args.length > 0) {
      console_method(formatted, ...args);
    } else {
      console_method(formatted);
    }

    if (this.output_channel) {
      if (args.length > 0) {
        const args_str = args
          .map((arg) => {
            if (typeof arg === "object") {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(" ");
        this.output_channel.appendLine(`${formatted} ${args_str}`);
      } else {
        this.output_channel.appendLine(formatted);
      }
    }
  }

  debug(category: string, message: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, category, message, ...args);
  }

  info(category: string, message: string, ...args: any[]) {
    this.log(LogLevel.INFO, category, message, ...args);
  }

  warn(category: string, message: string, ...args: any[]) {
    this.log(LogLevel.WARN, category, message, ...args);
  }

  error(category: string, message: string, ...args: any[]) {
    this.log(LogLevel.ERROR, category, message, ...args);
  }

  section(category: string, title: string) {
    const divider = "=".repeat(60);
    this.debug(category, divider);
    this.debug(category, title);
    this.debug(category, divider);
  }

  time_start(label: string): () => void {
    const start = Date.now();
    this.debug("PERF", `Timer started: ${label}`);
    return () => {
      const elapsed = Date.now() - start;
      this.debug("PERF", `Timer ended: ${label} (${elapsed}ms)`);
    };
  }
}

export const logger = new Logger();

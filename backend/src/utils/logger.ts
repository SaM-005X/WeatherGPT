/**
 * CloudWatch Structured JSON Logger
 *
 * Formats all application logs as structured JSON objects for ingestion by Amazon CloudWatch.
 * Enables fast querying via CloudWatch Insights (e.g. filter by level, requestId, or duration).
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private service: string;
  private requestId?: string;

  constructor(service = 'weather-gpt-api', requestId?: string) {
    this.service = service;
    this.requestId = requestId;
  }

  public setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>, err?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      requestId: this.requestId,
      context,
    };

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else if (err) {
      entry.error = {
        name: 'UnknownError',
        message: String(err),
      };
    }

    const output = JSON.stringify(entry);
    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.emit('INFO', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.emit('WARN', message, context);
  }

  public error(message: string, err?: unknown, context?: Record<string, unknown>): void {
    this.emit('ERROR', message, context, err);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      this.emit('DEBUG', message, context);
    }
  }
}

export const defaultLogger = new Logger();

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { env } from '../config/env';
import type { ResilienceError } from '../core/types';

interface HttpGetJsonOptions {
  baseURL?: string;
  url: string;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface HttpClient {
  getJson<T>(options: HttpGetJsonOptions): Promise<T>;
}

class AxiosHttpClient implements HttpClient {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: env.resilience.requestTimeoutMs,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'exchange-poller/1.0',
      },
      transitional: {
        clarifyTimeoutError: true,
      },
    });
  }

  async getJson<T>(options: HttpGetJsonOptions): Promise<T> {
    const timeoutMs = options.timeoutMs ?? env.resilience.requestTimeoutMs;
    const controller = new AbortController();

    const signal = options.signal
      ? this.anySignal([options.signal, controller.signal])
      : controller.signal;

    const timeout = setTimeout(() => {
      controller.abort(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const response = await this.client.get<T, AxiosResponse<T>>(
        options.url,
        this.buildRequestConfig(options, signal, timeoutMs),
      );

      return response.data;
    } catch (error) {
      throw this.normalizeHttpError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildRequestConfig(
    options: HttpGetJsonOptions,
    signal: AbortSignal,
    timeoutMs: number,
  ): AxiosRequestConfig {
    return {
      baseURL: options.baseURL,
      params: options.params,
      headers: options.headers,
      timeout: timeoutMs,
      signal,
    };
  }

  private normalizeHttpError(error: unknown): ResilienceError {
    if (this.isResilienceError(error)) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      return this.fromAxiosError(error);
    }

    if (this.isAbortLikeError(error)) {
      return {
        kind: 'aborted',
        message: this.getErrorMessage(error, 'Request was aborted'),
        isRetryable: true,
        isBreakerWorthy: false,
      };
    }

    return {
      kind: 'unknown',
      message: this.getErrorMessage(error, 'Unknown HTTP error'),
      isRetryable: false,
      isBreakerWorthy: true,
    };
  }

  private fromAxiosError(error: AxiosError): ResilienceError {
    const statusCode = error.response?.status;
    const responseData = this.sanitizeResponseData(error.response?.data);
    const code = error.code;
    const message = error.message || 'HTTP request failed';

    if (code === 'ERR_CANCELED') {
      return {
        kind: 'aborted',
        message,
        code,
        statusCode,
        isRetryable: true,
        isBreakerWorthy: false,
        details: {
          response: responseData,
        },
      };
    }

    if (
      code === 'ECONNABORTED' ||
      code === 'ETIMEDOUT' ||
      /timeout/i.test(message)
    ) {
      return {
        kind: 'timeout',
        message,
        code,
        statusCode,
        isRetryable: true,
        isBreakerWorthy: true,
        details: {
          response: responseData,
        },
      };
    }

    if (statusCode === 403) {
      return {
        kind: 'http_403',
        message,
        code,
        statusCode,
        isRetryable: false,
        isBreakerWorthy: true,
        details: {
          response: responseData,
        },
      };
    }

    if (statusCode === 429) {
      return {
        kind: 'http_429',
        message,
        code,
        statusCode,
        isRetryable: true,
        isBreakerWorthy: true,
        details: {
          response: responseData,
        },
      };
    }

    if (typeof statusCode === 'number' && statusCode >= 500) {
      return {
        kind: 'http_5xx',
        message,
        code,
        statusCode,
        isRetryable: true,
        isBreakerWorthy: true,
        details: {
          response: responseData,
        },
      };
    }

    if (typeof statusCode === 'number' && statusCode >= 400) {
      return {
        kind: 'http_4xx',
        message,
        code,
        statusCode,
        isRetryable: false,
        isBreakerWorthy: false,
        details: {
          response: responseData,
        },
      };
    }

    if (
      code === 'ECONNRESET' ||
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN' ||
      code === 'ECONNREFUSED' ||
      code === 'EHOSTUNREACH' ||
      code === 'ENETUNREACH' ||
      code === 'ERR_NETWORK'
    ) {
      return {
        kind: 'network',
        message,
        code,
        isRetryable: true,
        isBreakerWorthy: true,
      };
    }

    return {
      kind: 'unknown',
      message,
      code,
      statusCode,
      isRetryable: false,
      isBreakerWorthy: true,
      details: {
        response: responseData,
      },
    };
  }

  private sanitizeResponseData(data: unknown): unknown {
    if (data == null) {
      return undefined;
    }

    if (typeof data === 'string') {
      return data.length > 1000 ? `${data.slice(0, 1000)}...` : data;
    }

    if (typeof data === 'object') {
      try {
        const raw = JSON.stringify(data);
        if (raw.length > 1000) {
          return `${raw.slice(0, 1000)}...`;
        }
        return JSON.parse(raw);
      } catch {
        return '[unserializable-response-body]';
      }
    }

    return data;
  }

  private anySignal(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    const onAbort = (event: Event) => {
      const source = event.target as AbortSignal | null;

      cleanup();
      controller.abort(source?.reason);
    };

    const cleanup = () => {
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }

      signal.addEventListener('abort', onAbort, { once: true });
    }

    return controller.signal;
  }

  private isAbortLikeError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const value = error as { name?: string; message?: string; };

    return (
      value.name === 'AbortError' ||
      value.name === 'CanceledError' ||
      /aborted/i.test(value.message ?? '')
    );
  }

  private isResilienceError(error: unknown): error is ResilienceError {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const value = error as Partial<ResilienceError>;

    return typeof value.kind === 'string' && typeof value.message === 'string';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.length > 0) {
      return error;
    }

    return fallback;
  }
}

export const http: HttpClient = new AxiosHttpClient();
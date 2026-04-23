import pino from 'pino';

interface CreateLoggerParams {
  level: pino.LevelWithSilent;
  nodeEnv: string;
}

export function createLogger(params: CreateLoggerParams): pino.Logger {
  const isDevelopment = params.nodeEnv === 'development';

  return pino({
    level: params.level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: isDevelopment
      ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
      : undefined,
  });
}
import pino from 'pino';
import { env, isProduction, isTest } from './env.ts';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            // El mensaje ya resume la petición; los objetos solo aportan ruido en desarrollo
            ignore: 'pid,hostname,req,res,responseTime',
          },
        },
      }),
});

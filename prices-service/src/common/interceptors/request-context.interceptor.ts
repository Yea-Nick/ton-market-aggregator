import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { headers: Record<string, string>; id?: string; }>();
    const response = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void; }>();
    const requestId = request.headers['x-request-id'] ?? randomUUID();
    request.id = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        console.log(`[http] ${requestId} ${context.switchToHttp().getRequest<any>().method} ${context.switchToHttp().getRequest<any>().url} ${durationMs}ms`);
      }),
    );
  }
}

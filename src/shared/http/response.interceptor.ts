import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

export interface SuccessResponseBody<T> {
  success: true;
  data: T;
  requestId: string;
}

/**
 * 모든 정상 응답을 { success, data } 로 감싼다.
 * 에러 응답(AllExceptionsFilter)과 형태가 대칭이라 클라이언트 파싱이 단순해진다.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponseBody<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponseBody<T>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // 요청 추적 ID — 클라이언트가 보내지 않으면 서버가 발급하고 응답 헤더로 돌려준다
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    return next.handle().pipe(map((data) => ({ success: true as const, data, requestId })));
  }
}

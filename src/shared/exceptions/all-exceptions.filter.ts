import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { QueryFailedError } from 'typeorm';
import type { Request, Response } from 'express';
import { AppException } from './app.exception';
import { ERROR_MESSAGE, ErrorCode } from './error-code';

export interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** 장애 문의 시 로그 대조용 */
  requestId: string;
  path: string;
  timestamp: string;
}

/** Postgres 에러코드 → 도메인 에러코드 */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string) ?? 'n/a';

    const { status, body } = this.resolve(exception, req, requestId);

    // 5xx 만 스택까지 남긴다 — 4xx 는 정상적인 클라이언트 오류이므로 로그 비용 절약
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${req.method} ${req.url} → ${body.error.code} [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${body.error.code} [${requestId}]`);
    }

    res.status(status).json(body);
  }

  private resolve(
    exception: unknown,
    req: Request,
    requestId: string,
  ): { status: number; body: ErrorResponseBody } {
    const base = {
      success: false as const,
      requestId,
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    // 1) 도메인 예외 — 그대로 신뢰
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          ...base,
          error: {
            code: exception.code,
            message: ERROR_MESSAGE[exception.code],
            details: exception.details,
          },
        },
      };
    }

    // 2) 레이트리밋
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          ...base,
          error: {
            code: ErrorCode.RATE_LIMITED,
            message: ERROR_MESSAGE[ErrorCode.RATE_LIMITED],
          },
        },
      };
    }

    // 3) DB 제약 위반 — 원본 SQL 이 새어나가지 않도록 변환
    if (exception instanceof QueryFailedError) {
      const driverCode = (exception as unknown as { code?: string }).code;
      if (driverCode === PG_UNIQUE_VIOLATION) {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            ...base,
            error: { code: 'COMMON_DUPLICATED', message: 'Resource already exists' },
          },
        };
      }
      if (driverCode === PG_FK_VIOLATION) {
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            ...base,
            error: { code: 'COMMON_REFERENCE_INVALID', message: 'Referenced resource is invalid' },
          },
        };
      }
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          ...base,
          error: { code: ErrorCode.INTERNAL_ERROR, message: ERROR_MESSAGE[ErrorCode.INTERNAL_ERROR] },
        },
      };
    }

    // 4) Nest 기본 예외 (ValidationPipe 포함)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const isValidation = status === HttpStatus.BAD_REQUEST && typeof payload === 'object';

      return {
        status,
        body: {
          ...base,
          error: {
            code: isValidation ? ErrorCode.VALIDATION_FAILED : this.statusToCode(status),
            message:
              typeof payload === 'string'
                ? payload
                : ((payload as { message?: string | string[] }).message as string) ??
                  exception.message,
            details:
              isValidation && Array.isArray((payload as { message?: string[] }).message)
                ? { fields: (payload as { message: string[] }).message }
                : undefined,
          },
        },
      };
    }

    // 5) 미분류 — 내부 정보를 절대 노출하지 않는다
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        ...base,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: ERROR_MESSAGE[ErrorCode.INTERNAL_ERROR],
        },
      },
    };
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED: return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN: return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND: return ErrorCode.NOT_FOUND;
      case HttpStatus.PAYLOAD_TOO_LARGE: return ErrorCode.PAYLOAD_TOO_LARGE;
      default: return ErrorCode.INTERNAL_ERROR;
    }
  }
}

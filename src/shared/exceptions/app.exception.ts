import { HttpException } from '@nestjs/common';
import { ERROR_MESSAGE, ERROR_STATUS, ErrorCode } from './error-code';

export interface AppExceptionOptions {
  /** 클라이언트가 화면에 활용할 부가 정보 (필드명, 잔여 시간 등) */
  details?: Record<string, unknown>;
  /** 서버 로그에만 남길 원인. 응답에는 포함되지 않는다 */
  cause?: unknown;
}

/**
 * 서비스 계층에서 던지는 유일한 예외 타입.
 * HTTP 상태와 메시지를 ErrorCode 한 곳에서 결정하므로 응답 형태가 항상 일정하다.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    super(
      { code, message: ERROR_MESSAGE[code], details: options.details },
      ERROR_STATUS[code],
      { cause: options.cause },
    );
    this.code = code;
    this.details = options.details;
  }

  static notFound(code: ErrorCode, details?: Record<string, unknown>) {
    return new AppException(code, { details });
  }
}

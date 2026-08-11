/**
 * 클라이언트가 분기 처리할 수 있는 안정적인 에러 식별자.
 * 문자열 값은 계약(contract)이므로 한번 배포되면 변경하지 않는다.
 */
export enum ErrorCode {
  // 공통 (COMMON)
  INTERNAL_ERROR = 'COMMON_INTERNAL_ERROR',
  VALIDATION_FAILED = 'COMMON_VALIDATION_FAILED',
  NOT_FOUND = 'COMMON_NOT_FOUND',
  RATE_LIMITED = 'COMMON_RATE_LIMITED',
  PAYLOAD_TOO_LARGE = 'COMMON_PAYLOAD_TOO_LARGE',

  // 인증 (AUTH)
  UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  REFRESH_TOKEN_INVALID = 'AUTH_REFRESH_TOKEN_INVALID',
  SOCIAL_TOKEN_INVALID = 'AUTH_SOCIAL_TOKEN_INVALID',
  SOCIAL_PROVIDER_UNSUPPORTED = 'AUTH_SOCIAL_PROVIDER_UNSUPPORTED',
  FORBIDDEN = 'AUTH_FORBIDDEN',
  ADMIN_ONLY = 'AUTH_ADMIN_ONLY',

  // 회원 (USER)
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_BANNED = 'USER_BANNED',
  NICKNAME_TAKEN = 'USER_NICKNAME_TAKEN',
  NICKNAME_INVALID = 'USER_NICKNAME_INVALID',
  ONBOARDING_REQUIRED = 'USER_ONBOARDING_REQUIRED',

  // 타투이스트 (ARTIST)
  ARTIST_NOT_FOUND = 'ARTIST_NOT_FOUND',
  ARTIST_ALREADY_EXISTS = 'ARTIST_ALREADY_EXISTS',
  SELECTED_MASTER_LIMIT_EXCEEDED = 'ARTIST_SELECTED_MASTER_LIMIT_EXCEEDED',

  // 신고 (REPORT)
  REPORT_NOT_FOUND = 'REPORT_NOT_FOUND',
  REPORT_SELF_NOT_ALLOWED = 'REPORT_SELF_NOT_ALLOWED',
  REPORT_DUPLICATED = 'REPORT_DUPLICATED',
  REPORT_ALREADY_RESOLVED = 'REPORT_ALREADY_RESOLVED',

  // 광고 (AD)
  CAMPAIGN_NOT_FOUND = 'AD_CAMPAIGN_NOT_FOUND',
  AD_SLOT_SOLD_OUT = 'AD_SLOT_SOLD_OUT',
  FREE_UP_COOLDOWN = 'AD_FREE_UP_COOLDOWN',
}

/** HTTP 상태는 코드에 종속되므로 한 곳에서만 매핑한다 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,

  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.REFRESH_TOKEN_INVALID]: 401,
  [ErrorCode.SOCIAL_TOKEN_INVALID]: 401,
  [ErrorCode.SOCIAL_PROVIDER_UNSUPPORTED]: 400,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ADMIN_ONLY]: 403,

  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.USER_SUSPENDED]: 403,
  [ErrorCode.USER_BANNED]: 403,
  [ErrorCode.NICKNAME_TAKEN]: 409,
  [ErrorCode.NICKNAME_INVALID]: 400,
  [ErrorCode.ONBOARDING_REQUIRED]: 428,

  [ErrorCode.ARTIST_NOT_FOUND]: 404,
  [ErrorCode.ARTIST_ALREADY_EXISTS]: 409,
  [ErrorCode.SELECTED_MASTER_LIMIT_EXCEEDED]: 409,

  [ErrorCode.REPORT_NOT_FOUND]: 404,
  [ErrorCode.REPORT_SELF_NOT_ALLOWED]: 400,
  [ErrorCode.REPORT_DUPLICATED]: 409,
  [ErrorCode.REPORT_ALREADY_RESOLVED]: 409,

  [ErrorCode.CAMPAIGN_NOT_FOUND]: 404,
  [ErrorCode.AD_SLOT_SOLD_OUT]: 409,
  [ErrorCode.FREE_UP_COOLDOWN]: 429,
};

/** 로그 노출용 기본 메시지. 사용자 노출 문구는 클라이언트가 코드로 i18n 처리한다 */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  [ErrorCode.INTERNAL_ERROR]: 'Unexpected server error',
  [ErrorCode.VALIDATION_FAILED]: 'Request validation failed',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Payload too large',

  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.TOKEN_EXPIRED]: 'Access token expired',
  [ErrorCode.TOKEN_INVALID]: 'Access token invalid',
  [ErrorCode.REFRESH_TOKEN_INVALID]: 'Refresh token invalid or revoked',
  [ErrorCode.SOCIAL_TOKEN_INVALID]: 'Social provider token verification failed',
  [ErrorCode.SOCIAL_PROVIDER_UNSUPPORTED]: 'Unsupported social provider',
  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.ADMIN_ONLY]: 'Administrator privilege required',

  [ErrorCode.USER_NOT_FOUND]: 'User not found',
  [ErrorCode.USER_SUSPENDED]: 'Account is suspended',
  [ErrorCode.USER_BANNED]: 'Account is permanently banned',
  [ErrorCode.NICKNAME_TAKEN]: 'Nickname already in use',
  [ErrorCode.NICKNAME_INVALID]: 'Nickname does not meet requirements',
  [ErrorCode.ONBOARDING_REQUIRED]: 'Onboarding must be completed first',

  [ErrorCode.ARTIST_NOT_FOUND]: 'Artist page not found',
  [ErrorCode.ARTIST_ALREADY_EXISTS]: 'Artist page already exists',
  [ErrorCode.SELECTED_MASTER_LIMIT_EXCEEDED]: 'Selected Master seats are full',

  [ErrorCode.REPORT_NOT_FOUND]: 'Report not found',
  [ErrorCode.REPORT_SELF_NOT_ALLOWED]: 'Cannot report yourself',
  [ErrorCode.REPORT_DUPLICATED]: 'Duplicate report already submitted',
  [ErrorCode.REPORT_ALREADY_RESOLVED]: 'Report is already resolved',

  [ErrorCode.CAMPAIGN_NOT_FOUND]: 'Campaign not found',
  [ErrorCode.AD_SLOT_SOLD_OUT]: 'All ad slots are occupied',
  [ErrorCode.FREE_UP_COOLDOWN]: 'Free UP is on cooldown',
};

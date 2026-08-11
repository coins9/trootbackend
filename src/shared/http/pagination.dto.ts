import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * 커서 기반 페이지네이션.
 * OFFSET 은 뒤 페이지로 갈수록 스캔량이 선형 증가하므로 목록 API 에서는 커서를 사용한다.
 */
export class CursorPaginationQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50) // 상한을 고정해 과도한 응답/DB 부하를 차단
  limit = 20;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export const buildCursorPage = <T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => string,
): CursorPage<T> => {
  // limit + 1 건을 조회했다는 전제 — 초과분 존재 여부로 hasNext 를 판단(COUNT 쿼리 제거)
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  return {
    items,
    hasNext,
    nextCursor: hasNext && items.length > 0 ? toCursor(items[items.length - 1]) : null,
  };
};

/** 관리자 테이블용 오프셋 페이지네이션 (총 건수 표시가 필요한 화면 한정) */
export class OffsetPaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;
}

export interface OffsetPage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

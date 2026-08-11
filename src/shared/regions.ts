/**
 * 지역 코드 표준 (single source of truth).
 * ⚠️ 앱 src/domain/entities/regions.ts 와 반드시 동일하게 유지할 것.
 *
 * 광고 세그먼트·검색·타투이스트 지역이 모두 이 code 를 쓴다.
 */
export interface RegionOption {
  code: string;
  label: string;
}

export const REGIONS: RegionOption[] = [
  { code: 'seoul_gangnam', label: '서울 · 강남/서초' },
  { code: 'seoul_hongdae', label: '서울 · 홍대/합정/망원' },
  { code: 'seoul_itaewon', label: '서울 · 이태원/용산' },
  { code: 'seoul_konkuk', label: '서울 · 건대/성수' },
  { code: 'seoul_etc', label: '서울 · 기타' },
  { code: 'gyeonggi_incheon', label: '경기/인천' },
  { code: 'busan', label: '부산' },
  { code: 'daegu', label: '대구' },
  { code: 'gwangju', label: '광주' },
  { code: 'daejeon', label: '대전' },
  { code: 'ulsan', label: '울산' },
  { code: 'gyeongsang', label: '경상' },
  { code: 'jeolla', label: '전라' },
  { code: 'chungcheong', label: '충청' },
  { code: 'gangwon', label: '강원' },
  { code: 'jeju', label: '제주' },
  { code: 'etc', label: '그 외 지역' },
];

export const REGION_CODES = REGIONS.map((r) => r.code);
const CODE_SET = new Set(REGION_CODES);

/** DTO 검증용 — 알 수 없는 지역 코드를 차단 */
export const isValidRegionCode = (code: string): boolean => CODE_SET.has(code);

/** 표준 장르 코드 — 광고/필터 세그먼트 축 */
export const GENRES: RegionOption[] = [
  { code: 'blackwork', label: '블랙워크' },
  { code: 'black_grey', label: '블랙앤그레이' },
  { code: 'irezumi', label: '이레즈미' },
  { code: 'linework', label: '라인워크' },
  { code: 'lettering', label: '레터링' },
  { code: 'minimal', label: '미니타투' },
  { code: 'oldschool', label: '올드스쿨' },
  { code: 'newschool', label: '뉴스쿨' },
  { code: 'watercolor', label: '수채화' },
  { code: 'realistic', label: '리얼리스틱' },
  { code: 'coverup', label: '커버업' },
  { code: 'etc', label: '기타' },
];

export const GENRE_CODES = GENRES.map((g) => g.code);
const GENRE_SET = new Set(GENRE_CODES);

export const isValidGenreCode = (code: string): boolean => GENRE_SET.has(code);

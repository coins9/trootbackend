-- 최초 컨테이너 생성 시 1회 실행된다.
-- PostGIS: 타투이스트 반경 검색(위치 기반 탐색)에 사용
CREATE EXTENSION IF NOT EXISTS postgis;
-- UUID 기본키 생성
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 닉네임/샵명 부분 일치 검색을 인덱스로 처리하기 위함 (LIKE '%..%' 최적화)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

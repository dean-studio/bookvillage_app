-- shelves 테이블에 폰트 크기/볼드 컬럼 추가
ALTER TABLE shelves ADD COLUMN font_size integer NOT NULL DEFAULT 0;
ALTER TABLE shelves ADD COLUMN font_bold boolean NOT NULL DEFAULT false;
-- font_size: 0 = 기본값(자동), 그 외 px 단위 (8~24)

-- shelves 테이블에 type 컬럼 추가 (shelf / label)
ALTER TABLE shelves ADD COLUMN type varchar(10) NOT NULL DEFAULT 'shelf';

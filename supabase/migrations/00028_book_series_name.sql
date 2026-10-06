-- 전집(시리즈) 이름: 유아 전집(age_group = 'infant_set')을 시리즈별로 묶어 보기
ALTER TABLE books ADD COLUMN IF NOT EXISTS series_name varchar(100);
CREATE INDEX IF NOT EXISTS idx_books_series_name ON books(series_name) WHERE is_deleted = false AND series_name IS NOT NULL;

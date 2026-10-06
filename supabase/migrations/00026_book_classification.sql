-- 도서 분류: 연령(1개) + 교과연계 학년(여러 개)
-- age_group: age_0_3, age_4_7, elem_1_2, elem_3_4, elem_5_6, elem_all, teen, adult (NULL = 미분류)
ALTER TABLE books ADD COLUMN IF NOT EXISTS age_group varchar(20);
ALTER TABLE books ADD COLUMN IF NOT EXISTS textbook_grades smallint[] NOT NULL DEFAULT '{}';
-- 분류 출처: aladin, kyobo, shelf(서가 구분), manual(관리자 지정)
ALTER TABLE books ADD COLUMN IF NOT EXISTS classification_source varchar(20);
ALTER TABLE books ADD COLUMN IF NOT EXISTS classified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_books_age_group ON books(age_group) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_books_textbook_grades ON books USING gin(textbook_grades);

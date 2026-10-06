-- 도서 하위 분류 (유아: play 놀이, picture 그림책, culture 교양, study 학습, character 캐릭터)
ALTER TABLE books ADD COLUMN IF NOT EXISTS sub_category varchar(20);
CREATE INDEX IF NOT EXISTS idx_books_sub_category ON books(age_group, sub_category) WHERE is_deleted = false;

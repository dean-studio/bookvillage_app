-- AR(Accelerated Reader) 레벨 정보: 학원 등에서 원서를 레벨별로 찾고 빌릴 때 사용
-- 모두 NULL 허용이라 기존 사이트(아파트·유치원)에는 영향 없음. 설정 ar_enabled='on'일 때만 화면에 보임.
ALTER TABLE books ADD COLUMN IF NOT EXISTS ar_level numeric(4,1);     -- Book Level 0.1~13.9
ALTER TABLE books ADD COLUMN IF NOT EXISTS ar_points numeric(5,1);
ALTER TABLE books ADD COLUMN IF NOT EXISTS ar_quiz_no integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS ar_interest varchar(4);    -- LG / MG / MG+ / UG
ALTER TABLE books ADD COLUMN IF NOT EXISTS word_count integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS lexile varchar(10);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_ar_level_range') THEN
    ALTER TABLE books ADD CONSTRAINT books_ar_level_range CHECK (ar_level IS NULL OR (ar_level >= 0 AND ar_level <= 13.9));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_books_ar_level ON books(ar_level) WHERE is_deleted = false AND ar_level IS NOT NULL;

-- 설정 값 길이 제한 해제 (반 목록 member_groups가 JSON이라 200자를 넘을 수 있음). 무손실 변환.
ALTER TABLE library_settings ALTER COLUMN value TYPE text;

NOTIFY pgrst, 'reload schema';

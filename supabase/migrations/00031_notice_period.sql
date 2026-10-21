-- 공지 게시 기간: 비워 두면 제한 없음 (한국 날짜 기준, 양 끝 날짜 포함)
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

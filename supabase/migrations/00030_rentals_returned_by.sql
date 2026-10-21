-- 반납 처리자 기록. dev/h2books에는 수동으로 추가돼 있었으나 마이그레이션에 누락 → 새 지점(유치원)에서 반납 실패
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES public.profiles(id);

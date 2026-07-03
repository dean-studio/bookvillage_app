-- 도서 등록자 / 대출 처리자 기록 (감사 로그)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS checked_out_by uuid REFERENCES public.profiles(id);

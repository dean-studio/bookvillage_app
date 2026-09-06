-- 신간도서 연령 분류 (유아 / 어린이 / 청소년 / 성인)
ALTER TABLE public.new_arrivals
  ADD COLUMN IF NOT EXISTS category varchar(20) NOT NULL DEFAULT 'adult';
-- category 값: 'infant'(유아) / 'child'(어린이) / 'teen'(청소년) / 'adult'(성인)

CREATE INDEX IF NOT EXISTS idx_new_arrivals_month_category
  ON public.new_arrivals(year_month, category, sort_order);

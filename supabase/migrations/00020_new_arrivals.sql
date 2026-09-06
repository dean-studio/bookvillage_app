-- 월별 신간도서 (인쇄용)
CREATE TABLE IF NOT EXISTS public.new_arrivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month varchar(7) NOT NULL,           -- 'YYYY-MM'
  title varchar(300) NOT NULL,
  author varchar(300) NOT NULL DEFAULT '',
  cover_image text,                          -- 교보 이미지 URL 그대로 저장
  source_url text,                           -- 교보문고 원본 링크
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_new_arrivals_month ON public.new_arrivals(year_month, sort_order);

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS set_updated_at ON public.new_arrivals;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.new_arrivals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.new_arrivals ENABLE ROW LEVEL SECURITY;

-- 모두 조회 가능 (인쇄/공개)
DROP POLICY IF EXISTS "new_arrivals_select" ON public.new_arrivals;
CREATE POLICY "new_arrivals_select" ON public.new_arrivals
  FOR SELECT USING (true);

-- 관리자만 작성/수정/삭제 (service_role로 처리, 정책은 최소)
DROP POLICY IF EXISTS "new_arrivals_admin_all" ON public.new_arrivals;
CREATE POLICY "new_arrivals_admin_all" ON public.new_arrivals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT ALL ON public.new_arrivals TO anon, authenticated, service_role;

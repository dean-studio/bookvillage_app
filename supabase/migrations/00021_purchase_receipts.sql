-- 월별 구매 영수증
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month varchar(7) NOT NULL,           -- 'YYYY-MM'
  image_url text NOT NULL,                   -- 영수증 이미지 URL (images 버킷)
  memo varchar(200) NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_month ON public.purchase_receipts(year_month, sort_order);

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS set_updated_at ON public.purchase_receipts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 (영수증은 민감 정보 → 공개 아님)
DROP POLICY IF EXISTS "purchase_receipts_admin_select" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts_admin_select" ON public.purchase_receipts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 관리자만 작성/수정/삭제 (service_role로 처리, 정책은 최소)
DROP POLICY IF EXISTS "purchase_receipts_admin_all" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts_admin_all" ON public.purchase_receipts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT ALL ON public.purchase_receipts TO anon, authenticated, service_role;

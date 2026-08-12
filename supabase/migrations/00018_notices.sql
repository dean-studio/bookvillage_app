-- 공지사항
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

-- 주민이 공지를 마지막으로 확인한 시각
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notices_read_at timestamptz;

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS set_updated_at ON public.notices;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 발행된 공지는 모두 조회 가능
DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices
  FOR SELECT USING (is_published = true);

-- 관리자만 작성/수정/삭제 (service_role로 처리하므로 정책은 최소)
DROP POLICY IF EXISTS "notices_admin_all" ON public.notices;
CREATE POLICY "notices_admin_all" ON public.notices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT ALL ON public.notices TO anon, authenticated, service_role;

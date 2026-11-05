-- 학원 모드: 학생 부가정보와 AR 퀴즈 통과 기록
-- 새 테이블만 추가하고 profiles·rentals는 바꾸지 않는다. 학원이 아닌 사이트에서는 빈 테이블로 남는다.

-- academy_members: 학생별 학년·레벨 범위(ZPD)·상태
CREATE TABLE IF NOT EXISTS academy_members (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  grade smallint,
  zpd_low numeric(4,1),
  zpd_high numeric(4,1),
  status varchar(10) NOT NULL DEFAULT 'active',   -- active / inactive(퇴원)
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE academy_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS academy_members_select_own ON academy_members;
CREATE POLICY academy_members_select_own ON academy_members FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS academy_members_admin_all ON academy_members;
CREATE POLICY academy_members_admin_all ON academy_members FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ar_results: AR 퀴즈 통과 기록 (선생님이 체크). 젤리와는 연결하지 않는다.
CREATE TABLE IF NOT EXISTS ar_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id uuid REFERENCES books(id) ON DELETE SET NULL,
  rental_id uuid REFERENCES rentals(id) ON DELETE SET NULL,
  passed boolean NOT NULL DEFAULT true,
  points numeric(5,1) NOT NULL DEFAULT 0,
  words integer,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ar_results_user ON ar_results(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ar_results_user_book ON ar_results(user_id, book_id) WHERE book_id IS NOT NULL;
ALTER TABLE ar_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ar_results_select_own ON ar_results;
CREATE POLICY ar_results_select_own ON ar_results FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS ar_results_admin_all ON ar_results;
CREATE POLICY ar_results_admin_all ON ar_results FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';

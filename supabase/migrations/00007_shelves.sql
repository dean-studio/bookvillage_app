-- Book Village: Shelves (서재) 관리 테이블

CREATE TABLE shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  position_x int NOT NULL DEFAULT 0,
  position_y int NOT NULL DEFAULT 0,
  width int NOT NULL DEFAULT 1,
  height int NOT NULL DEFAULT 1,
  color varchar(20) DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shelves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스: 이름으로 조회
CREATE UNIQUE INDEX idx_shelves_name ON shelves(name);

-- RLS 활성화
ALTER TABLE shelves ENABLE ROW LEVEL SECURITY;

-- 주민: 조회만 가능
CREATE POLICY "shelves_select" ON shelves
  FOR SELECT TO authenticated USING (true);

-- 관리자: CRUD 전체
CREATE POLICY "shelves_insert_admin" ON shelves
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "shelves_update_admin" ON shelves
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "shelves_delete_admin" ON shelves
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

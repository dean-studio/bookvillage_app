-- Book Village: 중고장터 (Market Items)

-- ============================================================
-- market_items (중고장터 게시물)
-- ============================================================

CREATE TABLE market_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  title varchar(100) NOT NULL,
  description text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(10) NOT NULL DEFAULT 'on_sale'
    CHECK (status IN ('on_sale', 'reserved', 'sold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_items_user ON market_items(user_id);
CREATE INDEX idx_market_items_status ON market_items(status) WHERE status != 'sold';
CREATE INDEX idx_market_items_created ON market_items(created_at DESC);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON market_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE market_items ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자: 게시물 조회
CREATE POLICY "market_items_select" ON market_items
  FOR SELECT TO authenticated
  USING (true);

-- 본인만: 게시물 등록
CREATE POLICY "market_items_insert" ON market_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 본인만: 게시물 수정
CREATE POLICY "market_items_update_own" ON market_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 본인 또는 관리자: 게시물 삭제
CREATE POLICY "market_items_delete_own" ON market_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "market_items_delete_admin" ON market_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

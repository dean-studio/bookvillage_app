-- Book Village: 젤리 포인트 시스템

-- jelly_balances: 사용자별 젤리 잔액
CREATE TABLE jelly_balances (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 0,
  total_earned int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE jelly_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY jelly_balances_select_own ON jelly_balances FOR SELECT USING (user_id = auth.uid());
CREATE POLICY jelly_balances_select_admin ON jelly_balances FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- jelly_history: 젤리 적립/차감 이력
CREATE TABLE jelly_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount int NOT NULL,
  reason varchar(50) NOT NULL,
  description text,
  book_id uuid REFERENCES books(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_jelly_history_user ON jelly_history(user_id, created_at DESC);
ALTER TABLE jelly_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY jelly_history_select_own ON jelly_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY jelly_history_select_admin ON jelly_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY jelly_history_insert_admin ON jelly_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 젤리 설정값
INSERT INTO library_settings (key, value, description) VALUES
  ('jelly_checkout', '5', '도서 대출 시 지급 젤리'),
  ('jelly_return', '5', '도서 반납 시 지급 젤리'),
  ('jelly_report', '10', '독서록 작성 시 지급 젤리'),
  ('jelly_quiz', '3', '퀴즈 정답 시 지급 젤리')
ON CONFLICT (key) DO NOTHING;

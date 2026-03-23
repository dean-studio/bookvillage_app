-- 도서관 운영 설정 테이블
CREATE TABLE library_settings (
  key varchar(50) PRIMARY KEY,
  value varchar(200) NOT NULL,
  description varchar(200),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 기본 설정값 삽입
INSERT INTO library_settings (key, value, description) VALUES
  ('max_rentals', '5', '1인당 최대 대출 가능 권수'),
  ('rental_days', '14', '대출 기간 (일)');

-- RLS
ALTER TABLE library_settings ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 조회 가능
CREATE POLICY "settings_select" ON library_settings
  FOR SELECT TO authenticated USING (true);

-- 관리자만 수정 가능
CREATE POLICY "settings_update_admin" ON library_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 도서별 개별 대여 기간 설정 (NULL이면 기본값 사용)
ALTER TABLE books ADD COLUMN rental_days integer DEFAULT NULL;

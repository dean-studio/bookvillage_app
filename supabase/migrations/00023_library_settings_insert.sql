-- 관리자 설정 신규 키 저장 허용 (upsert의 INSERT 단계가 RLS에 막혀 '설정 저장에 실패' 발생)
-- 새 지점은 apartment_name 등 키가 없어서 첫 저장 시 INSERT가 필요함
DROP POLICY IF EXISTS "settings_insert_admin" ON library_settings;
CREATE POLICY "settings_insert_admin" ON library_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

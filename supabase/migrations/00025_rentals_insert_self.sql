-- 주민 셀프 대출(/rent, 키오스크): 본인 명의 대출 기록 INSERT 허용
-- dev/h2books에는 수동으로 추가돼 있었으나 마이그레이션에 누락 → 새 지점(유치원)에서 셀프 대출 실패
DROP POLICY IF EXISTS "rentals_insert_self" ON rentals;
CREATE POLICY "rentals_insert_self" ON rentals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

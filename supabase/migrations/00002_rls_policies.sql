-- Book Village: Row Level Security Policies

-- ============================================================
-- 1. profiles RLS
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자: 프로필 조회 가능
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- 본인만 자기 프로필 수정 가능
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 관리자: 모든 프로필 수정 가능 (role 변경 등)
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. books RLS
-- ============================================================

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 모든 사용자(비인증 포함): 삭제되지 않은 도서 조회
CREATE POLICY "books_select" ON books
  FOR SELECT
  USING (is_deleted = false);

-- 관리자만: 도서 등록
CREATE POLICY "books_insert_admin" ON books
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자만: 도서 수정
CREATE POLICY "books_update_admin" ON books
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. rentals RLS
-- ============================================================

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- 본인: 자기 대출 기록 조회
CREATE POLICY "rentals_select_own" ON rentals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 관리자: 모든 대출 기록 조회
CREATE POLICY "rentals_select_admin" ON rentals
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자만: 대출 생성
CREATE POLICY "rentals_insert_admin" ON rentals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자만: 반납 처리 (returned_at 업데이트)
CREATE POLICY "rentals_update_admin" ON rentals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 4. quizzes RLS
-- ============================================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- 인증 사용자: 퀴즈 조회
CREATE POLICY "quizzes_select" ON quizzes
  FOR SELECT TO authenticated
  USING (true);

-- 관리자만: 퀴즈 등록
CREATE POLICY "quizzes_insert_admin" ON quizzes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자만: 퀴즈 수정
CREATE POLICY "quizzes_update_admin" ON quizzes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자만: 퀴즈 삭제
CREATE POLICY "quizzes_delete_admin" ON quizzes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 5. quiz_attempts RLS
-- ============================================================

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 본인: 자기 풀이 기록 조회
CREATE POLICY "quiz_attempts_select_own" ON quiz_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 인증 사용자: 풀이 기록 생성 (본인만)
CREATE POLICY "quiz_attempts_insert" ON quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 관리자: 모든 풀이 기록 조회
CREATE POLICY "quiz_attempts_select_admin" ON quiz_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 6. book_reports RLS
-- ============================================================

ALTER TABLE book_reports ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자: 독서록 조회
CREATE POLICY "book_reports_select" ON book_reports
  FOR SELECT TO authenticated
  USING (true);

-- 본인만: 독서록 작성
CREATE POLICY "book_reports_insert" ON book_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 본인만: 독서록 수정
CREATE POLICY "book_reports_update_own" ON book_reports
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 본인만: 독서록 삭제
CREATE POLICY "book_reports_delete_own" ON book_reports
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 관리자: 독서록 삭제
CREATE POLICY "book_reports_delete_admin" ON book_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 7. notifications RLS
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 관리자만: 알림 이력 조회/생성
CREATE POLICY "notifications_admin" ON notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

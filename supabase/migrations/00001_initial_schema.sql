-- Book Village: Initial Database Schema
-- Tables: profiles, books, rentals, quizzes, quiz_attempts, book_reports, notifications

-- ============================================================
-- 0. Common: updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. profiles (주민 프로필)
-- ============================================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number varchar(11) UNIQUE NOT NULL,
  name varchar(20) NOT NULL,
  dong_ho varchar(20) NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'resident'
    CHECK (role IN ('resident', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_phone ON profiles(phone_number);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_dong_ho ON profiles(dong_ho);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 회원가입 시 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, phone_number, name, dong_ho)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'dong_ho'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. books (도서)
-- ============================================================

CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode varchar(50) UNIQUE NOT NULL,
  title varchar(200) NOT NULL,
  author varchar(100) NOT NULL,
  publisher varchar(100),
  cover_image text,
  description text,
  location_group varchar(50) NOT NULL,
  location_detail varchar(50) NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_books_barcode ON books(barcode);
CREATE INDEX idx_books_title ON books USING gin(to_tsvector('korean', title));
CREATE INDEX idx_books_author ON books USING gin(to_tsvector('korean', author));
CREATE INDEX idx_books_available ON books(is_available) WHERE is_deleted = false;
CREATE INDEX idx_books_location ON books(location_group, location_detail);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. rentals (대출 기록)
-- ============================================================

CREATE TABLE rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  rented_at timestamptz NOT NULL DEFAULT now(),
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rentals_book ON rentals(book_id);
CREATE INDEX idx_rentals_user ON rentals(user_id);
CREATE INDEX idx_rentals_active ON rentals(user_id) WHERE returned_at IS NULL;
CREATE INDEX idx_rentals_overdue ON rentals(due_date) WHERE returned_at IS NULL;
CREATE INDEX idx_rentals_rented_at ON rentals(rented_at);

-- 대출 시 도서 상태 자동 변경
CREATE OR REPLACE FUNCTION handle_rental_checkout()
RETURNS trigger AS $$
BEGIN
  UPDATE books SET is_available = false, updated_at = now()
  WHERE id = NEW.book_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_rental_created
  AFTER INSERT ON rentals
  FOR EACH ROW EXECUTE FUNCTION handle_rental_checkout();

-- 반납 시 도서 상태 자동 변경
CREATE OR REPLACE FUNCTION handle_rental_return()
RETURNS trigger AS $$
BEGIN
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE books SET is_available = true, updated_at = now()
    WHERE id = NEW.book_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_rental_returned
  AFTER UPDATE OF returned_at ON rentals
  FOR EACH ROW EXECUTE FUNCTION handle_rental_return();

-- ============================================================
-- 4. quizzes (독서 퀴즈)
-- ============================================================

CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  question text NOT NULL,
  options jsonb NOT NULL,
  answer smallint NOT NULL CHECK (answer >= 0 AND answer <= 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quizzes_book ON quizzes(book_id);

-- ============================================================
-- 5. quiz_attempts (퀴즈 풀이 기록)
-- ============================================================

CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  selected_answer smallint NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id)
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- ============================================================
-- 6. book_reports (독서록)
-- ============================================================

CREATE TABLE book_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

CREATE INDEX idx_book_reports_book ON book_reports(book_id);
CREATE INDEX idx_book_reports_user ON book_reports(user_id);
CREATE INDEX idx_book_reports_rating ON book_reports(book_id, rating);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON book_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. notifications (알림 발송 이력)
-- ============================================================

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id),
  type varchar(10) NOT NULL CHECK (type IN ('7day', '30day')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  status varchar(10) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  UNIQUE (rental_id, type)
);

CREATE INDEX idx_notifications_rental ON notifications(rental_id);
CREATE INDEX idx_notifications_type ON notifications(type, sent_at);

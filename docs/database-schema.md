# 데이터베이스 스키마 설계 문서 (Book Village)

Supabase (PostgreSQL) 기반 데이터베이스 상세 설계.

## 테이블 관계도 (ER Diagram)

```
profiles (주민)
  │
  ├──< rentals (대출 기록) >── books (도서)
  ├──< book_reports (독서록) >── books
  ├──< quiz_attempts (퀴즈 풀이) >── quizzes >── books
  └──< notifications (알림 이력)
```

---

## 1. profiles (주민 프로필)

Supabase Auth의 `auth.users` 테이블과 1:1 연결.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, FK → auth.users(id) | Supabase Auth UID |
| `phone_number` | `varchar(11)` | UNIQUE, NOT NULL | 휴대폰 번호 (하이픈 없이) |
| `name` | `varchar(20)` | NOT NULL | 실명 |
| `dong_ho` | `varchar(20)` | NOT NULL | 동호수 (예: "101동 202호") |
| `role` | `varchar(10)` | NOT NULL, DEFAULT 'resident' | 'resident' 또는 'admin' |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 가입일시 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 수정일시 |

### SQL

```sql
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

-- 트리거: 회원가입 시 자동 프로필 생성
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
```

### 인덱스

```sql
CREATE INDEX idx_profiles_phone ON profiles(phone_number);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_dong_ho ON profiles(dong_ho);
```

### RLS 정책

```sql
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
```

---

## 2. books (도서)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 도서 고유 ID |
| `barcode` | `varchar(50)` | UNIQUE, NOT NULL | ISBN 또는 자체 바코드 |
| `title` | `varchar(200)` | NOT NULL | 도서명 |
| `author` | `varchar(100)` | NOT NULL | 저자 |
| `publisher` | `varchar(100)` | | 출판사 |
| `cover_image` | `text` | | 표지 이미지 URL |
| `description` | `text` | | 도서 설명 |
| `location_group` | `varchar(50)` | NOT NULL | 서가 그룹 (예: "어린이 코너") |
| `location_detail` | `varchar(50)` | NOT NULL | 서가 상세 위치 (예: "A-3") |
| `is_available` | `boolean` | NOT NULL, DEFAULT true | 대출 가능 여부 |
| `is_deleted` | `boolean` | NOT NULL, DEFAULT false | 삭제 여부 (soft delete) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 등록일시 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 수정일시 |

### SQL

```sql
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
```

### 인덱스

```sql
CREATE INDEX idx_books_barcode ON books(barcode);
CREATE INDEX idx_books_title ON books USING gin(to_tsvector('korean', title));
CREATE INDEX idx_books_author ON books USING gin(to_tsvector('korean', author));
CREATE INDEX idx_books_available ON books(is_available) WHERE is_deleted = false;
CREATE INDEX idx_books_location ON books(location_group, location_detail);
```

### RLS 정책

```sql
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 모든 사용자(비인증 포함): 삭제되지 않은 도서 조회 가능
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
```

---

## 3. rentals (대출 기록)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 대출 고유 ID |
| `book_id` | `uuid` | FK → books(id), NOT NULL | 도서 ID |
| `user_id` | `uuid` | FK → profiles(id), NOT NULL | 대출자 ID |
| `rented_at` | `timestamptz` | NOT NULL, DEFAULT now() | 대출일시 |
| `due_date` | `date` | NOT NULL | 반납 예정일 (대출일 + 14일) |
| `returned_at` | `timestamptz` | | 실제 반납일시 (NULL = 대출 중) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 레코드 생성일시 |

### SQL

```sql
CREATE TABLE rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  rented_at timestamptz NOT NULL DEFAULT now(),
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 대출 시 도서 상태 자동 변경 트리거
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

-- 반납 시 도서 상태 자동 변경 트리거
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
```

### 인덱스

```sql
CREATE INDEX idx_rentals_book ON rentals(book_id);
CREATE INDEX idx_rentals_user ON rentals(user_id);
CREATE INDEX idx_rentals_active ON rentals(user_id) WHERE returned_at IS NULL;
CREATE INDEX idx_rentals_overdue ON rentals(due_date) WHERE returned_at IS NULL;
CREATE INDEX idx_rentals_rented_at ON rentals(rented_at);
```

### RLS 정책

```sql
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
```

---

## 4. quizzes (독서 퀴즈)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 퀴즈 고유 ID |
| `book_id` | `uuid` | FK → books(id), NOT NULL | 도서 ID |
| `question` | `text` | NOT NULL | 퀴즈 질문 |
| `options` | `jsonb` | NOT NULL | 선택지 배열 (4개) |
| `answer` | `smallint` | NOT NULL | 정답 인덱스 (0~3) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 생성일시 |

### SQL

```sql
CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  question text NOT NULL,
  options jsonb NOT NULL,
  answer smallint NOT NULL CHECK (answer >= 0 AND answer <= 3),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 인덱스

```sql
CREATE INDEX idx_quizzes_book ON quizzes(book_id);
```

### RLS 정책

```sql
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- 인증 사용자: 퀴즈 조회 (answer 컬럼은 서버에서 제외)
CREATE POLICY "quizzes_select" ON quizzes
  FOR SELECT TO authenticated
  USING (true);

-- 관리자만: 퀴즈 등록
CREATE POLICY "quizzes_insert_admin" ON quizzes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자만: 퀴즈 수정/삭제
CREATE POLICY "quizzes_update_admin" ON quizzes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "quizzes_delete_admin" ON quizzes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 5. quiz_attempts (퀴즈 풀이 기록)

CLAUDE.md에는 없지만 "퀴즈는 1회만 풀 수 있음" 비즈니스 규칙 구현에 필요.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 풀이 고유 ID |
| `quiz_id` | `uuid` | FK → quizzes(id), NOT NULL | 퀴즈 ID |
| `user_id` | `uuid` | FK → profiles(id), NOT NULL | 풀이자 ID |
| `selected_answer` | `smallint` | NOT NULL | 선택한 답 인덱스 |
| `is_correct` | `boolean` | NOT NULL | 정답 여부 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 풀이일시 |

### SQL

```sql
CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  selected_answer smallint NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id)  -- 1인 1회 제한
);
```

### 인덱스

```sql
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
```

### RLS 정책

```sql
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
```

---

## 6. book_reports (독서록)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 독서록 고유 ID |
| `book_id` | `uuid` | FK → books(id), NOT NULL | 도서 ID |
| `user_id` | `uuid` | FK → profiles(id), NOT NULL | 작성자 ID |
| `rating` | `smallint` | NOT NULL, CHECK (1~5) | 평점 |
| `review` | `text` | NOT NULL | 독서록 내용 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 작성일시 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 수정일시 |

### SQL

```sql
CREATE TABLE book_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)  -- 도서당 1인 1독서록
);
```

### 인덱스

```sql
CREATE INDEX idx_book_reports_book ON book_reports(book_id);
CREATE INDEX idx_book_reports_user ON book_reports(user_id);
CREATE INDEX idx_book_reports_rating ON book_reports(book_id, rating);
```

### RLS 정책

```sql
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
```

---

## 7. notifications (알림 발송 이력)

CLAUDE.md에는 없지만 "동일 단계 알림은 1회만 발송" 비즈니스 규칙 구현에 필요.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 알림 고유 ID |
| `rental_id` | `uuid` | FK → rentals(id), NOT NULL | 대출 ID |
| `type` | `varchar(10)` | NOT NULL | '7day' 또는 '30day' |
| `sent_at` | `timestamptz` | NOT NULL, DEFAULT now() | 발송일시 |
| `status` | `varchar(10)` | NOT NULL, DEFAULT 'sent' | 'sent', 'failed' |

### SQL

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id),
  type varchar(10) NOT NULL CHECK (type IN ('7day', '30day')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  status varchar(10) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  UNIQUE (rental_id, type)  -- 동일 대출건에 같은 타입 알림 1회만
);
```

### 인덱스

```sql
CREATE INDEX idx_notifications_rental ON notifications(rental_id);
CREATE INDEX idx_notifications_type ON notifications(type, sent_at);
```

### RLS 정책

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 관리자만: 알림 이력 조회/생성
CREATE POLICY "notifications_admin" ON notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 공통 트리거: updated_at 자동 갱신

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON book_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 유용한 뷰 (Views)

### 현재 연체 목록

```sql
CREATE VIEW overdue_rentals AS
SELECT
  r.id,
  r.book_id,
  r.user_id,
  r.rented_at,
  r.due_date,
  (CURRENT_DATE - r.due_date) AS overdue_days,
  b.title AS book_title,
  b.barcode AS book_barcode,
  p.name AS user_name,
  p.dong_ho AS user_dong_ho,
  p.phone_number AS user_phone,
  EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.rental_id = r.id AND n.type = '7day' AND n.status = 'sent'
  ) AS notified_7day,
  EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.rental_id = r.id AND n.type = '30day' AND n.status = 'sent'
  ) AS notified_30day
FROM rentals r
JOIN books b ON b.id = r.book_id
JOIN profiles p ON p.id = r.user_id
WHERE r.returned_at IS NULL
  AND r.due_date < CURRENT_DATE;
```

### 도서별 평균 평점

```sql
CREATE VIEW book_ratings AS
SELECT
  book_id,
  COUNT(*) AS review_count,
  ROUND(AVG(rating), 1) AS avg_rating
FROM book_reports
GROUP BY book_id;
```

---

## 테이블 요약

| 테이블 | 설명 | 레코드 예상 규모 |
|--------|------|----------------|
| `profiles` | 주민 프로필 | 수백~수천 |
| `books` | 도서 목록 | 수백~수천 |
| `rentals` | 대출/반납 기록 | 수천~수만 |
| `quizzes` | 독서 퀴즈 | 수백 |
| `quiz_attempts` | 퀴즈 풀이 기록 | 수천 |
| `book_reports` | 독서록 | 수백~수천 |
| `notifications` | 알림톡 발송 이력 | 수백 |

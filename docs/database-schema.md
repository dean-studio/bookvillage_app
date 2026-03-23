# 데이터베이스 스키마 설계 문서 (Book Village)

Supabase (PostgreSQL) 기반 데이터베이스 상세 설계. 마이그레이션 00001~00014 적용 기준.

## 테이블 관계도

```
profiles (주민)
  │
  ├──< rentals (대출 기록) >── books (도서)
  ├──< book_reports (독서록) >── books
  ├──< quiz_attempts (퀴즈 풀이) >── quizzes >── books
  ├──< book_deletions (도서 삭제 내역)
  └──< market_items (중고장터)

shelves (서재/라벨 배치) -- 독립 테이블
library_settings (도서관 설정) -- 독립 테이블
notifications (알림톡 발송 이력) >── rentals
```

---

## 1. profiles (주민 프로필)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK, FK → auth.users(id) | Supabase Auth UID |
| `phone_number` | `varchar(11)` | UNIQUE, NOT NULL | 휴대폰 번호 (하이픈 없이) |
| `name` | `varchar(20)` | NOT NULL | 실명 |
| `dong_ho` | `varchar(20)` | NOT NULL | 동호수 (예: "101동 202호") |
| `role` | `varchar(10)` | NOT NULL, DEFAULT 'resident' | 'resident' 또는 'admin' |
| `admin_status` | `varchar(10)` | NULL | 관리자: 'pending' 또는 'approved' |
| `notifications_read_at` | `timestamptz` | NULL | 알림 전체 읽기 시점 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 가입일시 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 수정일시 |

---

## 2. books (도서)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK | 도서 고유 ID |
| `barcode` | `varchar(50)` | UNIQUE, NOT NULL | ISBN 또는 자체 바코드 |
| `title` | `varchar(200)` | NOT NULL | 도서명 |
| `author` | `varchar(100)` | NOT NULL | 저자 |
| `publisher` | `varchar(100)` | NULL | 출판사 |
| `cover_image` | `text` | NULL | 표지 이미지 URL |
| `description` | `text` | NULL | 도서 설명 |
| `isbn` | `varchar(30)` | DEFAULT '' | ISBN 번호 |
| `translators` | `varchar(200)` | DEFAULT '' | 번역자 |
| `published_at` | `varchar(20)` | DEFAULT '' | 출판일 |
| `price` | `integer` | DEFAULT 0 | 정가 |
| `sale_price` | `integer` | DEFAULT 0 | 판매가 |
| `category` | `varchar(200)` | DEFAULT '' | 카카오 카테고리 |
| `kakao_url` | `text` | DEFAULT '' | 카카오 도서 링크 |
| `sale_status` | `varchar(20)` | DEFAULT '' | 판매 상태 |
| `location_group` | `varchar(50)` | NOT NULL | 서가 그룹 (예: "어린이 코너") |
| `location_detail` | `varchar(50)` | NOT NULL | 서가 상세 위치 (예: "A-3") |
| `is_available` | `boolean` | NOT NULL, DEFAULT true | 대출 가능 여부 (트리거 자동 관리) |
| `is_deleted` | `boolean` | NOT NULL, DEFAULT false | soft delete |
| `rental_days` | `integer` | NULL | 도서별 대출 기간 (NULL이면 기본값 사용) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 등록일시 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 수정일시 |

---

## 3. rentals (대출 기록)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| `id` | `uuid` | PK | 대출 고유 ID |
| `book_id` | `uuid` | FK → books(id), NOT NULL | 도서 ID |
| `user_id` | `uuid` | FK → profiles(id), NOT NULL | 대출자 ID |
| `rented_at` | `timestamptz` | NOT NULL, DEFAULT now() | 대출일시 |
| `due_date` | `date` | NOT NULL | 반납 예정일 |
| `returned_at` | `timestamptz` | NULL | 반납일시 (NULL = 대출 중) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 레코드 생성일시 |

**트리거:**
- `on_rental_created`: INSERT → `books.is_available = false`
- `on_rental_returned`: UPDATE returned_at → `books.is_available = true`

---

## 4. quizzes (독서 퀴즈)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `book_id` | `uuid` | FK → books(id) |
| `question` | `text` | 퀴즈 질문 |
| `options` | `jsonb` | 선택지 배열 (4개) |
| `answer` | `smallint` | 정답 인덱스 (0~3) |
| `created_at` | `timestamptz` | 생성일시 |

## 5. quiz_attempts (퀴즈 풀이 기록)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `quiz_id` | `uuid` | FK → quizzes(id) |
| `user_id` | `uuid` | FK → profiles(id) |
| `selected_answer` | `smallint` | 선택한 답 |
| `is_correct` | `boolean` | 정답 여부 |
| `created_at` | `timestamptz` | 풀이일시 |

UNIQUE(quiz_id, user_id) -- 1인 1회 제한

## 6. book_reports (독서록)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `book_id` | `uuid` | FK → books(id) |
| `user_id` | `uuid` | FK → profiles(id) |
| `rating` | `smallint` | 평점 (1~5) |
| `review` | `text` | 독서록 내용 |
| `created_at` | `timestamptz` | 작성일시 |
| `updated_at` | `timestamptz` | 수정일시 |

UNIQUE(book_id, user_id) -- 도서당 1인 1독서록

## 7. notifications (알림톡 발송 이력)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `rental_id` | `uuid` | FK → rentals(id) |
| `type` | `varchar(10)` | '7day' 또는 '30day' |
| `sent_at` | `timestamptz` | 발송일시 |
| `status` | `varchar(10)` | 'sent' 또는 'failed' |

UNIQUE(rental_id, type) -- 동일 대출건에 같은 타입 1회만

## 8. shelves (서재/라벨 배치)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `name` | `varchar(100)` | 서재명/라벨명 |
| `position_x` | `integer` | 그리드 X 위치 |
| `position_y` | `integer` | 그리드 Y 위치 |
| `width` | `integer` | 그리드 너비 |
| `height` | `integer` | 그리드 높이 |
| `color` | `varchar(20)` | 배경 색상 |
| `type` | `varchar(10)` | 'shelf' 또는 'label' |
| `font_size` | `integer` | 0 = 자동, 양수 = 커스텀 |
| `font_bold` | `boolean` | 볼드 여부 |
| `created_at` | `timestamptz` | 생성일시 |
| `updated_at` | `timestamptz` | 수정일시 |

## 9. library_settings (도서관 설정)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `key` | `varchar(50)` | PK, 설정 키 |
| `value` | `varchar(200)` | 설정 값 |
| `description` | `varchar(200)` | 설정 설명 |
| `updated_at` | `timestamptz` | 수정일시 |

**기본 설정값:**
- `max_rentals`: '5' (1인당 최대 대출 권수)
- `rental_days`: '14' (기본 대출 기간)

## 10. book_deletions (도서 삭제 내역)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `book_id` | `uuid` | 삭제된 도서 ID |
| `book_title` | `varchar(200)` | 삭제 시점 도서명 |
| `book_barcode` | `varchar(50)` | 삭제 시점 바코드 |
| `book_author` | `varchar(100)` | 삭제 시점 저자 |
| `deleted_by` | `uuid` | FK → profiles(id) |
| `deleted_at` | `timestamptz` | 삭제 일시 |
| `reason` | `text` | 삭제 사유 |

## 11. market_items (중고장터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → profiles(id) |
| `title` | `varchar(100)` | 제목 |
| `description` | `text` | 설명 |
| `price` | `integer` | 가격 |
| `images` | `jsonb` | 이미지 URL 배열 |
| `status` | `varchar(10)` | 'on_sale', 'reserved', 'sold' |
| `created_at` | `timestamptz` | 등록일시 |
| `updated_at` | `timestamptz` | 수정일시 |

---

## 뷰 (Views)

### overdue_rentals (연체 목록)
반납되지 않은 대출 중 due_date < today인 항목. book/user 정보 JOIN, 7일/30일 알림 발송 여부 포함.

### book_ratings (도서별 평균 평점)
book_reports를 book_id로 GROUP BY, COUNT와 AVG(rating) 계산.

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
| `shelves` | 서재/라벨 그리드 배치 | 수십 |
| `library_settings` | 도서관 운영 설정 | 수 개 |
| `book_deletions` | 도서 삭제 감사 로그 | 수십~수백 |
| `market_items` | 중고장터 게시글 | 수백 |

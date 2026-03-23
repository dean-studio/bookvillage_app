# Supabase 마이그레이션 적용 가이드

## 마이그레이션 파일 목록

```
supabase/migrations/
  00001_initial_schema.sql        -- 테이블 생성 (profiles, books, rentals, quizzes, quiz_attempts, book_reports, notifications)
  00002_rls_policies.sql          -- Row Level Security 정책
  00003_views.sql                 -- 뷰 (overdue_rentals, book_ratings)
  00004_market_items.sql          -- 중고장터 테이블 + RLS
  00005_storage_bucket.sql        -- Supabase Storage 버킷 (book-covers)
  00006_admin_approval.sql        -- 관리자 승인 시스템 (admin_status 컬럼)
  00007_shelves.sql               -- 서재/라벨 그리드 배치 테이블
  00008_shelves_type.sql          -- 서재 type 컬럼 ('shelf' | 'label')
  00009_books_extra_fields.sql    -- 도서 추가 필드 (isbn, translators, price, category 등)
  00010_book_deletion_log.sql     -- 도서 삭제 감사 로그 테이블 (book_deletions)
  00011_books_url_status.sql      -- 도서 URL/판매 상태 필드
  00012_shelves_font.sql          -- 서재 폰트 커스터마이징 (font_size, font_bold)
  00013_library_settings.sql      -- 도서관 설정 테이블 + 도서별 대출 기간 (rental_days)
  00014_notifications_read.sql    -- 알림 읽음 처리 (profiles.notifications_read_at)
```

## 적용 방법

```bash
# Supabase CLI로 마이그레이션 적용
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db push -p "비밀번호" <<< "Y"
```

## 적용 후 확인사항

1. **테이블 생성 확인** (11개 테이블):
   - profiles, books, rentals, quizzes, quiz_attempts, book_reports
   - notifications, market_items, shelves, library_settings, book_deletions

2. **뷰 확인** (2개):
   - overdue_rentals, book_ratings

3. **트리거 확인**:
   - `set_updated_at` (profiles, books, book_reports, market_items)
   - `on_rental_created` (대출 시 books.is_available = false)
   - `on_rental_returned` (반납 시 books.is_available = true)

4. **헬스체크**: `/api/health` 엔드포인트로 연결 확인

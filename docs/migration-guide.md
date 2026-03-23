# Supabase 마이그레이션 적용 가이드

## 마이그레이션 파일 목록

```
supabase/migrations/
  00001_initial_schema.sql    -- 테이블 생성 (profiles, books, rentals, quizzes, quiz_attempts, book_reports, notifications)
  00002_rls_policies.sql      -- Row Level Security 정책
  00003_views.sql             -- 뷰 (overdue_rentals, book_ratings)
  00004_market_items.sql      -- 중고장터 테이블 + RLS
```

## 적용 방법

### 방법 1: Supabase Dashboard (권장 - 초기 설정)

1. [Supabase Dashboard](https://supabase.com/dashboard) > 프로젝트 선택
2. **SQL Editor** 메뉴 클릭
3. 마이그레이션 파일을 **번호 순서대로** 실행:
   - `00001_initial_schema.sql` 실행 > Run 클릭
   - `00002_rls_policies.sql` 실행 > Run 클릭
   - `00003_views.sql` 실행 > Run 클릭
   - `00004_market_items.sql` 실행 > Run 클릭

### 방법 2: Supabase CLI

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 연결
supabase link --project-ref wkirzhkwttjvcbvdhgsf

# 마이그레이션 적용
supabase db push
```

### 방법 3: psql 직접 실행

```bash
# Supabase Dashboard > Settings > Database > Connection string 에서 URI 확인
psql "postgresql://postgres:[PASSWORD]@db.wkirzhkwttjvcbvdhgsf.supabase.co:5432/postgres" \
  -f supabase/migrations/00001_initial_schema.sql \
  -f supabase/migrations/00002_rls_policies.sql \
  -f supabase/migrations/00003_views.sql \
  -f supabase/migrations/00004_market_items.sql
```

## 적용 후 확인사항

1. **테이블 생성 확인**: Dashboard > Table Editor에서 8개 테이블 확인
   - profiles, books, rentals, quizzes, quiz_attempts, book_reports, notifications, market_items

2. **RLS 활성화 확인**: Dashboard > Authentication > Policies에서 모든 테이블에 정책 설정 확인

3. **뷰 확인**: SQL Editor에서 실행
   ```sql
   SELECT * FROM overdue_rentals LIMIT 1;
   SELECT * FROM book_ratings LIMIT 1;
   ```

4. **트리거 확인**: SQL Editor에서 실행
   ```sql
   SELECT trigger_name, event_object_table
   FROM information_schema.triggers
   WHERE trigger_schema = 'public';
   ```
   기대 결과: `set_updated_at` (profiles, books, book_reports, market_items), `on_rental_created`, `on_rental_returned`

5. **헬스체크**: 앱 실행 후 `/api/health` 엔드포인트로 Supabase 연결 확인
   ```bash
   curl http://localhost:3000/api/health
   # 기대 응답: {"status":"healthy","checks":{"env":"ok","supabase":"ok"}}
   ```

## 롤백

마이그레이션 롤백이 필요한 경우 SQL Editor에서 수동으로 실행:

```sql
-- 주의: 모든 데이터가 삭제됩니다
DROP VIEW IF EXISTS book_ratings;
DROP VIEW IF EXISTS overdue_rentals;
DROP TABLE IF EXISTS market_items CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS book_reports CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS rentals CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS handle_rental_checkout();
DROP FUNCTION IF EXISTS handle_rental_return();
```

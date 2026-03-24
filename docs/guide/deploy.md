# 설치 & 배포 가이드

처음부터 끝까지, 책빌리지를 직접 설치하고 배포하는 전체 과정입니다.

## 사전 준비

시작하기 전에 다음 서비스 계정이 필요합니다.

| 서비스 | 용도 | 가격 |
|--------|------|------|
| [Node.js](https://nodejs.org/) 18+ | 로컬 개발 환경 | 무료 |
| [Supabase](https://supabase.com/) | 데이터베이스, 인증, 스토리지 | Free 플랜 무료 |
| [Vercel](https://vercel.com/) | 웹 호스팅, 배포 | Hobby 플랜 무료 |
| [카카오 개발자](https://developers.kakao.com/) | 도서 검색 API (ISBN) | 무료 |

::: tip 관리비 0원 운영
Vercel Hobby + Supabase Free 플랜으로 **월 0원**에 운영할 수 있습니다.
소규모 도서관(도서 수천 권, 주민 수백 명)에 충분한 용량입니다.
:::

---

## 1단계: 프로젝트 클론

```bash
git clone https://github.com/dean-studio/bookvillage_app.git
cd bookvillage
npm install
```

---

## 2단계: Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다
2. **New Project** 클릭
3. 설정:
   - **Name**: 원하는 프로젝트명 (예: `my-bookvillage`)
   - **Database Password**: 안전한 비밀번호 설정 후 **반드시 메모**
   - **Region**: `Northeast Asia (Seoul)` 선택 (한국 사용자 대상)
4. 프로젝트 생성 완료 후, **Project Settings > API**에서 다음 값을 복사합니다:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` 키 → `SUPABASE_SERVICE_ROLE_KEY`

::: warning service_role 키 주의
`service_role` 키는 RLS를 우회하는 강력한 권한입니다. 절대 클라이언트 코드에 노출하지 마세요.
:::

---

## 3단계: 카카오 개발자 API 키 발급

도서 등록 시 ISBN 바코드로 도서 정보를 자동 완성하기 위해 카카오 도서 검색 API를 사용합니다.

1. [카카오 개발자](https://developers.kakao.com/)에 로그인
2. **내 애플리케이션 > 애플리케이션 추가하기**
3. 앱 이름, 사업자명 입력 후 생성
4. **앱 키** 탭에서 `REST API 키`를 복사 → `KAKAO_REST_API_KEY`

---

## 4단계: 환경변수 설정

`.env.example`을 복사하여 `.env.local`을 생성합니다.

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열어 실제 값을 입력합니다:

```env
# Supabase (2단계에서 복사한 값)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 카카오 API (3단계에서 복사한 값)
KAKAO_REST_API_KEY=your-kakao-rest-api-key

# 앱 URL (로컬 개발 시)
NEXT_PUBLIC_APP_URL=http://localhost:6100
```

### 환경변수 설명

| 변수 | 설명 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | O |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 (클라이언트 사용) | O |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 역할 키 (서버 전용) | O |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 | O |
| `NEXT_PUBLIC_APP_URL` | 앱 기본 URL | O |

---

## 5단계: 데이터베이스 마이그레이션

Supabase CLI를 사용하여 테이블, RLS 정책, 트리거 등을 자동 생성합니다.

### 5-1. Supabase CLI 설치 (최초 1회)

```bash
npx supabase --version  # 설치 확인
```

### 5-2. Supabase Access Token 발급

1. [Supabase Dashboard](https://supabase.com/dashboard) > 좌측 하단 **Account** > **Access Tokens**
2. **Generate new token** 클릭 → 토큰 복사

### 5-3. 프로젝트 연결 및 마이그레이션 적용

```bash
# 프로젝트 연결
SUPABASE_ACCESS_TOKEN=<your-access-token> \
  npx supabase link --project-ref <your-project-ref>

# 마이그레이션 적용
SUPABASE_ACCESS_TOKEN=<your-access-token> \
  npx supabase db push -p "<db-password>" <<< "Y"
```

- `<your-access-token>`: 5-2에서 발급한 토큰
- `<your-project-ref>`: Supabase 대시보드 URL에서 확인 (`https://supabase.com/dashboard/project/여기`)
- `<db-password>`: 2단계에서 설정한 데이터베이스 비밀번호

### 5-4. 적용 확인

마이그레이션이 성공하면 다음이 생성됩니다:

| 항목 | 내용 |
|------|------|
| 테이블 (15개) | profiles, books, rentals, quizzes, quiz_attempts, book_reports, notifications, shelves, library_settings, book_deletions, market_items, jelly_balances, jelly_history, search_logs, book_views |
| 뷰 (2개) | overdue_rentals, book_ratings |
| 트리거 | set_updated_at, on_rental_created, on_rental_returned |
| RLS 정책 | 모든 테이블에 Row Level Security 적용 |
| Storage | book-covers 버킷 (public), images 버킷 (public) |

### 5-5. handle_new_user 트리거 제거 (중요)

새 Supabase 프로젝트에는 `handle_new_user` 트리거가 기본으로 존재할 수 있습니다.
책빌리지는 코드에서 직접 프로필을 생성하므로 이 트리거를 **반드시 제거**해야 합니다.

```bash
SUPABASE_ACCESS_TOKEN=<your-access-token> \
  npx supabase db query --linked \
  "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   DROP FUNCTION IF EXISTS public.handle_new_user();"
```

---

## 6단계: 로컬 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:6100` 접속하여 정상 동작을 확인합니다.

### 헬스체크

```bash
curl http://localhost:6100/api/health
```

정상 응답:
```json
{ "status": "healthy", "checks": { "env": "ok", "supabase": "ok" } }
```

---

## 7단계: 첫 관리자 계정 생성

책빌리지는 초기 설정 API를 제공합니다. 관리자가 한 명도 없을 때만 동작합니다.

### 방법 1: Setup API (권장)

```bash
curl -X POST http://localhost:6100/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "123456", "name": "관리자"}'
```

성공 응답:
```json
{
  "success": true,
  "message": "관리자 'admin' 계정이 생성되었습니다. /admin/login 에서 로그인하세요.",
  "admin": { "username": "admin", "name": "관리자" }
}
```

이제 `/admin/login`에서 `admin` / `123456`으로 로그인할 수 있습니다.

### 방법 2: 웹 UI + DB 직접 수정

1. `/admin/register`에서 관리자 가입
2. Supabase Dashboard > Table Editor > `profiles` 테이블에서 해당 사용자의 `admin_status`를 `pending` → `approved`로 변경

---

## 8단계: 초기 설정

관리자로 로그인 후 `/admin/manage`에서 다음을 설정합니다.

### 8-1. 사이트 유형 선택

`/admin/manage/site-type`에서 기관 유형을 선택합니다:

| 유형 | 주소 체계 | 예시 |
|------|----------|------|
| 아파트 | 동 / 호 | 101동 1201호 |
| 학교 | 학년 / 반 | 3학년 2반 |
| 마을 | 지번 (자유 입력) | 300-3 |

### 8-2. 사이트 설정

`/admin/manage/site`에서 설정합니다:
- **도서관 이름**: 화면 상단에 표시될 이름
- **로고**: 로그인 화면에 표시될 로고 이미지
- **컬러 테마**: 7가지 테마 중 선택 (화이트, 옐로우, 블루, 그린, 로즈, 퍼플, 오렌지)

### 8-3. 대출 설정

`/admin/manage`에서 설정합니다:
- **1인당 최대 대출 권수** (기본: 5권)
- **기본 대출 기간** (기본: 14일)

### 8-4. 서재 배치

`/admin/books/new`에서 서재를 구성합니다:
- SVG 그리드로 서재/라벨을 배치
- 도서 등록 시 서재 위치를 지정하면, 반납 시 서가 위치가 팝업으로 안내됩니다

---

## 9단계: 도서 등록

관리자 로그인 후 `/admin/books/new`에서 도서를 등록합니다.

1. **바코드 스캔** 또는 **ISBN 직접 입력**
2. 카카오 도서 검색 API로 도서 정보가 **자동 완성**됩니다
3. 서재 위치를 선택하고 등록

::: tip ISBN이 없는 도서
카카오 API에서 검색되지 않는 도서는 수동으로 정보를 입력할 수 있습니다.
자체 바코드를 부여하여 관리하세요.
:::

---

## 10단계: Vercel 배포

### 10-1. Vercel CLI 설치

```bash
npm i -g vercel
```

### 10-2. 프로젝트 연결

```bash
vercel link
```

프롬프트에서:
- **Set up and deploy?** → Y
- **Which scope?** → 본인 계정 선택
- **Link to existing project?** → N (새 프로젝트 생성) 또는 Y (기존 프로젝트)
- **Project name** → 원하는 이름

### 10-3. 환경변수 설정

Vercel Dashboard > Project > Settings > Environment Variables에서 다음 환경변수를 추가합니다:

| 변수 | 환경 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development |
| `KAKAO_REST_API_KEY` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | Production (실제 도메인 URL) |

### 10-4. 배포

```bash
npx vercel --prod
```

### 10-5. 배포 확인

배포된 URL에서 헬스체크를 확인합니다:

```bash
curl https://your-app.vercel.app/api/health
```

### 10-6. 배포 환경에서 첫 관리자 생성

로컬에서 이미 생성했더라도, 배포 환경이 별도의 Supabase 프로젝트를 사용한다면
배포 URL에서도 Setup API를 실행해야 합니다:

```bash
curl -X POST https://your-app.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password", "name": "관리자"}'
```

---

## 리전 설정 (선택)

한국 사용자 대상이라면 서울 리전을 설정합니다.

`vercel.json` (프로젝트 루트에 이미 포함):
```json
{
  "regions": ["icn1"]
}
```

---

## 문제 해결

### 마이그레이션 실패

```
Error: migration failed
```

→ Supabase 대시보드 > SQL Editor에서 직접 마이그레이션 SQL을 실행해 보세요.
→ `supabase/migrations/` 폴더의 파일을 순서대로 실행합니다.

### 로그인 실패

```
"휴대폰 번호 또는 비밀번호가 올바르지 않습니다."
```

→ `handle_new_user` 트리거가 남아있으면 프로필 충돌이 발생합니다.
→ 5-5 단계의 트리거 제거 명령을 실행하세요.

### 헬스체크 실패

```json
{ "status": "unhealthy", "checks": { "env": "error" } }
```

→ `.env.local` 또는 Vercel 환경변수가 올바르게 설정되었는지 확인하세요.

### 카카오 도서 검색 안됨

→ 카카오 개발자 콘솔에서 앱 상태가 **활성화**되어 있는지 확인하세요.
→ `KAKAO_REST_API_KEY`가 올바른지 확인하세요.

---

## 개발/운영 환경 분리 (선택)

Dev/Prod 환경을 분리하려면:

1. Supabase에서 프로젝트 2개 생성 (dev, prod)
2. Vercel에서 프로젝트 2개 생성 (bookvillage-dev, bookvillage-prod)
3. 환경별 `.env` 파일 관리:

```bash
# .env.dev  - 개발 Supabase 키
# .env.prod - 운영 Supabase 키

# 로컬에서 환경 전환
cp .env.dev .env.local   # dev DB 사용
cp .env.prod .env.local  # prod DB 사용
```

---

## 문서 사이트 (VitePress)

프로젝트에 포함된 `docs/` 폴더를 VitePress로 로컬에서 미리 볼 수 있습니다.

### 실행

```bash
npx vitepress dev docs
```

### 접속

```
http://localhost:5173/bookvillage/
```

> 5173 포트가 이미 사용 중이면 자동으로 다음 포트(5174, 5175...)를 사용합니다. 터미널에 표시되는 URL을 확인하세요.

### 빌드 (정적 사이트 생성)

```bash
npx vitepress build docs
```

빌드 결과물은 `docs/.vitepress/dist/`에 생성됩니다.
GitHub Pages 등에 배포할 수 있습니다.

---

## 다음 단계

- [주민 사용법](/guide/resident) - 주민(이용자) 가이드
- [관리자 사용법](/guide/admin) - 관리자 가이드
- [데이터베이스 스키마](/database-schema) - DB 테이블 상세

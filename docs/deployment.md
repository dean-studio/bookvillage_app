# 배포 및 인프라 설계 문서

## 목차

1. [인프라 아키텍처 개요](#1-인프라-아키텍처-개요)
2. [Vercel 배포 설정](#2-vercel-배포-설정)
3. [Supabase 프로젝트 설정](#3-supabase-프로젝트-설정)
4. [환경변수 목록](#4-환경변수-목록)
5. [환경별 구성 (dev / staging / prod)](#5-환경별-구성)
6. [CI/CD 파이프라인](#6-cicd-파이프라인)
7. [Vercel Cron Jobs 설정](#7-vercel-cron-jobs-설정)
8. [도메인 및 SSL 설정](#8-도메인-및-ssl-설정)
9. [모니터링 및 로깅](#9-모니터링-및-로깅)
10. [보안 체크리스트](#10-보안-체크리스트)

---

## 1. 인프라 아키텍처 개요

```
[사용자 브라우저/모바일]
        |
        v
[Vercel CDN / Edge Network]
        |
        v
[Next.js App (App Router)]
   |         |         |
   v         v         v
[Supabase]  [카카오     [솔라피/알리고
 - Auth      도서 API]   알림톡 API]
 - PostgreSQL
 - Storage
```

### 기술 스택 요약

| 구분 | 기술 | 용도 |
|------|------|------|
| Frontend / Backend | Next.js 15 (App Router) | SSR, API Routes, React Server Components |
| Database | Supabase (PostgreSQL) | 데이터 저장, 실시간 기능 |
| Auth | Supabase Auth (Phone + PIN) | 커스텀 인증 (휴대폰 번호 + 4자리 PIN) |
| Deployment | Vercel | 호스팅, CDN, Serverless Functions |
| Cron Jobs | Vercel Cron | 연체 알림 스케줄링 |
| External API | 카카오 도서 검색 API | ISBN 기반 도서 정보 자동 완성 |
| Notification | 솔라피/알리고 | 카카오 알림톡 발송 (연체 알림) |

---

## 2. Vercel 배포 설정

### 2.1 프로젝트 연결

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 연결 (최초 1회)
vercel link
```

### 2.2 빌드 설정

| 항목 | 값 |
|------|-----|
| Framework Preset | Next.js |
| Build Command | `next build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Node.js Version | 20.x |

### 2.3 `vercel.json` 설정

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["icn1"],
  "crons": [
    {
      "path": "/api/cron/overdue-notifications",
      "schedule": "0 0 * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, max-age=0" }
      ]
    }
  ]
}
```

> **참고:** `regions: ["icn1"]`은 Vercel의 서울 리전으로, 한국 사용자 대상 서비스에 최적화된 설정입니다.

### 2.4 Serverless Function 설정

- **Runtime:** Node.js 20.x
- **Region:** `icn1` (서울)
- **Max Duration:** 10초 (기본), Cron Job은 60초
- **Memory:** 1024MB (기본)

---

## 3. Supabase 프로젝트 설정

### 3.1 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. **Region:** `Northeast Asia (Seoul)` 선택
3. **Database Password:** 강력한 비밀번호 설정 후 안전하게 보관

### 3.2 환경별 Supabase 프로젝트

| 환경 | 프로젝트명 | 용도 |
|------|-----------|------|
| Development | `bookvillage-dev` | 로컬 개발 및 테스트 |
| Staging | `bookvillage-staging` | 배포 전 검증 |
| Production | `bookvillage-prod` | 실제 서비스 운영 |

### 3.3 Auth 설정

책빌리지는 이메일/소셜 로그인 대신 **휴대폰 번호 + 4자리 PIN** 방식을 사용합니다.

- Supabase Auth의 기본 이메일/비밀번호 인증은 **비활성화**
- `profiles` 테이블에서 `phone_number`와 해싱된 PIN을 직접 관리
- 인증 토큰은 Supabase의 JWT를 활용하여 `supabase.auth.signInWithPassword()`와 연동하거나, 커스텀 JWT 발급

```
인증 흐름:
1. 주민이 휴대폰 번호 + 4자리 PIN 입력
2. Server Action에서 profiles 테이블 조회 및 PIN 검증
3. 검증 성공 시 Supabase Auth 세션 생성 또는 커스텀 JWT 발급
4. 클라이언트에 세션 토큰 반환
```

### 3.4 Row Level Security (RLS)

모든 테이블에 RLS 활성화 필수:

| 테이블 | 정책 |
|--------|------|
| `profiles` | 본인 프로필만 읽기/수정 가능. 관리자는 전체 조회 가능 |
| `books` | 모든 인증 사용자 읽기 가능. 관리자만 생성/수정/삭제 가능 |
| `rentals` | 본인 대여 기록만 조회. 관리자는 전체 CRUD 가능 |
| `quizzes` | 모든 인증 사용자 읽기 가능. 관리자만 생성/수정/삭제 가능 |
| `book_reports` | 본인 독서록 CRUD. 다른 주민 독서록 읽기 가능. 관리자는 전체 관리 |

### 3.5 Storage

도서 표지 이미지 캐시용 Supabase Storage 버킷 설정:

| 버킷명 | 공개 여부 | 용도 |
|--------|----------|------|
| `book-covers` | Public | 카카오 API에서 가져온 도서 표지 이미지 캐시 |

> 카카오 도서 검색 API의 `thumbnail` URL을 직접 사용하되, 안정성을 위해 Storage에 캐싱하는 것을 권장합니다.

---

## 4. 환경변수 목록

### 4.1 전체 환경변수

| 변수명 | 설명 | 예시 | 필수 |
|--------|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxx.supabase.co` | O |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Key (공개) | `eyJhbGciOi...` | O |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (서버 전용) | `eyJhbGciOi...` | O |
| `SUPABASE_DB_URL` | Supabase Direct DB 연결 URL | `postgresql://...` | X |
| `KAKAO_REST_API_KEY` | 카카오 도서 검색 API 키 | `abcdef1234567890` | O |
| `SOLAPI_API_KEY` | 솔라피 API Key (알림톡 발송) | `NCSXYZ...` | O |
| `SOLAPI_API_SECRET` | 솔라피 API Secret | `secret...` | O |
| `SOLAPI_SENDER_NUMBER` | 알림톡 발신 번호 | `02-1234-5678` | O |
| `CRON_SECRET` | Cron Job 인증용 시크릿 | `random-secret-string` | O |
| `NEXT_PUBLIC_APP_URL` | 앱 기본 URL | `https://bookvillage.kr` | O |

### 4.2 환경변수 보안 규칙

- `NEXT_PUBLIC_` 접두사가 있는 변수만 클라이언트에 노출
- `SUPABASE_SERVICE_ROLE_KEY`, `SOLAPI_API_SECRET`, `CRON_SECRET`은 절대 클라이언트에 노출 금지
- Vercel Dashboard > Settings > Environment Variables에서 환경별로 분리 설정
- `.env.local` 파일은 `.gitignore`에 포함 (이미 설정됨)

### 4.3 `.env.local` 템플릿

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Kakao API
KAKAO_REST_API_KEY=your-kakao-rest-api-key

# Solapi (알림톡)
SOLAPI_API_KEY=your-solapi-api-key
SOLAPI_API_SECRET=your-solapi-api-secret
SOLAPI_SENDER_NUMBER=your-sender-number

# Cron
CRON_SECRET=your-cron-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 5. 환경별 구성

### 5.1 환경 구분

| 환경 | 브랜치 | Vercel 환경 | URL | 용도 |
|------|--------|------------|-----|------|
| Development | `dev` | Preview | `dev.bookvillage.kr` | 개발 및 테스트 |
| Staging | `staging` | Preview | `staging.bookvillage.kr` | QA 및 배포 전 검증 |
| Production | `main` | Production | `bookvillage.kr` | 실제 서비스 운영 |

### 5.2 브랜치 전략

```
main (production)
  └── staging (pre-production)
        └── dev (development)
              └── feature/* (기능 개발)
              └── fix/* (버그 수정)
```

- `feature/*`, `fix/*` 브랜치에서 개발 후 `dev`로 PR
- `dev`에서 검증 완료 후 `staging`으로 PR
- `staging`에서 최종 검증 후 `main`으로 PR
- `main`에 머지 시 자동으로 프로덕션 배포

### 5.3 환경별 Vercel 설정

Vercel Dashboard > Settings > Environment Variables에서 각 환경(Production, Preview, Development)에 맞는 값을 설정:

```
Production  → main 브랜치, bookvillage-prod Supabase 프로젝트
Preview     → staging/dev 브랜치, bookvillage-staging Supabase 프로젝트
Development → 로컬 개발, bookvillage-dev Supabase 프로젝트
```

### 5.4 환경별 차이점

| 항목 | Development | Staging | Production |
|------|-------------|---------|------------|
| Supabase 프로젝트 | bookvillage-dev | bookvillage-staging | bookvillage-prod |
| 알림톡 발송 | 비활성화 (로그만 출력) | 테스트 번호로만 발송 | 실제 발송 |
| Cron Jobs | 비활성화 | 활성화 (테스트 데이터) | 활성화 |
| 에러 로깅 | console.log | Vercel Log Drain | Vercel Log Drain |
| 도서 API | 카카오 API (개발 키) | 카카오 API (개발 키) | 카카오 API (운영 키) |

---

## 6. CI/CD 파이프라인

### 6.1 자동 배포 흐름

```
[코드 Push / PR 생성]
        |
        v
[Vercel 자동 빌드]
   - npm install
   - next build
   - TypeScript 타입 체크
   - ESLint 검사
        |
        v
[Preview 배포] ← PR 생성 시 자동 생성
        |
        v
[PR 리뷰 & 머지]
        |
        v
[Production 배포] ← main 브랜치 머지 시
```

### 6.2 GitHub Actions (선택 사항)

Vercel의 기본 CI/CD로 충분하지만, 추가 검증이 필요한 경우 GitHub Actions를 구성합니다.

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [dev, staging, main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: TypeScript 타입 체크
        run: npx tsc --noEmit

      - name: ESLint 검사
        run: npx next lint

      - name: 빌드 테스트
        run: npm run build
```

### 6.3 Pre-commit 검증 (로컬)

개발자 로컬 환경에서 커밋 전 검증을 위해 `husky` + `lint-staged`를 권장합니다.

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

## 7. Vercel Cron Jobs 설정

### 7.1 연체 알림 Cron Job

매일 오전 9시(KST)에 연체된 도서에 대해 알림톡을 발송합니다.

**스케줄:** `0 0 * * *` (UTC 00:00 = KST 09:00)

### 7.2 API Route 구현 위치

```
src/app/api/cron/overdue-notifications/route.ts
```

### 7.3 Cron Job 인증

Vercel Cron Jobs는 요청 시 `Authorization` 헤더에 `Bearer {CRON_SECRET}` 값을 포함합니다. API Route에서 반드시 검증해야 합니다.

```typescript
// src/app/api/cron/overdue-notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 연체 알림 로직
  // 1. rentals 테이블에서 due_date < 오늘 && returned_at IS NULL 조회
  // 2. 연체 7일 차: 첫 번째 알림톡 발송
  // 3. 연체 30일 차: 두 번째 알림톡 발송 (강한 어조)
  // 4. 발송 결과 로깅

  return NextResponse.json({ success: true });
}
```

### 7.4 `vercel.json` Cron 설정

```json
{
  "crons": [
    {
      "path": "/api/cron/overdue-notifications",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 7.5 알림톡 발송 기준

| 연체 일수 | 알림 내용 | 발송 여부 |
|-----------|----------|----------|
| 7일 | "[책빌리지] OOO님, 대출하신 '{도서명}'이 7일 연체되었습니다. 반납 부탁드립니다." | 1회 발송 |
| 30일 | "[책빌리지] OOO님, '{도서명}'이 30일 이상 연체 중입니다. 빠른 반납 부탁드립니다." | 1회 발송 |

> 동일 대여 건에 대해 같은 단계의 알림이 중복 발송되지 않도록, `rentals` 테이블에 `overdue_notified_7d`, `overdue_notified_30d` boolean 컬럼을 추가하여 관리합니다.

---

## 8. 도메인 및 SSL 설정

### 8.1 도메인 구성

| 도메인 | 용도 | Vercel 환경 |
|--------|------|------------|
| `bookvillage.kr` | 프로덕션 | Production |
| `www.bookvillage.kr` | 프로덕션 (리다이렉트) | Production |
| `staging.bookvillage.kr` | 스테이징 | Preview |
| `dev.bookvillage.kr` | 개발 | Preview |

### 8.2 Vercel 도메인 연결

```bash
# Vercel CLI로 도메인 추가
vercel domains add bookvillage.kr
vercel domains add www.bookvillage.kr
vercel domains add staging.bookvillage.kr
vercel domains add dev.bookvillage.kr
```

### 8.3 DNS 설정

도메인 등록 업체(예: 가비아, 후이즈)에서 다음 DNS 레코드를 설정합니다:

| 타입 | 호스트 | 값 |
|------|--------|-----|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |
| CNAME | staging | `cname.vercel-dns.com` |
| CNAME | dev | `cname.vercel-dns.com` |

### 8.4 SSL 인증서

- Vercel이 Let's Encrypt를 통해 **자동으로 SSL 인증서를 발급 및 갱신**
- 별도의 SSL 설정 불필요
- 모든 HTTP 요청은 자동으로 HTTPS로 리다이렉트

---

## 9. 모니터링 및 로깅

### 9.1 Vercel 내장 모니터링

- **Analytics:** 페이지별 로딩 속도, Web Vitals (LCP, FID, CLS)
- **Logs:** Serverless Function 실행 로그 실시간 조회
- **Speed Insights:** 실제 사용자 성능 데이터 수집

### 9.2 활성화 방법

```typescript
// src/app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
```

### 9.3 알림 설정

Vercel Dashboard > Settings > Notifications에서 다음 알림을 설정합니다:

| 이벤트 | 알림 채널 | 설명 |
|--------|----------|------|
| 배포 실패 | 이메일 / Slack | 빌드 또는 배포 실패 시 즉시 알림 |
| 도메인 만료 임박 | 이메일 | SSL 인증서 또는 도메인 만료 전 알림 |

### 9.4 Supabase 모니터링

- **Database Health:** Supabase Dashboard > Database > Health
- **API Logs:** Supabase Dashboard > Logs > API
- **Query Performance:** Supabase Dashboard > Database > Query Performance

---

## 10. 보안 체크리스트

### 배포 전 필수 확인 사항

- [ ] `.env.local`이 `.gitignore`에 포함되어 있는지 확인
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 코드에 노출되지 않는지 확인
- [ ] 모든 Supabase 테이블에 RLS가 활성화되어 있는지 확인
- [ ] Cron Job API Route에 `CRON_SECRET` 인증이 구현되어 있는지 확인
- [ ] `NEXT_PUBLIC_` 접두사가 붙은 환경변수에 민감한 정보가 없는지 확인
- [ ] Supabase Dashboard에서 불필요한 API 엔드포인트가 비활성화되어 있는지 확인
- [ ] Vercel 환경변수가 환경별로 올바르게 분리되어 있는지 확인
- [ ] 프로덕션 Supabase 프로젝트의 Database Password가 충분히 강력한지 확인

# 프로젝트 아키텍처 문서 (Book Village)

Next.js App Router 기반 아파트 스마트 작은도서관 관리 시스템의 전체 기술 아키텍처.

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 14+ (App Router) | React Server Components 기반 |
| 데이터베이스 | Supabase (PostgreSQL) | RLS, Realtime, Auth 포함 |
| 인증 | Supabase Auth | 커스텀 phone+PIN 방식 |
| 배포 | Vercel | Edge/Serverless Functions |
| 스타일링 | Tailwind CSS | 모바일 우선 반응형 |
| 폼 검증 | Zod | Server Actions 입력 검증 |
| 외부 API | 카카오 도서 검색, 카카오 알림톡 | 서버 사이드 호출 |

## 디렉토리 구조

```
bookvillage/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 루트 레이아웃
│   ├── page.tsx                  # 홈 (→ /books 리다이렉트)
│   ├── globals.css               # 글로벌 스타일
│   │
│   ├── (auth)/                   # 인증 관련 라우트 그룹
│   │   ├── layout.tsx            # 인증 페이지 레이아웃 (로고, 최소 UI)
│   │   ├── login/
│   │   │   └── page.tsx          # 로그인 페이지
│   │   └── signup/
│   │       └── page.tsx          # 회원가입 페이지
│   │
│   ├── (main)/                   # 주민용 메인 라우트 그룹
│   │   ├── layout.tsx            # 메인 레이아웃 (네비게이션 바)
│   │   ├── books/
│   │   │   ├── page.tsx          # 도서 목록/검색
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 도서 상세
│   │   └── mypage/
│   │       ├── page.tsx          # 내 서재 (대출 현황)
│   │       ├── quiz/
│   │       │   └── [bookId]/
│   │       │       └── page.tsx  # 퀴즈 풀기
│   │       └── report/
│   │           └── [bookId]/
│   │               └── page.tsx  # 독서록 작성
│   │
│   ├── admin/                    # 관리자 영역
│   │   ├── layout.tsx            # 관리자 레이아웃 (사이드바)
│   │   ├── page.tsx              # 대시보드 (통계)
│   │   ├── books/
│   │   │   └── new/
│   │   │       └── page.tsx      # 도서 등록
│   │   ├── checkout/
│   │   │   └── page.tsx          # 대출 처리
│   │   ├── return/
│   │   │   └── page.tsx          # 반납 처리
│   │   └── manage/
│   │       └── page.tsx          # 퀴즈/연체 관리
│   │
│   ├── actions/                  # Server Actions
│   │   ├── auth.ts
│   │   ├── books.ts
│   │   ├── rentals.ts
│   │   ├── quizzes.ts
│   │   ├── book-reports.ts
│   │   └── admin.ts
│   │
│   └── api/                      # API Routes
│       ├── books/
│       │   └── search/
│       │       └── route.ts      # 카카오 도서 검색 프록시
│       └── cron/
│           └── overdue-notifications/
│               └── route.ts      # 연체 알림 Cron
│
├── components/                   # 재사용 컴포넌트
│   ├── ui/                       # 기본 UI 컴포넌트
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── modal.tsx
│   │   ├── badge.tsx
│   │   └── spinner.tsx
│   ├── book-card.tsx             # 도서 카드
│   ├── book-search.tsx           # 도서 검색 폼
│   ├── barcode-scanner.tsx       # 바코드 스캐너
│   ├── rental-list.tsx           # 대출 목록
│   ├── quiz-form.tsx             # 퀴즈 폼
│   ├── report-form.tsx           # 독서록 폼
│   ├── stat-card.tsx             # 통계 카드
│   └── nav/
│       ├── main-nav.tsx          # 주민용 네비게이션
│       └── admin-sidebar.tsx     # 관리자 사이드바
│
├── lib/                          # 핵심 라이브러리
│   ├── supabase/
│   │   ├── client.ts             # 브라우저용 클라이언트
│   │   ├── server.ts             # 서버 컴포넌트/Actions용 클라이언트
│   │   └── admin.ts              # Service Role 클라이언트 (서버 전용)
│   ├── kakao.ts                  # 카카오 도서 검색 API
│   ├── alimtalk.ts               # 알림톡 발송
│   └── validations.ts            # Zod 스키마 정의
│
├── types/                        # TypeScript 타입 정의
│   └── index.ts                  # DB 모델 타입, API 응답 타입
│
├── middleware.ts                  # Next.js 미들웨어
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── vercel.json                   # Cron Job 설정
```

## 아키텍처 개요

### 데이터 흐름

```
[브라우저] ←→ [Next.js App Router]
                    │
                    ├── Server Components → Supabase (직접 조회)
                    ├── Server Actions → Supabase (데이터 변경)
                    ├── API Routes → 외부 API (카카오, 알림톡)
                    └── Middleware → 인증/권한 체크

[Vercel Cron] → API Route → Supabase + 알림톡 API
```

### React Server Components (RSC) 전략

- **서버 컴포넌트 (기본)**: 데이터 조회가 필요한 모든 페이지. Supabase에서 직접 데이터를 가져와 렌더링.
- **클라이언트 컴포넌트 (`'use client'`)**: 사용자 인터랙션이 필요한 경우에만 사용.
  - 바코드 스캐너 (카메라 접근)
  - 검색 입력 (디바운스)
  - 폼 상태 관리
  - 모달/토스트 알림

### Server Actions vs API Routes

| 구분 | Server Actions | API Routes |
|------|---------------|------------|
| 용도 | 폼 제출, CRUD 작업 | 외부 API 연동, Cron |
| 호출 | `<form action={...}>` 또는 직접 호출 | HTTP 요청 |
| 인증 | 쿠키 기반 자동 | 헤더 기반 수동 |
| 예시 | 로그인, 도서 등록, 대출 처리 | 카카오 검색, 연체 알림 |

## Supabase 클라이언트 구성

### 3가지 클라이언트 용도

```typescript
// 1. 브라우저용 (lib/supabase/client.ts)
// - 클라이언트 컴포넌트에서 실시간 구독 등에 사용
// - anon key 사용, RLS 적용
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 2. 서버용 (lib/supabase/server.ts)
// - 서버 컴포넌트, Server Actions에서 사용
// - 쿠키 기반 인증, RLS 적용
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookieStore 연동 */ } }
  )
}

// 3. 관리용 (lib/supabase/admin.ts)
// - Cron Job, 시스템 작업에서 사용
// - Service Role Key, RLS 우회
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

## 미들웨어 설계

```typescript
// middleware.ts
// 역할: 인증 상태 확인 및 경로별 접근 제어

export async function middleware(request: NextRequest) {
  // 1. Supabase 세션 갱신 (토큰 리프레시)
  // 2. 인증 상태 확인
  // 3. 경로별 접근 제어:
  //    - /login, /signup: 로그인 상태면 /books로 리다이렉트
  //    - /mypage/*: 미인증이면 /login으로 리다이렉트
  //    - /admin/*: admin role이 아니면 /books로 리다이렉트
  //    - /books: 누구나 접근 가능 (비로그인도 조회 가능)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 경로별 접근 권한

| 경로 | 비로그인 | 주민(resident) | 관리자(admin) |
|------|---------|---------------|-------------|
| `/login`, `/signup` | O | 리다이렉트 | 리다이렉트 |
| `/books` | O (조회만) | O | O |
| `/books/[id]` | O (조회만) | O | O |
| `/mypage` | X → /login | O | O |
| `/admin/*` | X → /login | X → /books | O |

## 상태 관리 전략

- **서버 상태**: React Server Components에서 Supabase 직접 조회. 별도 클라이언트 상태 관리 라이브러리 불필요.
- **URL 상태**: 검색어, 필터, 페이지네이션은 URL 검색 파라미터(`searchParams`)로 관리.
- **폼 상태**: React의 `useFormState` + `useFormStatus` 활용.
- **일시적 UI 상태**: `useState`로 모달 열림/닫힘, 토스트 등 처리.

## 외부 API 연동 구조

### 카카오 도서 검색 API

```
[관리자 - 바코드 스캔]
    ↓
[클라이언트] → fetch('/api/books/search?isbn=...')
    ↓
[API Route] → https://dapi.kakao.com/v3/search/book
    ↓
[응답: 도서 정보] → 도서 등록 폼 자동 완성
```

### 카카오 알림톡 (연체 알림)

```
[Vercel Cron - 매일 09:00 KST]
    ↓
[API Route] → Supabase에서 연체 목록 조회
    ↓
[연체 7일/30일 해당자 필터링]
    ↓
[솔라피/알리고 API] → 알림톡 발송
    ↓
[Supabase] → 발송 이력 기록
```

## 에러 처리 전략

- **Server Actions**: `ActionResult<T>` 타입으로 통일. `success: false`일 때 `error` 메시지 포함.
- **API Routes**: HTTP 상태 코드 + JSON 에러 메시지.
- **클라이언트**: 토스트(toast) 알림으로 사용자에게 피드백.
- **서버 컴포넌트**: `error.tsx` 바운더리로 에러 처리. `not-found.tsx`로 404 처리.

## 보안 고려사항

1. **RLS (Row Level Security)**: 모든 테이블에 RLS 정책 적용. 사용자는 자신의 데이터만 수정 가능.
2. **Server Actions 권한 체크**: 관리자 전용 Action에서 role 확인 후 처리.
3. **API Key 보호**: 카카오 API 키, 알림톡 키는 서버에서만 사용 (환경변수).
4. **입력 검증**: Zod 스키마로 Server Actions 입력값 서버 사이드 검증.
5. **CSRF 보호**: Next.js Server Actions의 내장 CSRF 보호 활용.
6. **Rate Limiting**: API Routes에 기본적인 요청 제한 적용.

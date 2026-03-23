# 프로젝트 아키텍처 문서 (Book Village)

Next.js App Router 기반 아파트 스마트 작은도서관 관리 시스템의 전체 기술 아키텍처.

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | React Server Components 기반 |
| 데이터베이스 | Supabase (PostgreSQL) | RLS, Auth 포함 |
| 인증 | Supabase Auth | 주민: phone+PIN / 관리자: username+password |
| 배포 | Vercel (서울 리전 icn1) | Production + Dev 분리 |
| 스타일링 | Tailwind CSS 4 + shadcn/ui | Yellow 테마, Pretendard 폰트 |
| 폼 검증 | Zod | Server Actions 입력 검증 |
| 외부 API | 카카오 도서 검색 API | ISBN 기반 도서 정보 자동 완성 |
| 바코드 | html5-qrcode | 카메라 바코드 스캔 |

## 디렉토리 구조

```
bookvillage/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 루트 레이아웃 (Pretendard 폰트)
│   │   ├── globals.css                   # Yellow 테마 (oklch)
│   │   ├── page.tsx                      # 홈 (→ /rent 리다이렉트)
│   │   ├── fonts/
│   │   │   └── PretendardVariable.woff2  # 한글 Variable 폰트
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx                  # 로그인 (퍼널형 회원가입 포함)
│   │   │
│   │   ├── (resident)/                   # 주민용 라우트 그룹
│   │   │   ├── layout.tsx                # BottomNav + AutoLogout
│   │   │   ├── rent/
│   │   │   │   └── page.tsx              # 대여하기 (바코드 스캔 + 셀프 대출)
│   │   │   ├── books/
│   │   │   │   ├── page.tsx              # 도서 검색 목록
│   │   │   │   ├── books-client.tsx      # 클라이언트 검색/필터 UI
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx          # 도서 상세 (SSR)
│   │   │   │       └── book-detail-client.tsx
│   │   │   ├── mypage/
│   │   │   │   └── page.tsx              # 내 서재 (대출현황, 퀴즈, 독서록, 알림)
│   │   │   └── market/
│   │   │       └── page.tsx              # 중고장터 (독립 URL)
│   │   │
│   │   ├── admin/
│   │   │   ├── (auth)/                   # 관리자 인증 라우트 그룹
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   └── (dashboard)/              # 관리자 대시보드 라우트 그룹
│   │   │       ├── layout.tsx            # AdminSidebar 포함
│   │   │       ├── admin-sidebar.tsx     # 반응형 사이드바 (auto-collapse)
│   │   │       ├── page.tsx              # 대시보드 (통계)
│   │   │       ├── books/
│   │   │       │   ├── page.tsx          # 전체 도서 목록
│   │   │       │   ├── [id]/page.tsx     # 도서 상세 + 대출 이력
│   │   │       │   ├── new/
│   │   │       │   │   ├── page.tsx      # 도서 등록 (서가 관리)
│   │   │       │   │   ├── shelf-grid.tsx
│   │   │       │   │   └── mobile-register.tsx
│   │   │       │   └── shelf/
│   │   │       │       └── [shelfName]/page.tsx  # 서재별 도서 목록
│   │   │       ├── rentals/page.tsx      # 대여중 도서 목록
│   │   │       ├── checkout/page.tsx     # 대출 처리
│   │   │       ├── return/page.tsx       # 반납 처리
│   │   │       ├── overdue/page.tsx      # 연체 내역
│   │   │       ├── deletions/page.tsx    # 삭제 내역
│   │   │       └── manage/page.tsx       # 퀴즈/연체/관리자/설정 관리
│   │   │
│   │   ├── actions/                      # Server Actions
│   │   │   ├── auth.ts                   # 인증 (주민 + 관리자)
│   │   │   ├── books.ts                  # 도서 CRUD
│   │   │   ├── rentals.ts                # 대출/반납/알림/셀프대출
│   │   │   ├── quizzes.ts                # 퀴즈 CRUD
│   │   │   ├── book-reports.ts           # 독서록
│   │   │   ├── shelves.ts                # 서재 배치 CRUD
│   │   │   ├── settings.ts               # 도서관 설정
│   │   │   ├── stats.ts                  # 통계/연체 목록
│   │   │   └── market.ts                 # 중고장터
│   │   │
│   │   └── api/
│   │       ├── books/search/route.ts     # 카카오 도서 검색 프록시
│   │       └── health/route.ts           # 헬스체크
│   │
│   ├── components/
│   │   ├── bottom-nav.tsx                # 주민 하단 네비 (알림 뱃지 포함)
│   │   ├── auto-logout.tsx               # 자동 로그아웃
│   │   └── ui/                           # shadcn/ui 컴포넌트
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       └── tabs.tsx
│   │
│   ├── lib/
│   │   ├── kakao.ts                      # 카카오 도서 검색 API
│   │   ├── storage.ts                    # Supabase Storage 유틸
│   │   ├── utils.ts                      # cn() 등 공통 유틸
│   │   ├── supabase/
│   │   │   ├── client.ts                 # 브라우저용 클라이언트
│   │   │   ├── server.ts                 # 서버용 클라이언트
│   │   │   ├── admin.ts                  # Service Role 클라이언트
│   │   │   └── middleware.ts             # 세션 갱신 + 경로 보호
│   │   └── validations/
│   │       ├── auth.ts                   # 인증 스키마
│   │       └── books.ts                  # 도서/대출 스키마
│   │
│   ├── types/
│   │   ├── index.ts                      # 공통 타입 export
│   │   └── supabase.ts                   # DB 테이블 타입 정의
│   │
│   └── middleware.ts                     # Next.js 미들웨어 진입점
│
├── supabase/
│   └── migrations/                       # 00001 ~ 00014
│
├── .vercel-prod/                         # Production Vercel 설정
├── .vercel-dev/                          # Dev Vercel 설정
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 아키텍처 개요

### 데이터 흐름

```
[브라우저] ←→ [Next.js App Router]
                    │
                    ├── useTransition + Server Actions → Supabase (데이터 조회/변경)
                    ├── API Routes → 외부 API (카카오 도서 검색)
                    └── Middleware → 인증/권한 체크 + 세션 갱신
```

### 상태 관리 전략

- **서버 상태**: `useTransition` + Server Actions로 데이터 페칭. React Query 미사용.
- **URL 상태**: 검색어, 필터, 페이지네이션은 URL searchParams 관리
- **폼 상태**: `useState` + `useTransition`으로 로딩/에러 상태 관리
- **UI 상태**: `useState`로 모달, 탭, 토스트 등 관리

### 인증 구조

| 유형 | 이메일 변환 | 비밀번호 패딩 |
|------|------------|-------------|
| 주민 | `{phone}@bookvillage.local` | `bv{pin}!!` (4자리 → 6자리) |
| 관리자 | `{username}@admin.bookvillage.local` | 일반 비밀번호 |

- `supabaseAdmin.auth.admin.createUser` → 직접 `profiles` insert (트리거 제거됨)
- 관리자 가입: `pending` → 기존 관리자 승인 → `approved`

### 미들웨어 경로 보호

| 경로 | 비로그인 | 주민 | 관리자 |
|------|---------|------|-------|
| `/login` | O | → /rent | → /rent |
| `/rent`, `/books` | O | O | O |
| `/mypage` | → /login | O | O |
| `/admin/login` | O | O | 관리자면 → /admin |
| `/admin/register` | O | O | O |
| `/admin/*` | → /admin/login | → /admin/login | O |

## UI/UX 설계 원칙

### 주민 영역 (모바일/태블릿 최적화)
- `h-dvh` 전체 화면 레이아웃
- `clamp()` 기반 반응형 텍스트/버튼 사이즈
- 하단 3탭 네비: 도서 | 대여하기(가운데 돌출 원형) | 내 서재
- 바코드 스캔 → 셀프 대출 퍼널 (주의사항 고지 → 확인)

### 관리자 영역 (데스크톱/태블릿 최적화)
- 좌측 고정 사이드바 (모바일: 버거 드로어)
- 서재관리 페이지: 사이드바 auto-collapse → 좁은 아이콘 바
- 구분선 있는 메뉴 그룹: 도서관리 | 대출/반납 | 연체/삭제 | 관리
- `text-base md:text-lg` 기본 폰트 크기

### 테마
- **Yellow 테마** (oklch 컬러 스페이스)
- Primary: `oklch(0.735 0.175 75)` (light) / `oklch(0.795 0.185 80)` (dark)
- Pretendard Variable 한글 폰트

## 보안

1. **RLS**: 모든 테이블에 Row Level Security 정책 적용
2. **Server Actions 권한 체크**: `getCurrentUser()` → role 확인 후 처리
3. **API Key 보호**: 카카오 API 키는 서버에서만 사용 (API Route 프록시)
4. **입력 검증**: Zod 스키마로 Server Actions 입력값 서버 사이드 검증
5. **CSRF 보호**: Next.js Server Actions 내장 CSRF 보호

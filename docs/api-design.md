# API 설계 문서 (Book Village)

Next.js App Router 기반 Server Actions 및 API Routes 설계 문서.

## 목차

1. [인증 (Auth)](#1-인증-auth)
2. [도서 (Books)](#2-도서-books)
3. [대출/반납 (Rentals)](#3-대출반납-rentals)
4. [퀴즈 (Quizzes)](#4-퀴즈-quizzes)
5. [독서록 (Book Reports)](#5-독서록-book-reports)
6. [카카오 도서 검색 (External API)](#6-카카오-도서-검색-external-api)
7. [관리자 통계 (Admin Statistics)](#7-관리자-통계-admin-statistics)
8. [알림톡 (Notifications)](#8-알림톡-notifications)

## 공통 사항

### 기술 스택

- **Server Actions**: 폼 제출, 데이터 변경(mutation) 작업에 사용
- **API Routes** (`app/api/`): 외부 API 연동, webhook, cron job 등에 사용
- **Supabase Client**: 서버 컴포넌트에서 직접 데이터 조회

### 인증 방식

- Supabase Auth를 사용하되, 커스텀 phone + PIN 인증 구현
- 인증된 요청은 Supabase의 JWT 토큰을 쿠키에 저장하여 처리
- RLS(Row Level Security)로 데이터 접근 제어

### 에러 응답 공통 형식

```typescript
type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

### 역할(Role)

- `resident`: 일반 주민 (기본값)
- `admin`: 관리자/사서

---

## 1. 인증 (Auth)

### 1.1 회원가입

**Server Action**: `signUp`

```typescript
// app/actions/auth.ts
'use server'

async function signUp(formData: FormData): Promise<ActionResult>

// 입력
{
  phone_number: string;  // 010XXXXXXXX (하이픈 없이 11자리)
  pin: string;           // 4자리 숫자
  name: string;          // 실명
  dong_ho: string;       // "101동 202호" 형식
}

// 성공 응답
{ success: true }

// 실패 응답
{ success: false, error: "이미 가입된 휴대폰 번호입니다." }
{ success: false, error: "유효하지 않은 휴대폰 번호 형식입니다." }
```

**검증 규칙**:
- `phone_number`: 정규식 `/^01[016789]\d{7,8}$/`
- `pin`: 정규식 `/^\d{4}$/`
- `name`: 1~20자
- `dong_ho`: 1~20자

### 1.2 로그인

**Server Action**: `signIn`

```typescript
async function signIn(formData: FormData): Promise<ActionResult>

// 입력
{
  phone_number: string;
  pin: string;
}

// 성공 응답 (쿠키에 세션 토큰 설정)
{ success: true }

// 실패 응답
{ success: false, error: "휴대폰 번호 또는 비밀번호가 올바르지 않습니다." }
```

**구현 방식**:
- Supabase Auth의 `signInWithPassword` 사용
- email 필드에 `{phone_number}@bookvillage.local` 형태로 변환하여 저장
- password 필드에 PIN 사용

### 1.3 로그아웃

**Server Action**: `signOut`

```typescript
async function signOut(): Promise<void>
```

- 세션 쿠키 삭제 및 Supabase Auth 로그아웃 처리
- `/login` 페이지로 리다이렉트

### 1.4 현재 사용자 조회

**서버 컴포넌트에서 직접 호출**:

```typescript
// lib/supabase/server.ts
async function getCurrentUser(): Promise<Profile | null>

// 반환
{
  id: string;
  phone_number: string;
  name: string;
  dong_ho: string;
  role: 'resident' | 'admin';
}
```

---

## 2. 도서 (Books)

### 2.1 도서 목록 조회

**서버 컴포넌트에서 직접 Supabase 조회**

```typescript
// 경로: /books 페이지의 서버 컴포넌트

// 쿼리 파라미터
{
  q?: string;           // 검색어 (제목, 저자)
  available?: boolean;  // 대출 가능 여부 필터
  page?: number;        // 페이지 번호 (기본값: 1)
  limit?: number;       // 페이지당 항목 수 (기본값: 20)
}

// 반환
{
  books: Book[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

// Book 타입
{
  id: string;
  barcode: string;
  title: string;
  author: string;
  cover_image: string | null;
  location_group: string;
  location_detail: string;
  is_available: boolean;
  created_at: string;
}
```

### 2.2 도서 상세 조회

**서버 컴포넌트에서 직접 Supabase 조회**

```typescript
// 경로: /books/[id] 페이지의 서버 컴포넌트

// 반환
{
  ...Book;
  rental_history: {
    rented_at: string;
    returned_at: string | null;
  }[];
  quizzes: { id: string; question: string }[];
  avg_rating: number | null;
}
```

### 2.3 도서 등록 (관리자)

**Server Action**: `createBook`

```typescript
// app/actions/books.ts
'use server'

async function createBook(formData: FormData): Promise<ActionResult<Book>>

// 입력
{
  barcode: string;         // ISBN 또는 자체 바코드
  title: string;
  author: string;
  cover_image?: string;    // 카카오 API에서 가져온 URL
  publisher?: string;
  location_group: string;  // 서가 그룹 (예: "어린이 코너")
  location_detail: string; // 서가 상세 (예: "A-3")
}

// 성공 응답
{ success: true, data: Book }

// 실패 응답
{ success: false, error: "이미 등록된 바코드입니다." }
{ success: false, error: "권한이 없습니다." }
```

**검증 규칙**:
- `barcode`: 필수, 고유값
- `title`: 필수, 1~200자
- `author`: 필수, 1~100자
- `location_group`, `location_detail`: 필수

### 2.4 도서 수정 (관리자)

**Server Action**: `updateBook`

```typescript
async function updateBook(bookId: string, formData: FormData): Promise<ActionResult<Book>>

// 입력 (변경하려는 필드만)
{
  title?: string;
  author?: string;
  cover_image?: string;
  location_group?: string;
  location_detail?: string;
}
```

### 2.5 도서 삭제 (관리자)

**Server Action**: `deleteBook`

```typescript
async function deleteBook(bookId: string): Promise<ActionResult>
```

- 현재 대출 중인 도서는 삭제 불가
- 대출 이력이 있는 도서는 soft delete (is_deleted 플래그)

---

## 3. 대출/반납 (Rentals)

### 3.1 대출 처리 (관리자)

**Server Action**: `checkoutBook`

```typescript
// app/actions/rentals.ts
'use server'

async function checkoutBook(formData: FormData): Promise<ActionResult<Rental>>

// 입력
{
  user_id: string;   // 대출할 주민 ID
  barcode: string;   // 도서 바코드 (스캔)
}

// 성공 응답
{
  success: true,
  data: {
    id: string;
    book: { title: string; barcode: string };
    user: { name: string; dong_ho: string };
    rented_at: string;
    due_date: string;     // 대출일 + 14일
  }
}

// 실패 응답
{ success: false, error: "이미 대출 중인 도서입니다." }
{ success: false, error: "존재하지 않는 바코드입니다." }
{ success: false, error: "해당 주민의 연체 도서가 있어 대출이 불가합니다." }
```

**비즈니스 규칙**:
- 대출 기간: 14일
- 연체 도서가 있는 주민은 추가 대출 불가
- 1인당 최대 동시 대출 권수: 5권

### 3.2 반납 처리 (관리자)

**Server Action**: `returnBook`

```typescript
async function returnBook(formData: FormData): Promise<ActionResult<ReturnResult>>

// 입력
{
  barcode: string;  // 도서 바코드 (스캔)
}

// 성공 응답
{
  success: true,
  data: {
    book: { title: string; barcode: string };
    user: { name: string };
    location_group: string;    // 꽂아야 할 서가 그룹
    location_detail: string;   // 꽂아야 할 서가 상세 위치
    was_overdue: boolean;
    overdue_days: number;
  }
}

// 실패 응답
{ success: false, error: "대출 기록이 없는 도서입니다." }
```

### 3.3 내 대출 현황 조회

**서버 컴포넌트에서 직접 Supabase 조회**

```typescript
// 경로: /mypage 페이지의 서버 컴포넌트

// 반환
{
  active_rentals: {
    id: string;
    book: { id: string; title: string; author: string; cover_image: string | null };
    rented_at: string;
    due_date: string;
    is_overdue: boolean;
    remaining_days: number;
  }[];
  past_rentals: {
    id: string;
    book: { id: string; title: string; author: string; cover_image: string | null };
    rented_at: string;
    returned_at: string;
    has_quiz: boolean;
    has_report: boolean;
  }[];
}
```

### 3.4 주민 검색 (관리자 - 대출 처리용)

**Server Action**: `searchResidents`

```typescript
async function searchResidents(query: string): Promise<ActionResult<Profile[]>>

// query: 이름 또는 동호수로 검색
// 반환
{
  success: true,
  data: [
    { id: string; name: string; dong_ho: string; phone_number: string }
  ]
}
```

---

## 4. 퀴즈 (Quizzes)

### 4.1 퀴즈 등록 (관리자)

**Server Action**: `createQuiz`

```typescript
// app/actions/quizzes.ts
'use server'

async function createQuiz(formData: FormData): Promise<ActionResult<Quiz>>

// 입력
{
  book_id: string;
  question: string;               // 퀴즈 질문
  options: string[];              // 선택지 (4개)
  answer: number;                 // 정답 인덱스 (0~3)
}

// 성공 응답
{ success: true, data: Quiz }
```

### 4.2 퀴즈 풀기

**Server Action**: `submitQuizAnswer`

```typescript
async function submitQuizAnswer(formData: FormData): Promise<ActionResult<QuizResult>>

// 입력
{
  quiz_id: string;
  selected_answer: number;  // 선택한 답 인덱스
}

// 성공 응답
{
  success: true,
  data: {
    is_correct: boolean;
    correct_answer: number;
    message: string;
  }
}

// 실패 응답
{ success: false, error: "해당 도서를 반납한 이력이 없습니다." }
{ success: false, error: "이미 풀었던 퀴즈입니다." }
```

**비즈니스 규칙**:
- 해당 도서를 정상 반납 완료한 주민만 퀴즈 풀기 가능
- 퀴즈는 1회만 풀 수 있음

### 4.3 도서별 퀴즈 목록 조회

**서버 컴포넌트에서 직접 Supabase 조회**

```typescript
// 반환
{
  quizzes: {
    id: string;
    question: string;
    options: string[];
    is_solved: boolean;    // 현재 사용자 기준
  }[];
}
```

---

## 5. 독서록 (Book Reports)

### 5.1 독서록 작성

**Server Action**: `createBookReport`

```typescript
// app/actions/book-reports.ts
'use server'

async function createBookReport(formData: FormData): Promise<ActionResult<BookReport>>

// 입력
{
  book_id: string;
  rating: number;     // 1~5
  review: string;     // 독서록 내용 (10~2000자)
}

// 성공 응답
{ success: true, data: BookReport }

// 실패 응답
{ success: false, error: "해당 도서를 반납한 이력이 없습니다." }
{ success: false, error: "이미 독서록을 작성하셨습니다." }
```

**비즈니스 규칙**:
- 해당 도서를 정상 반납 완료한 주민만 독서록 작성 가능
- 도서 1권당 1개의 독서록만 작성 가능

### 5.2 독서록 수정

**Server Action**: `updateBookReport`

```typescript
async function updateBookReport(reportId: string, formData: FormData): Promise<ActionResult<BookReport>>

// 입력
{
  rating?: number;
  review?: string;
}
```

### 5.3 독서록 삭제

**Server Action**: `deleteBookReport`

```typescript
async function deleteBookReport(reportId: string): Promise<ActionResult>
```

### 5.4 도서별 독서록 목록 조회

**서버 컴포넌트에서 직접 Supabase 조회**

```typescript
// 반환
{
  reports: {
    id: string;
    user: { name: string; dong_ho: string };
    rating: number;
    review: string;
    created_at: string;
  }[];
  avg_rating: number | null;
  total_count: number;
}
```

---

## 6. 카카오 도서 검색 (External API)

### 6.1 ISBN으로 도서 정보 검색

**API Route**: `GET /api/books/search`

```typescript
// app/api/books/search/route.ts

// 쿼리 파라미터
{
  isbn: string;  // ISBN 바코드 번호
}

// 성공 응답 (200)
{
  title: string;
  author: string;
  publisher: string;
  cover_image: string;
  isbn: string;
  description: string;
}

// 실패 응답 (404)
{ error: "도서 정보를 찾을 수 없습니다." }

// 실패 응답 (500)
{ error: "카카오 API 연동 중 오류가 발생했습니다." }
```

**구현 세부사항**:
- 카카오 도서 검색 API: `GET https://dapi.kakao.com/v3/search/book`
- 헤더: `Authorization: KakaoAK {REST_API_KEY}`
- 쿼리: `?query={isbn}&target=isbn`
- API Route로 구현하여 카카오 API 키를 서버에서만 사용
- 관리자 권한 체크 필요

---

## 7. 관리자 통계 (Admin Statistics)

### 7.1 대시보드 통계 조회

**서버 컴포넌트에서 직접 Supabase 조회 (관리자 전용)**

```typescript
// 경로: /admin 페이지의 서버 컴포넌트

// 쿼리 파라미터
{
  start_date: string;  // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD
}

// 반환
{
  summary: {
    total_rentals: number;        // 기간 내 총 대출 수
    total_returns: number;        // 기간 내 총 반납 수
    active_rentals: number;       // 현재 대출 중인 도서 수
    overdue_count: number;        // 현재 연체 중인 도서 수
    new_members: number;          // 기간 내 신규 가입자 수
  };
  top_readers: {
    user: { name: string; dong_ho: string };
    rental_count: number;
  }[];                            // 다독왕 TOP 10
  popular_books: {
    book: { title: string; author: string; cover_image: string | null };
    rental_count: number;
  }[];                            // 인기 도서 TOP 10
  top_reviewers: {
    user: { name: string; dong_ho: string };
    report_count: number;
  }[];                            // 우수 독서록 작성자 TOP 10
}
```

### 7.2 연체 목록 조회 (관리자)

**서버 컴포넌트에서 직접 Supabase 조회**

```typescript
// 경로: /admin/manage 페이지

// 반환
{
  overdue_rentals: {
    id: string;
    book: { title: string; barcode: string };
    user: { name: string; dong_ho: string; phone_number: string };
    rented_at: string;
    due_date: string;
    overdue_days: number;
    notification_sent: boolean;   // 알림톡 발송 여부
  }[];
}
```

---

## 8. 알림톡 (Notifications)

### 8.1 연체 알림 자동 발송

**API Route (Cron)**: `GET /api/cron/overdue-notifications`

```typescript
// app/api/cron/overdue-notifications/route.ts

// Vercel Cron Job으로 매일 09:00에 실행
// vercel.json:
// { "crons": [{ "path": "/api/cron/overdue-notifications", "schedule": "0 0 * * *" }] }

// 헤더 (Vercel Cron 인증)
{
  Authorization: "Bearer {CRON_SECRET}"
}

// 성공 응답 (200)
{
  sent_count: number;
  details: {
    user_name: string;
    book_title: string;
    overdue_days: number;
    notification_type: '7day' | '30day';
  }[];
}
```

**비즈니스 규칙**:
- 연체 7일차: 1차 알림 (정중한 반납 안내)
- 연체 30일차: 2차 알림 (강한 반납 요청)
- 동일 단계 알림은 1회만 발송

### 8.2 수동 알림 발송 (관리자)

**Server Action**: `sendOverdueNotification`

```typescript
async function sendOverdueNotification(rentalId: string): Promise<ActionResult>

// 성공 응답
{ success: true }

// 실패 응답
{ success: false, error: "알림톡 발송에 실패했습니다." }
```

**카카오 알림톡 연동**:
- 솔라피(Solapi) 또는 알리고(Aligo) API 사용
- 환경변수: `ALIMTALK_API_KEY`, `ALIMTALK_SENDER_KEY`
- 템플릿 사전 등록 필요

---

## 파일 구조

```
app/
  actions/
    auth.ts            # 인증 관련 Server Actions
    books.ts           # 도서 관련 Server Actions
    rentals.ts         # 대출/반납 Server Actions
    quizzes.ts         # 퀴즈 Server Actions
    book-reports.ts    # 독서록 Server Actions
    admin.ts           # 관리자 전용 Server Actions
  api/
    books/
      search/
        route.ts       # 카카오 도서 검색 API 프록시
    cron/
      overdue-notifications/
        route.ts       # 연체 알림 Cron Job
lib/
  supabase/
    client.ts          # 브라우저용 Supabase 클라이언트
    server.ts          # 서버용 Supabase 클라이언트
    admin.ts           # 서비스 키용 Supabase 클라이언트
  kakao.ts             # 카카오 API 유틸리티
  alimtalk.ts          # 알림톡 API 유틸리티
  validations.ts       # 입력 검증 스키마 (zod)
types/
  index.ts             # 공통 타입 정의
```

---

## 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 카카오 API
KAKAO_REST_API_KEY=

# 알림톡 (솔라피 또는 알리고)
ALIMTALK_API_KEY=
ALIMTALK_SENDER_KEY=
ALIMTALK_PFID=

# Vercel Cron
CRON_SECRET=
```

# API 설계 문서 (Book Village)

Server Actions 및 API Routes 설계 문서. 실제 구현 기준.

## 공통 사항

### 에러 응답 형식

```typescript
type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

### 인증 방식

- Supabase Auth (커스텀 phone+PIN / username+password)
- 서버 쿠키 기반 세션 + RLS
- 관리자 전용 Action: `getCurrentUser()` → `role === 'admin'` 체크

---

## Server Actions

### auth.ts - 인증

| 함수 | 설명 | 권한 |
|------|------|------|
| `signUp(formData)` | 주민 회원가입 (이름, 폰, 동호수, PIN) | 공개 |
| `signIn(formData)` | 주민 로그인 (폰번호 + PIN) | 공개 |
| `signOut()` | 로그아웃 → /login 리다이렉트 | 인증 |
| `getCurrentUser()` | 현재 사용자 프로필 조회 | 인증 |
| `adminSignIn(formData)` | 관리자 로그인 (username + password) | 공개 |
| `adminSignUp(formData)` | 관리자 가입 신청 (pending 상태) | 공개 |
| `adminSignOut()` | 관리자 로그아웃 → /admin/login | 관리자 |

### books.ts - 도서

| 함수 | 설명 | 권한 |
|------|------|------|
| `searchBooks(query, filters)` | 도서 검색 (제목/저자, 대출가능 필터) | 공개 |
| `getBookDetail(id)` | 도서 상세 정보 | 공개 |
| `createBook(formData)` | 도서 등록 (카카오 API 정보 포함) | 관리자 |
| `updateBook(id, formData)` | 도서 정보 수정 | 관리자 |
| `deleteBook(id)` | 도서 삭제 (soft delete + 감사 로그) | 관리자 |
| `checkBarcodeExists(barcode)` | 바코드 중복 확인 | 관리자 |

### rentals.ts - 대출/반납/알림

| 함수 | 설명 | 권한 |
|------|------|------|
| `checkoutBook(formData)` | 관리자 대출 처리 (주민 선택 → 도서 스캔) | 관리자 |
| `returnBook(formData)` | 반납 처리 (바코드 → 즉시 반납 + 서가 위치) | 관리자 |
| `selfCheckout(barcode)` | 주민 셀프 대출 (연체/권수 체크 포함) | 인증 |
| `getMyRentals()` | 내 대출 현황 (대출 중 + 반납 완료) | 인증 |
| `lookupBookByBarcode(barcode)` | 바코드로 도서 정보 조회 | 인증 |
| `getActiveRentals()` | 대여중 도서 목록 | 관리자 |
| `getBookRentals(bookId)` | 도서별 대출 이력 | 관리자 |
| `getMyNotifications()` | 내 알림 목록 (D-3, D-Day, 연체) + 읽음 상태 | 인증 |
| `getMyNotificationCount()` | 미읽은 알림 수 (하단 네비 뱃지) | 인증 |
| `markNotificationsRead()` | 알림 전체 읽기 처리 | 인증 |
| `searchResidents(query)` | 주민 검색 (이름/동호수) | 관리자 |

### quizzes.ts - 퀴즈

| 함수 | 설명 | 권한 |
|------|------|------|
| `createQuiz(formData)` | 퀴즈 등록 | 관리자 |
| `updateQuiz(id, formData)` | 퀴즈 수정 | 관리자 |
| `deleteQuiz(id)` | 퀴즈 삭제 | 관리자 |
| `getQuizzesByBook(bookId)` | 도서별 퀴즈 목록 (풀이 여부 포함) | 인증 |
| `submitQuizAnswer(formData)` | 퀴즈 정답 제출 (1인 1회) | 인증 |

### book-reports.ts - 독서록

| 함수 | 설명 | 권한 |
|------|------|------|
| `createBookReport(formData)` | 독서록 작성 (반납 완료 도서만) | 인증 |
| `getBookReports(bookId)` | 도서별 독서록 목록 | 공개 |

### shelves.ts - 서재 관리

| 함수 | 설명 | 권한 |
|------|------|------|
| `getShelves()` | 서재/라벨 목록 (SVG 미니맵용) | 공개 |
| `createShelf(formData)` | 서재/라벨 추가 | 관리자 |
| `updateShelf(id, formData)` | 서재/라벨 수정 (위치, 크기, 폰트) | 관리자 |
| `deleteShelf(id)` | 서재/라벨 삭제 | 관리자 |

### settings.ts - 도서관 설정

| 함수 | 설명 | 권한 |
|------|------|------|
| `getLibrarySettings()` | 도서관 설정 조회 | 관리자 |
| `updateLibrarySetting(key, value)` | 설정 변경 | 관리자 |

### stats.ts - 통계

| 함수 | 설명 | 권한 |
|------|------|------|
| `getDashboardStats(startDate, endDate)` | 기간별 통계 | 관리자 |
| `getOverdueList()` | 연체 목록 (뷰 활용) | 관리자 |

### market.ts - 중고장터

| 함수 | 설명 | 권한 |
|------|------|------|
| `getMarketItems()` | 장터 목록 | 인증 |
| `createMarketItem(formData)` | 물품 등록 | 인증 |
| `updateMarketItemStatus(id, status)` | 상태 변경 | 인증 |

---

## API Routes

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/books/search?isbn=` | GET | 카카오 도서 검색 API 프록시 (관리자 전용) |
| `/api/health` | GET | 헬스체크 (환경변수 + DB 연결) |

---

## 비즈니스 규칙

### 대출
- 대출 기간: `library_settings.rental_days` (기본 14일), 도서별 `books.rental_days` 오버라이드 가능
- 최대 대출 권수: `library_settings.max_rentals` (기본 5권)
- 연체 도서 있는 주민은 추가 대출 불가
- 대출 시 `books.is_available = false` (DB 트리거)
- 반납 시 `books.is_available = true` (DB 트리거)

### 독서 활동
- 퀴즈: 해당 도서 반납 완료 주민만 풀기 가능, 1인 1회
- 독서록: 해당 도서 반납 완료 주민만 작성 가능, 도서당 1인 1편

### 알림
- 인앱 알림: D-3~D-1(upcoming), D-Day(due_today), 연체(overdue)
- 알림톡: 7일/30일차 자동 발송 (동일 단계 1회만)
- 전체 읽기: `profiles.notifications_read_at` 타임스탬프 기반

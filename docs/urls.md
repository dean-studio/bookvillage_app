# 접속 주소 및 환경 정보


## 페이지별 경로

### 주민 영역 (태블릿 반응형, clamp() 큰 터치 UI)

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 로그인 | `/login` | 휴대폰번호 + PIN 로그인 / 퍼널형 회원가입 (이름→폰→동→호→PIN) |
| 대여하기 | `/rent` | 바코드 스캔/수동입력 → 도서 조회 → 셀프 대출 (주의사항 퍼널) |
| 도서 검색 | `/books` | 검색, 필터(대출가능), SVG 서가 미니맵 |
| 도서 상세 | `/books/[id]` | 도서 정보, 서가 위치, 독서록, SVG 미니맵 |
| 내 서재 | `/mypage` | 대출현황, 반납 완료, 알림(D-3~연체) 탭, 퀴즈 풀기, 독서록 작성 |

### 중고장터 (독립 URL, 기본 크기 UI)

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 중고장터 | `/market` | 물품 목록, 등록, 상태 변경 (하단 네비 미포함) |

### 관리자 영역 (기본 크기 UI, text-base md:text-lg)

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 관리자 로그인 | `/admin/login` | 아이디 + 비밀번호 로그인 |
| 관리자 가입 신청 | `/admin/register` | 가입 후 기존 관리자 승인 필요 |
| 대시보드 | `/admin` | 기간별 통계, 다독왕, 인기 도서, 연체 현황 |
| 전체 도서 | `/admin/books` | 전체 도서 목록 (검색, 클릭 → 상세) |
| 도서 상세 | `/admin/books/[id]` | 도서 정보 + 대출 이력 |
| 도서 등록/서재 관리 | `/admin/books/new` | 바코드 스캔 → 카카오 API 자동완성 → SVG 서가 배치 |
| 서재별 도서 | `/admin/books/shelf/[shelfName]` | 특정 서재의 도서 목록 + 등록 |
| 대여중 도서 | `/admin/rentals` | 현재 대출 중인 도서 목록 (D-day 표시) |
| 대출 처리 | `/admin/checkout` | 주민 검색 → 도서 스캔 → 대출 |
| 반납 처리 | `/admin/return` | 도서 스캔 → 반납 → 서가 위치 안내 |
| 연체 내역 | `/admin/overdue` | 연체 도서 목록 (7일/30일 알림 발송 상태) |
| 삭제 내역 | `/admin/deletions` | 삭제된 도서 감사 로그 |
| 관리 | `/admin/manage` | 퀴즈 등록, 연체 알림, 관리자 승인, 도서관 설정 |

### 관리자 사이드바 메뉴 구성

```
대시보드
전체 도서
대여중 도서
도서 등록
대출
반납
──────────
연체 내역
삭제 내역
──────────
관리
```

### API 엔드포인트

| 경로 | 설명 |
|------|------|
| `/api/health` | 헬스체크 (환경변수 + DB 연결 확인) |
| `/api/books/search?isbn=` | 카카오 도서 검색 API (관리자 전용) |

## 배포 방법

```bash
# Dev 배포
cp -r .vercel-dev .vercel && npx vercel --prod

# Production 배포
cp -r .vercel-prod .vercel && npx vercel --prod
```


```bash
# 마이그레이션 적용
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db push -p "비밀번호" <<< "Y"

# SQL 직접 실행
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db query --linked "SQL문"
```


## 인증 구조

- **주민**: 휴대폰번호 → `{phone}@bookvillage.local`, PIN 4자리 → `bv{pin}!!` 패딩
- **관리자**: 아이디 → `{username}@admin.bookvillage.local`, 일반 비밀번호
- handle_new_user 트리거 제거 → 코드에서 직접 profiles insert
- 관리자 가입: pending → approved (기존 관리자 승인)

## 하단 네비게이션 (주민)

```
[ 도서 ]   [ 대여하기 ]   [ 내 서재 ]
             (원형 돌출)     (알림 뱃지)
```

- 대여하기: 가운데 돌출 원형 버튼, 바코드 아이콘 pulse 애니메이션
- 내 서재: 미읽은 알림 있을 때 빨간 숫자 뱃지

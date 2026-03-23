# 책빌리지 (Book Village)

> 관리비 0원으로 운영하는 스마트 작은도서관 관리 시스템

![img.png](img.png)

## 만든 이유

아이를 키우는 아빠로서 동네 작은도서관을 자주 이용합니다. 그런데 관리할 사람이 없어 문을 닫거나 운영을 중단하는 곳이 점점 많아지고 있었습니다.

디지털 시대에 아날로그로 운영되는 도서관은 사서(자원봉사자)에게 큰 부담이 됩니다. 수기 장부나 엑셀로 대출/반납을 기록하고, 연체를 관리하고, 도서를 정리하는 일은 꾸준히 누군가의 시간과 노력을 요구합니다. 그래서 포기하게 되는 것이죠.

하지만 아이들에게 도서관은 특별한 공간입니다. 책을 만지고, 고르고, 읽는 경험은 어떤 디지털 콘텐츠로도 대체할 수 없습니다.

그래서 직접 이 시스템을 개발했습니다. **Vercel + Supabase 무료 플랜**으로 **관리비 0원**, 스마트폰만 있으면 누구나 사서가 될 수 있고, 주민은 간편 로그인 후 셀프 대여까지 할 수 있습니다. 관리사무소를 찾아가 직접 소개하고, 지금 실제로 운영 중입니다.

아이들이 책을 더 재밌게 읽을 수 있도록 **독서 퀴즈**와 **젤리 포인트**도 만들었습니다. 책을 빌리고, 반납하고, 퀴즈를 풀고, 독서록을 쓰면 젤리가 쌓입니다. 작은 보상이지만 아이들은 "오늘 젤리 몇 개 모았어!"라며 즐거워합니다.

관리할 사람이 없어서 닫히는 도서관이 하나라도 줄었으면 합니다.

---

**이 프로젝트는 동네 작은 도서관이 더 오래 운영되기를 바라는 마음으로 만들었습니다.**

지금은 실제 도서관에서 운영 중이며, 동네 작은 도서관이나 독립 책방에서도 사용할 수 있습니다. Vercel + Supabase 무료 플랜으로 **운영비 0원**이니 부담 없이 사용하시길 바랍니다. 환경에 맞게 커스터마이징이 필요하시면 언제든 연락 주세요. 직접 수정해 드리겠습니다.

📧 **연락처**: hckim@dean.kr

---

## 주요 기능

### 주민
- **셀프 대여** — 바코드 스캔으로 직접 대출 (별도 앱 설치 불필요)
- **도서 검색** — 제목/저자 검색 + SVG 서가 위치 맵
- **내 서재** — 대여 현황, 반납 이력, 알림, 젤리 잔액
- **독서 퀴즈** — 책 반납 후 퀴즈 풀기 (+3 젤리)
- **독서록** — 별점 + 감상문 작성 (+10 젤리)
- **젤리 포인트** — 대출/반납/독서록/퀴즈 활동 시 자동 지급
- **알림** — 반납 D-3, 당일, 연체 알림 + 미읽은 배지
- **추천 도서** — "이 책을 본 사람이 본 도서"

### 관리자
- **도서 등록** — 바코드 스캔 → 카카오 API 자동 완성 → SVG 서가 배치
- **대출/반납 처리** — 바코드 스캔 + 서가 위치 안내 팝업
- **반납 내역** — 처리자 기록, 연체 여부 표시
- **주민 관리** — 목록, 상세, 젤리 수동 지급/차감
- **랭킹** — 기간별 다독왕/인기도서/독서록/젤리 순위
- **통계 대시보드** — 대출/반납/가입 통계, 연체 현황, 신작
- **연체 관리** — 알림 발송 + 대출 자동 제한
- **설정** — 대출 권수, 기간, 젤리 지급량, 퀴즈, 관리자 승인

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend / Backend | Next.js 16 (App Router, TypeScript) |
| Database / Auth | Supabase (PostgreSQL, 15 테이블 + 2 뷰) |
| UI | shadcn/ui + Tailwind CSS 4 (Yellow 테마) |
| Deployment | Vercel (서울 리전) |
| External API | 카카오 도서 검색 API |
| Barcode | html5-qrcode |

## 시작하기

```bash
git clone https://github.com/your-username/bookvillage.git
cd bookvillage
npm install
cp .env.example .env.local  # 환경변수 설정
npm run dev                  # http://localhost:6100
```

### 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
KAKAO_REST_API_KEY=your_kakao_rest_api_key
```

### 데이터베이스

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 사이트맵

### 주민 (Mobile/Tablet 반응형)

| 경로 | 설명 |
|------|------|
| `/login` | 퍼널형 로그인/회원가입 |
| `/rent` | 대여하기 (바코드 스캔, 인기검색어) |
| `/books` | 도서 검색 + 필터 |
| `/books/[id]` | 도서 상세 (서가 위치, 추천) |
| `/mypage` | 내 서재 메뉴 |
| `/mypage/rentals` | 대여중 도서 |
| `/mypage/returned` | 반납완료 (퀴즈, 독서록) |
| `/mypage/notifications` | 알림 |
| `/mypage/jelly` | 젤리 |

### 관리자 (Tablet/PC)

| 경로 | 설명 |
|------|------|
| `/admin` | 대시보드 |
| `/admin/residents` | 주민 목록 |
| `/admin/residents/[id]` | 주민 상세 |
| `/admin/rankings` | 랭킹 |
| `/admin/books` | 도서 목록 |
| `/admin/books/[id]` | 도서 상세 |
| `/admin/books/new` | 도서 등록 + 서가 관리 |
| `/admin/rentals` | 대여중 도서 |
| `/admin/checkout` | 대출 처리 |
| `/admin/return` | 반납 처리 |
| `/admin/returns` | 반납 내역 |
| `/admin/overdue` | 연체 관리 |
| `/admin/deletions` | 도서 삭제내역 |
| `/admin/manage` | 설정 관리 |

## 문서

상세 기능 안내와 가이드는 [문서 사이트](https://your-username.github.io/bookvillage/)에서 확인할 수 있습니다.

```bash
npm run docs:dev  # 문서 로컬 미리보기
```

## 문서 사이트 로컬 실행

```bash
npm run docs:dev  # http://localhost:6200/bookvillage/
```

## 개발

**딘스튜디오** | [dean.kr](https://dean.kr) | hckim@dean.kr

## 라이선스

MIT

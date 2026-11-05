# AGENTS.md — AI 코딩 도구용 안내

이 파일은 Claude Code, Codex 같은 AI 코딩 도구가 책빌리지 코드를 고칠 때 먼저 읽는 안내서입니다.
사람이 읽어도 전체 구조를 빠르게 파악할 수 있습니다.

## 한 줄 요약

작은도서관(아파트·학교·마을·유치원·학원)용 도서 대출 관리 앱입니다.
**Next.js App Router + Supabase(PostgreSQL) + Vercel**로 만들었고, 화면 문구는 모두 한국어입니다.
하나의 코드로 여러 도서관을 운영하며, 도서관마다 Supabase DB와 Vercel 프로젝트가 따로 있습니다.

## 폴더 구조

| 위치 | 내용 |
|---|---|
| `src/app/(resident)/` | 이용자(주민·학생) 화면: 도서 검색 `books`, 셀프 대여 `rent`, 내 서재 `mypage` |
| `src/app/admin/(dashboard)/` | 관리자 화면. 메뉴는 `admin-sidebar.tsx`, 설정 화면은 `manage/` |
| `src/app/admin/(dashboard)/academy/` | 학원 모드 전용 화면(반별 현황, 일괄 등록, AR 정보 입력, 레벨 라벨) |
| `src/app/actions/` | 서버 액션(`'use server'`). 데이터 읽기·쓰기는 모두 여기서. 기능별 파일(`books.ts`, `rentals.ts`, `academy.ts` …) |
| `src/app/api/` | 외부 조회·헬스체크 등 API 라우트 (`/api/health`, `/api/books/search`) |
| `src/lib/` | 공용 로직. `site-mode.ts`(운영 방식 판별), `ar.ts`(AR 레벨), `kakao.ts`·`openlibrary.ts`(도서 정보 조회), `validations/`(zod 스키마), `supabase/`(클라이언트) |
| `src/components/` | 공용 컴포넌트. `ui/`는 shadcn/ui |
| `src/types/supabase.ts` | DB 타입. **손으로 관리**하므로 컬럼을 추가하면 Row·Insert·Update에 함께 넣는다 |
| `supabase/migrations/` | DB 변경 이력. `00001_…`부터 번호 순서대로 |
| `docs/` | 문서 사이트(VitePress)와 README 이미지 |

## 운영 방식(모드)과 격리 원칙 — 가장 중요

운영 방식은 `library_settings` 테이블의 `site_type` 값으로 정합니다: `apartment`(기본) · `school` · `village` · `kindergarten` · `academy`.
한 모드를 고칠 때 **다른 모드의 화면·동작이 바뀌면 안 됩니다.** 아래 규칙을 지켜 주세요.

1. **모드 판별은 `src/lib/site-mode.ts`의 함수만 씁니다.** `isKindergarten`, `isAcademy`, `allowsKioskReturn`, `allowsLostDelete`, `isFlagOn` 등. 모르는 값이나 빈 값은 `apartment`로 봅니다.
2. **새 코드에서 `site_type !== 'kindergarten'` 같은 부정 비교, `as SiteType` 캐스팅, `default` 없는 `switch`를 쓰지 않습니다.** "유치원이 아니면 아파트"라고 가정하면 새 모드가 생길 때 엉뚱하게 동작합니다.
3. **기능은 모드와 별도로 설정 키로 켭니다.** 예: AR 레벨 정보 `ar_enabled`, 원서 보충 조회 `isbn_fallback`. 비교는 항상 `=== 'on'`처럼 켜진 쪽으로 하고, **키가 없으면 지금과 완전히 같게** 동작해야 합니다.
4. **이용자 화면에서 읽는 설정은 `actions/settings.ts`의 `getPublicSettings` 키 목록에 넣어야 읽힙니다.**
5. **모드 전용 화면은 새 경로로 만들고**, 서버 액션 첫 줄에서 관리자 여부와 모드를 확인합니다(예: `actions/academy.ts`의 `requireAcademyAdmin`). 공용 화면에 무언가를 더할 때는 "모드·설정이 켜져 있고 데이터도 있을 때만" 그립니다.
6. 사이트 유형을 고를 때 한 번에 적용되는 설정 묶음(프리셋)은 `manage/site-type/page.tsx`에 있습니다.

## 데이터베이스 변경

- 새 마이그레이션은 `supabase/migrations/`에 다음 번호로 만듭니다. **추가만** 합니다: `ADD COLUMN IF NOT EXISTS`, NULL 허용 또는 기본값, 필요하면 부분 인덱스. 기존 테이블 구조를 바꾸는 대신 새 테이블을 만들고 RLS 정책을 함께 적습니다(예: `00016`, `00033`).
- 스키마를 바꾼 뒤 `NOTIFY pgrst, 'reload schema';`
- **새 컬럼을 쓰는 코드는 DB에 먼저 적용한 다음 배포합니다.** 순서가 바뀌면 그 화면이 빈 결과가 됩니다. 도서관(DB)이 여러 개라면 모두에 적용합니다.
- `src/types/supabase.ts`, `src/lib/validations/*`, 해당 서버 액션의 허용 필드 목록을 함께 고칩니다.

## 데이터를 다룰 때

- 책장 = `shelves` 테이블, 책의 책장 = `books.location_group`(책장 이름 문자열). 책장 이름을 바꾸면 그 책장 책들의 `location_group`도 같이 바꿉니다(`actions/shelves.ts`의 `updateShelf`).
- 회원의 동·호수·반은 `profiles.dong_ho` 한 칸에 저장합니다(아파트 "101동 1201호", 유치원·학원은 반 이름).
- QR 카드 회원은 `phone_number`가 `M` + 숫자 10자리입니다(`lib/member-card.ts`).
- 여러 건을 한꺼번에 고치는 작업은 대상 수를 먼저 세어 보여 주고, 예상과 다르면 멈춥니다.

## 개발 명령

```bash
npm install
cp .env.example .env.local   # Supabase URL·키, 카카오 REST 키
npm run dev                  # http://localhost:6100
npx tsc --noEmit -p .        # 타입 검사
npx eslint <파일>             # 린트
```

- 화면 파일을 지운 뒤 타입 검사가 `.next/dev/types/validator.ts`에서 실패하면 `rm -rf .next/dev/types`.
- 배포는 Vercel. 배포 후 `/api/health`가 `{"status":"healthy"}`인지 확인합니다.

## 하지 말 것

- 비밀번호·API 키·service role 키를 코드나 문서에 적지 않습니다. 이 저장소는 공개입니다.
- 실제 운영 DB에 테스트 데이터를 남기지 않습니다. 넣었다면 비공개로 넣고 바로 지웁니다.
- 한 모드를 위해 공용 로직(대출·반납·젤리 지급)을 바꿀 때는 다른 모드에서 결과가 같은지 먼저 확인합니다.

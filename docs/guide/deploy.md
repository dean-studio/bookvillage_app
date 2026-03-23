# 설치 & 배포

책빌리지를 직접 설치하고 배포하는 방법입니다.

## 사전 준비

- [Node.js](https://nodejs.org/) 18 이상
- [Supabase](https://supabase.com/) 프로젝트
- [Vercel](https://vercel.com/) 계정
- [카카오 개발자](https://developers.kakao.com/) REST API 키

## 1. 프로젝트 클론

```bash
git clone https://github.com/dean-studio/bookvillage.git
cd bookvillage
npm install
```

## 2. 환경변수 설정

`.env.example`을 복사하여 `.env.local`을 생성합니다.

```bash
cp .env.example .env.local
```

필수 환경변수:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `KAKAO_REST_API_KEY` | 카카오 도서 검색 API 키 |
| `NEXT_PUBLIC_APP_URL` | 앱 URL |

## 3. 데이터베이스 설정

Supabase CLI로 마이그레이션을 적용합니다.

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 4. Supabase Storage 설정

Supabase 대시보드에서 `images` 버킷을 생성합니다 (public).

## 5. 로컬 실행

```bash
npm run dev
```

기본 포트: `http://localhost:3000`

## 6. Vercel 배포

```bash
npx vercel
```

Vercel 대시보드에서 환경변수를 설정한 후 배포합니다.
서울 리전(`icn1`)을 추천합니다.

## 7. 첫 관리자 설정

1. `/admin/register`에서 관리자 가입
2. Supabase 대시보드 → `profiles` 테이블에서 해당 사용자의 `admin_status`를 `approved`로 변경

::: tip 무료 운영
Vercel (Hobby 플랜)과 Supabase (Free 플랜) 모두 무료로 사용 가능합니다.
월 관리비 **0원**으로 도서관을 운영할 수 있습니다.
:::

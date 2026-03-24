---
layout: home
head:
  - - meta
    - name: description
      content: 작은도서관 도서 대여 관리 시스템 - 바코드 스캔 대출/반납, 도서 검색, 연체 관리, 독서 퀴즈, 독서록. 아파트, 학교, 마을 도서관을 위한 무료 오픈소스 도서관 관리 프로그램.
  - - meta
    - name: keywords
      content: 도서관, 작은도서관, 도서관 프로그램, 도서관 관리, 도서 대여, 도서 대출, 도서관 대여 프로그램, 도서관 관리 시스템, 도서관 대출 반납, 바코드 대출, 셀프 대출, 독서 관리, 독서록, 독서 퀴즈, 아파트 도서관, 학교 도서관, 마을 도서관
hero:
  name: 책빌리지
  text: 작은도서관 도서 대여 관리 프로그램
  tagline: 관리비 0원으로 운영하는 도서관 대출/반납 관리 시스템 — 바코드 스캔, 도서 검색, 연체 관리, 독서 퀴즈
  actions:
    - theme: brand
      text: 기능 둘러보기
      link: /features/rent
    - theme: alt
      text: GitHub
      link: https://github.com/dean-studio/bookvillage_app

features:
  - icon: 📱
    title: 셀프 대여
    details: 주민이 직접 바코드를 스캔하여 대출합니다. 별도 앱 설치 없이 모바일 웹에서 바로 이용 가능합니다.
    link: /features/rent
    linkText: 자세히 보기
  - icon: 📚
    title: 스마트 도서 등록
    details: 바코드 스캔 → 카카오 도서 검색 API로 자동 완성. ISBN이 없는 도서도 수동 등록 가능합니다.
    link: /features/admin-books
    linkText: 자세히 보기
  - icon: 🗺️
    title: 책빌리지 서가 맵
    details: 서가 위치를 시각적으로 관리합니다. 반납 시 서가 위치를 팝업으로 안내합니다.
    link: /features/admin-shelves
    linkText: 자세히 보기
  - icon: 🍬
    title: 젤리 포인트
    details: 대출, 반납, 독서록, 퀴즈 활동에 젤리를 지급합니다. 아이들에게 독서의 즐거움을 선물합니다.
    link: /features/jelly
    linkText: 자세히 보기
  - icon: 🏆
    title: 랭킹 & 통계
    details: 다독왕, 인기 도서, 독서록 작성자, 젤리 랭킹을 기간별로 조회합니다.
    link: /features/admin-rankings
    linkText: 자세히 보기
  - icon: 🔔
    title: 연체 알림
    details: 반납 기한 3일 전부터 자동 알림. 연체 시 대출 제한과 알림톡 발송을 지원합니다.
    link: /features/notifications
    linkText: 자세히 보기
  - icon: 🏢
    title: 다양한 기관 지원
    details: 아파트, 학교, 마을 등 다양한 유형의 작은도서관에서 사용할 수 있습니다. 기관 유형에 맞는 주소 체계를 자동 적용합니다.
    link: /features/admin-settings
    linkText: 자세히 보기
  - icon: 🎨
    title: 커스텀 테마
    details: 7가지 컬러 테마 중 선택하여 도서관만의 개성을 표현합니다. 실시간으로 미리보기하며 적용할 수 있습니다.
    link: /features/admin-settings
    linkText: 자세히 보기
---

## 왜 만들었나요?

> *"관리할 사람이 없어서 닫히는 도서관이 하나라도 줄었으면 합니다."*

아이를 키우면서 동네 작은도서관을 자주 찾습니다. 그런데 사람이 없어 문을 닫거나, 운영을 포기하는 곳이 점점 늘어나고 있었습니다.

수기 장부, 엑셀 대장, 수작업 연체 관리... **아날로그 방식의 도서관 운영은 자원봉사자에게 너무 큰 부담**입니다. 결국 지치고, 포기하게 됩니다.

하지만 **아이들에게 도서관은 특별한 공간**입니다. 책을 직접 만지고, 고르고, 읽는 경험은 어떤 디지털 콘텐츠로도 대체할 수 없습니다. 이 공간이 사라지는 건 너무 아까운 일이었습니다.

그래서 직접 만들었습니다.

- **스마트폰 하나면 충분합니다** — 누구나 사서가 될 수 있고, 주민은 셀프 대여까지 가능합니다
- **관리비 0원** — Vercel + Supabase 무료 플랜으로 운영비가 들지 않습니다
- **아이들이 즐거워합니다** — 독서 퀴즈를 풀고, 독서록을 쓰고, 젤리 포인트를 모으며 "오늘 젤리 몇 개 모았어!" 하고 좋아합니다

::: tip 함께 도서관을 살려요
**이 프로젝트는 동네 작은 도서관이 더 오래 운영되기를 바라는 마음으로 만들었습니다.**

아파트, 학교, 마을 — 어디서든 작은도서관이 있는 곳이라면 바로 사용할 수 있습니다. 환경에 맞게 커스터마이징이 필요하시면 편하게 연락 주세요.

📧 **hckim@dean.kr**
:::

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend / Backend | Next.js 16 (App Router, TypeScript) |
| Database / Auth | Supabase (PostgreSQL) |
| UI | shadcn/ui + Tailwind CSS 4 |
| Deployment | Vercel (서울 리전) |
| External API | 카카오 도서 검색 API |
| Barcode | html5-qrcode |

## 스크린샷
### 주민용
![img.png](img.png)

### 관리자
![img_1.png](img_1.png)
## 개발

**딘스튜디오** | [dean.kr](https://dean.kr) | hckim@dean.kr

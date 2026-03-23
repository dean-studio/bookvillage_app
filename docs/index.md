---
layout: home
hero:
  name: 책빌리지
  text: 스마트 작은도서관
  tagline: 관리비 0원으로 운영하는 작은도서관 관리 시스템
  actions:
    - theme: brand
      text: 기능 둘러보기
      link: /features/rent
    - theme: alt
      text: GitHub
      link: https://github.com/dean-studio/bookvillage

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
---

## 만든 이유

아이를 키우는 아빠로서 동네 작은도서관을 자주 이용합니다. 그런데 관리할 사람이 없어 문을 닫거나 운영을 중단하는 곳이 점점 많아지고 있었습니다.

디지털 시대에 아날로그로 운영되는 도서관은 사서(자원봉사자)에게 큰 부담이 됩니다. 수기 장부나 엑셀로 대출/반납을 기록하고, 연체를 관리하고, 도서를 정리하는 일은 꾸준히 누군가의 시간과 노력을 요구합니다. 그래서 포기하게 되는 것이죠.

하지만 아이들에게 도서관은 특별한 공간입니다. 책을 만지고, 고르고, 읽는 경험은 어떤 디지털 콘텐츠로도 대체할 수 없습니다.

그래서 직접 이 시스템을 개발했습니다. **Vercel + Supabase 무료 플랜**으로 **관리비 0원**, 스마트폰만 있으면 누구나 사서가 될 수 있고, 주민은 간편 로그인 후 셀프 대여까지 할 수 있습니다. 관리사무소를 찾아가 직접 소개하고, 지금 실제로 운영 중입니다.

아이들이 책을 더 재밌게 읽을 수 있도록 **독서 퀴즈**와 **젤리 포인트**도 만들었습니다. 책을 빌리고, 반납하고, 퀴즈를 풀고, 독서록을 쓰면 젤리가 쌓입니다. 작은 보상이지만 아이들은 "오늘 젤리 몇 개 모았어!"라며 즐거워합니다.

관리할 사람이 없어서 닫히는 도서관이 하나라도 줄었으면 합니다.

::: tip 함께 도서관을 살려요
이 프로젝트는 동네 작은 도서관이 더 오래 운영되기를 바라는 마음으로 만들었습니다. 지금은 실제 도서관에서 운영 중이며, 동네 작은 도서관이나 독립 책방에서도 사용할 수 있습니다. Vercel + Supabase 무료 플랜으로 **운영비 0원**이니 부담 없이 사용하시길 바랍니다. 환경에 맞게 커스터마이징이 필요하시면 언제든 연락 주세요. 직접 수정해 드리겠습니다.

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

<!-- 스크린샷 추가 예시:
![메인 화면](./images/main-overview.png)
-->

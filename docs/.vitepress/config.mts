import { defineConfig } from 'vitepress'

export default defineConfig({
  ignoreDeadLinks: true,
  title: '책빌리지',
  description: '작은도서관 도서 대여 관리 시스템 | 도서관 대출 반납, 바코드 스캔, 도서 검색, 연체 관리, 독서 퀴즈',
  lang: 'ko-KR',
  base: '/bookvillage_app/',
  head: [
    ['meta', { name: 'theme-color', content: '#eab308' }],
    ['meta', { name: 'keywords', content: '도서관, 작은도서관, 도서관 프로그램, 도서관 관리, 도서 대여, 도서 대출, 도서관 대여 프로그램, 도서관 관리 시스템, 도서관 대출 반납, 바코드 대출, 셀프 대출, 독서 관리, 독서록, 독서 퀴즈, 아파트 도서관, 학교 도서관, 마을 도서관, library management, book rental, open source' }],
    ['meta', { name: 'author', content: '딘스튜디오 (dean.kr)' }],
    ['meta', { property: 'og:title', content: '책빌리지 - 작은도서관 도서 대여 관리 시스템' }],
    ['meta', { property: 'og:description', content: '관리비 0원으로 운영하는 스마트 작은도서관 관리 시스템. 바코드 스캔 대출/반납, 도서 검색, 연체 관리, 독서 퀴즈, 독서록까지.' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'ko_KR' }],
  ],
  themeConfig: {
    nav: [
      { text: '소개', link: '/' },
      { text: '기능 안내', link: '/features/rent' },
      { text: '관리자 가이드', link: '/guide/admin' },
      { text: '주민 가이드', link: '/guide/resident' },
    ],
    sidebar: {
      '/features/': [
        {
          text: '주민 기능',
          items: [
            { text: '대여하기', link: '/features/rent' },
            { text: '도서 검색', link: '/features/books' },
            { text: '내 서재', link: '/features/mypage' },
            { text: '퀴즈 & 독서록', link: '/features/quiz-report' },
            { text: '젤리 포인트', link: '/features/jelly' },
            { text: '알림', link: '/features/notifications' },
          ],
        },
        {
          text: '관리자 기능',
          items: [
            { text: '대시보드', link: '/features/admin-dashboard' },
            { text: '도서 등록', link: '/features/admin-books' },
            { text: '대출 / 반납', link: '/features/admin-rental' },
            { text: '서가 관리', link: '/features/admin-shelves' },
            { text: '연체 관리', link: '/features/admin-overdue' },
            { text: '주민 관리', link: '/features/admin-residents' },
            { text: '랭킹', link: '/features/admin-rankings' },
            { text: '설정', link: '/features/admin-settings' },
          ],
        },
      ],
      '/guide/': [
        {
          text: '가이드',
          items: [
            { text: '관리자 가이드', link: '/guide/admin' },
            { text: '주민 가이드', link: '/guide/resident' },
            { text: '설치 & 배포', link: '/guide/deploy' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dean-studio/bookvillage_app' },
    ],
    footer: {
      message: '스마트 작은도서관 관리 시스템',
      copyright: '딘스튜디오 (dean.kr)',
    },
    search: {
      provider: 'local',
    },
    outline: {
      label: '목차',
    },
    docFooter: {
      prev: '이전',
      next: '다음',
    },
  },
})

import { defineConfig } from 'vitepress'

export default defineConfig({
  ignoreDeadLinks: true,
  title: '책빌리지',
  description: '스마트 작은도서관 관리 시스템',
  lang: 'ko-KR',
  base: '/bookvillage/',
  head: [
    ['meta', { name: 'theme-color', content: '#eab308' }],
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
      { icon: 'github', link: 'https://github.com/dean-studio/bookvillage' },
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

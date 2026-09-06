// 신간도서 연령 분류 상수/타입 (서버·클라이언트 공용)
// 'use server' 파일에서는 값(상수)을 export 할 수 없으므로 별도 모듈로 분리한다.

export type NewArrivalCategory = 'infant' | 'child' | 'teen' | 'adult'

// 연령 분류 (표시 순서 = 인쇄 순서)
export const NEW_ARRIVAL_CATEGORIES: { value: NewArrivalCategory; label: string; hint: string }[] = [
  { value: 'infant', label: '유아', hint: '미취학' },
  { value: 'child', label: '어린이', hint: '초등' },
  { value: 'teen', label: '청소년', hint: '중·고등' },
  { value: 'adult', label: '성인', hint: '일반' },
]

export function normalizeCategory(v: string): NewArrivalCategory {
  return (['infant', 'child', 'teen', 'adult'] as const).includes(v as NewArrivalCategory)
    ? (v as NewArrivalCategory)
    : 'adult'
}

export interface NewArrival {
  id: string
  year_month: string
  category: NewArrivalCategory
  title: string
  author: string
  cover_image: string | null
  source_url: string | null
  sort_order: number
  created_at: string
}

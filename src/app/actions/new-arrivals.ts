'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import { normalizeCategory, type NewArrival } from '@/lib/new-arrivals'
import type { ActionResult } from '@/types'

export type { NewArrival, NewArrivalCategory } from '@/lib/new-arrivals'

const COLS = 'id, year_month, category, title, author, cover_image, source_url, sort_order, created_at'

// 교보문고(또는 일반 웹) 링크에서 og:title / og:image 추출
export async function fetchBookMeta(
  url: string
): Promise<ActionResult<{ title: string; image: string | null; author: string }>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return { success: false, error: '올바른 링크(http/https)를 입력해주세요.' }
  }

  let html: string
  try {
    const res = await fetch(trimmed, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      // 신간 페이지는 자주 바뀌지 않으므로 짧게 캐시
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return { success: false, error: `링크를 불러오지 못했습니다. (HTTP ${res.status})` }
    }
    html = await res.text()
  } catch {
    return { success: false, error: '링크를 불러오지 못했습니다. 주소를 확인하거나 직접 입력해주세요.' }
  }

  const meta = (prop: string): string | null => {
    // property="og:xxx" content="..." (순서 무관)
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
      'i'
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
      'i'
    )
    const m = html.match(re1) || html.match(re2)
    return m ? decodeHtml(m[1].trim()) : null
  }

  let title = meta('og:title') || ''
  const image = meta('og:image')

  // <title> 폴백
  if (!title) {
    const t = html.match(/<title>([^<]*)<\/title>/i)
    if (t) title = decodeHtml(t[1].trim())
  }

  // "제목 - 교보문고" 같은 사이트 접미사 제거
  title = title.replace(/\s*[-|]\s*(교보문고|예스24|YES24|알라딘|인터파크).*$/i, '').trim()

  if (!title && !image) {
    return {
      success: false,
      error: '도서 정보를 자동으로 가져오지 못했습니다. 제목/이미지를 직접 입력해주세요.',
    }
  }

  return { success: true, data: { title, image, author: '' } }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// 월별 신간 목록 (공개 조회)
export async function getNewArrivals(yearMonth: string): Promise<NewArrival[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('new_arrivals')
    .select(COLS)
    .eq('year_month', yearMonth)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data ?? []) as NewArrival[]
}

// 등록된 월 목록 (최신순, 각 월별 권수 포함)
export async function getNewArrivalMonths(): Promise<{ year_month: string; count: number }[]> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []
  const { data } = await supabaseAdmin
    .from('new_arrivals')
    .select('year_month')
    .order('year_month', { ascending: false })
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { year_month: string }[]) {
    counts[row.year_month] = (counts[row.year_month] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([year_month, count]) => ({ year_month, count }))
    .sort((a, b) => (a.year_month < b.year_month ? 1 : -1))
}

export async function createNewArrival(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const year_month = String(formData.get('year_month') ?? '').trim()
  const category = normalizeCategory(String(formData.get('category') ?? 'adult'))
  const title = String(formData.get('title') ?? '').trim()
  const author = String(formData.get('author') ?? '').trim()
  const cover_image = String(formData.get('cover_image') ?? '').trim() || null
  const source_url = String(formData.get('source_url') ?? '').trim() || null

  if (!/^\d{4}-\d{2}$/.test(year_month)) return { success: false, error: '월(YYYY-MM)이 올바르지 않습니다.' }
  if (!title) return { success: false, error: '도서명을 입력해주세요.' }

  // 같은 월·같은 분류의 마지막 순서 뒤에 추가
  const { data: last } = await supabaseAdmin
    .from('new_arrivals')
    .select('sort_order')
    .eq('year_month', year_month)
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1

  const { error } = await supabaseAdmin.from('new_arrivals').insert({
    year_month,
    category,
    title,
    author,
    cover_image,
    source_url,
    sort_order,
    created_by: user.id,
  })
  if (error) return { success: false, error: '등록에 실패했습니다.' }
  return { success: true }
}

export async function updateNewArrival(id: string, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const title = String(formData.get('title') ?? '').trim()
  const author = String(formData.get('author') ?? '').trim()
  const cover_image = String(formData.get('cover_image') ?? '').trim() || null
  const category = normalizeCategory(String(formData.get('category') ?? 'adult'))
  if (!title) return { success: false, error: '도서명을 입력해주세요.' }

  const { error } = await supabaseAdmin
    .from('new_arrivals')
    .update({ title, author, cover_image, category })
    .eq('id', id)
  if (error) return { success: false, error: '수정에 실패했습니다.' }
  return { success: true }
}

// 순서 저장 (ids 배열 순서대로 sort_order 0,1,2,... 재부여)
export async function reorderNewArrivals(ids: string[]): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }
  if (!Array.isArray(ids) || ids.length === 0) return { success: true }

  // 개별 update (건수가 많지 않아 순차 처리)
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseAdmin
      .from('new_arrivals')
      .update({ sort_order: i })
      .eq('id', ids[i])
    if (error) return { success: false, error: '순서 저장에 실패했습니다.' }
  }
  return { success: true }
}

export async function deleteNewArrival(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }
  const { error } = await supabaseAdmin.from('new_arrivals').delete().eq('id', id)
  if (error) return { success: false, error: '삭제에 실패했습니다.' }
  return { success: true }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/app/actions/auth'

export async function logSearch(query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return

  const user = await getCurrentUser()
  const supabase = await createClient()

  await supabase.from('search_logs').insert({
    query: trimmed,
    user_id: user?.id ?? null,
  })
}

export async function logBookView(bookId: string) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  await supabase.from('book_views').insert({
    book_id: bookId,
    user_id: user?.id ?? null,
  })
}

export async function getPopularSearches(limit = 10) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data } = await supabaseAdmin
    .from('search_logs')
    .select('query')
    .gte('searched_at', sevenDaysAgo.toISOString())

  if (!data || data.length === 0) return []

  // query별 count 집계
  const countMap: Record<string, number> = {}
  for (const row of data) {
    countMap[row.query] = (countMap[row.query] || 0) + 1
  }

  return Object.entries(countMap)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getRecommendedBooks(bookId: string, limit = 6) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 1. bookId를 조회한 user_id 목록 (최근 30일)
  const { data: viewers } = await supabaseAdmin
    .from('book_views')
    .select('user_id')
    .eq('book_id', bookId)
    .not('user_id', 'is', null)
    .gte('viewed_at', thirtyDaysAgo.toISOString())

  if (!viewers || viewers.length === 0) return []

  const userIds = [...new Set(viewers.map((v) => v.user_id!).filter(Boolean))]
  if (userIds.length === 0) return []

  // 2. 그 user_id들이 조회한 다른 book_id 집계
  const { data: otherViews } = await supabaseAdmin
    .from('book_views')
    .select('book_id')
    .in('user_id', userIds)
    .neq('book_id', bookId)
    .gte('viewed_at', thirtyDaysAgo.toISOString())

  if (!otherViews || otherViews.length === 0) return []

  const bookCountMap: Record<string, number> = {}
  for (const row of otherViews) {
    bookCountMap[row.book_id] = (bookCountMap[row.book_id] || 0) + 1
  }

  // 3. count 높은 순 정렬, 상위 N개 book_id 추출
  const topBookIds = Object.entries(bookCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (topBookIds.length === 0) return []

  // 4. 도서 정보 조회
  const { data: books } = await supabaseAdmin
    .from('books')
    .select('id, title, author, cover_image')
    .in('id', topBookIds.map(([id]) => id))
    .eq('is_deleted', false)

  if (!books) return []

  const countLookup = Object.fromEntries(topBookIds)
  return books
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      cover_image: b.cover_image,
      view_count: countLookup[b.id] || 0,
    }))
    .sort((a, b) => b.view_count - a.view_count)
}

export async function getPopularBooks(limit = 10) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: views } = await supabaseAdmin
    .from('book_views')
    .select('book_id')
    .gte('viewed_at', sevenDaysAgo.toISOString())

  if (!views || views.length === 0) return []

  // book_id별 count 집계
  const countMap: Record<string, number> = {}
  for (const row of views) {
    countMap[row.book_id] = (countMap[row.book_id] || 0) + 1
  }

  const topBookIds = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (topBookIds.length === 0) return []

  const { data: books } = await supabaseAdmin
    .from('books')
    .select('id, title, author, cover_image')
    .in('id', topBookIds.map(([id]) => id))
    .eq('is_deleted', false)

  if (!books) return []

  const countLookup = Object.fromEntries(topBookIds)
  return books
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      cover_image: b.cover_image,
      view_count: countLookup[b.id] || 0,
    }))
    .sort((a, b) => b.view_count - a.view_count)
}

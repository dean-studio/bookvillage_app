'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/app/actions/auth'
import type { ActionResult } from '@/types'

async function getJellySettingValue(key: string, defaultValue: number): Promise<number> {
  const { data } = await supabaseAdmin
    .from('library_settings')
    .select('value')
    .eq('key', key)
    .single()
  return data ? parseInt(data.value, 10) || defaultValue : defaultValue
}

export async function awardJelly(
  userId: string,
  amount: number,
  reason: string,
  description?: string,
  bookId?: string
) {
  // jelly_balances UPSERT
  const { data: existing } = await supabaseAdmin
    .from('jelly_balances')
    .select('balance, total_earned')
    .eq('user_id', userId)
    .single()

  if (existing) {
    const newBalance = existing.balance + amount
    const newTotalEarned = amount > 0 ? existing.total_earned + amount : existing.total_earned
    await supabaseAdmin
      .from('jelly_balances')
      .update({ balance: newBalance, total_earned: newTotalEarned, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  } else {
    await supabaseAdmin
      .from('jelly_balances')
      .insert({
        user_id: userId,
        balance: Math.max(0, amount),
        total_earned: amount > 0 ? amount : 0,
      })
  }

  // jelly_history INSERT
  await supabaseAdmin
    .from('jelly_history')
    .insert({
      user_id: userId,
      amount,
      reason,
      description: description ?? null,
      book_id: bookId ?? null,
    })
}

export async function getMyJelly() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { balance: 0, total_earned: 0 }

  const { data } = await supabase
    .from('jelly_balances')
    .select('balance, total_earned')
    .eq('user_id', user.id)
    .single()

  return data ?? { balance: 0, total_earned: 0 }
}

export async function getMyJellyHistory(limit = 30) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('jelly_history')
    .select('id, amount, reason, description, book_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  // book_id가 있는 항목의 도서 제목 조회
  const bookIds = [...new Set(data.filter((h) => h.book_id).map((h) => h.book_id!))]
  let bookMap: Record<string, string> = {}

  if (bookIds.length > 0) {
    const { data: books } = await supabase
      .from('books')
      .select('id, title')
      .in('id', bookIds)

    if (books) {
      bookMap = Object.fromEntries(books.map((b) => [b.id, b.title]))
    }
  }

  return data.map((h) => ({
    id: h.id,
    amount: h.amount,
    reason: h.reason,
    description: h.description,
    book_title: h.book_id ? bookMap[h.book_id] ?? null : null,
    created_at: h.created_at,
  }))
}

export async function getJellyRanking(limit = 10) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []

  const { data } = await supabaseAdmin
    .from('jelly_balances')
    .select('user_id, balance, total_earned')
    .order('total_earned', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  const userIds = data.map((d) => d.user_id)
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  return data.map((d) => ({
    user_id: d.user_id,
    name: profileMap[d.user_id]?.name ?? '알 수 없음',
    dong_ho: profileMap[d.user_id]?.dong_ho ?? '',
    balance: d.balance,
    total_earned: d.total_earned,
  }))
}

export async function getJellyRankingByPeriod(startDate: string, endDate: string, limit = 50) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []

  const { data } = await supabaseAdmin
    .from('jelly_history')
    .select('user_id, amount')
    .gt('amount', 0)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (!data || data.length === 0) return []

  const userTotals = new Map<string, number>()
  for (const h of data) {
    userTotals.set(h.user_id, (userTotals.get(h.user_id) ?? 0) + h.amount)
  }

  const sorted = [...userTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  const userIds = sorted.map(([id]) => id)
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  return sorted.map(([userId, total]) => ({
    user_id: userId,
    name: profileMap[userId]?.name ?? '알 수 없음',
    dong_ho: profileMap[userId]?.dong_ho ?? '',
    earned: total,
  }))
}

export async function adminGiveJelly(userId: string, amount: number, description: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  if (amount <= 0) return { success: false, error: '지급 수량은 1 이상이어야 합니다.' }

  await awardJelly(userId, amount, 'admin_give', description)
  return { success: true }
}

export async function adminDeductJelly(userId: string, amount: number, description: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  if (amount <= 0) return { success: false, error: '차감 수량은 1 이상이어야 합니다.' }

  // 현재 잔액 확인
  const { data: balance } = await supabaseAdmin
    .from('jelly_balances')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (!balance || balance.balance < amount) {
    return { success: false, error: '잔액이 부족합니다.' }
  }

  await awardJelly(userId, -amount, 'admin_deduct', description)
  return { success: true }
}

export async function getUserJellyHistory(userId: string, limit = 30) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []

  const { data } = await supabaseAdmin
    .from('jelly_history')
    .select('id, amount, reason, description, book_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  const bookIds = [...new Set(data.filter((h) => h.book_id).map((h) => h.book_id!))]
  let bookMap: Record<string, string> = {}

  if (bookIds.length > 0) {
    const { data: books } = await supabaseAdmin
      .from('books')
      .select('id, title')
      .in('id', bookIds)

    if (books) {
      bookMap = Object.fromEntries(books.map((b) => [b.id, b.title]))
    }
  }

  return data.map((h) => ({
    id: h.id,
    amount: h.amount,
    reason: h.reason,
    description: h.description,
    book_title: h.book_id ? bookMap[h.book_id] ?? null : null,
    created_at: h.created_at,
  }))
}

// 설정값 기반 젤리 지급 헬퍼
export async function awardJellyForCheckout(userId: string, bookTitle: string, bookId: string) {
  const amount = await getJellySettingValue('jelly_checkout', 5)
  if (amount > 0) await awardJelly(userId, amount, 'checkout', bookTitle, bookId)
}

export async function awardJellyForReturn(userId: string, bookTitle: string, bookId: string) {
  const amount = await getJellySettingValue('jelly_return', 5)
  if (amount > 0) await awardJelly(userId, amount, 'return', bookTitle, bookId)
}

export async function awardJellyForReport(userId: string, bookTitle: string, bookId: string) {
  const amount = await getJellySettingValue('jelly_report', 10)
  if (amount > 0) await awardJelly(userId, amount, 'report', bookTitle, bookId)
}

export async function awardJellyForQuiz(userId: string, bookTitle: string, bookId: string) {
  const amount = await getJellySettingValue('jelly_quiz', 3)
  if (amount > 0) await awardJelly(userId, amount, 'quiz', bookTitle, bookId)
}

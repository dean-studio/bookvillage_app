'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

export interface PurchaseReceipt {
  id: string
  year_month: string
  image_url: string
  memo: string
  sort_order: number
  created_at: string
}

const COLS = 'id, year_month, image_url, memo, sort_order, created_at'

// 월별 영수증 목록 (관리자 전용)
export async function getReceipts(yearMonth: string): Promise<PurchaseReceipt[]> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []
  const { data } = await supabaseAdmin
    .from('purchase_receipts')
    .select(COLS)
    .eq('year_month', yearMonth)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data ?? []) as PurchaseReceipt[]
}

// 등록된 월 목록 (최신순, 월별 장수 포함)
export async function getReceiptMonths(): Promise<{ year_month: string; count: number }[]> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []
  const { data } = await supabaseAdmin
    .from('purchase_receipts')
    .select('year_month')
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { year_month: string }[]) {
    counts[row.year_month] = (counts[row.year_month] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([year_month, count]) => ({ year_month, count }))
    .sort((a, b) => (a.year_month < b.year_month ? 1 : -1))
}

export async function createReceipt(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const year_month = String(formData.get('year_month') ?? '').trim()
  const image_url = String(formData.get('image_url') ?? '').trim()
  const memo = String(formData.get('memo') ?? '').trim()

  if (!/^\d{4}-\d{2}$/.test(year_month)) return { success: false, error: '월(YYYY-MM)이 올바르지 않습니다.' }
  if (!image_url) return { success: false, error: '영수증 이미지를 업로드해주세요.' }

  // 같은 월의 마지막 순서 뒤에 추가
  const { data: last } = await supabaseAdmin
    .from('purchase_receipts')
    .select('sort_order')
    .eq('year_month', year_month)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1

  const { error } = await supabaseAdmin.from('purchase_receipts').insert({
    year_month,
    image_url,
    memo,
    sort_order,
    created_by: user.id,
  })
  if (error) return { success: false, error: '등록에 실패했습니다.' }
  return { success: true }
}

export async function updateReceiptMemo(id: string, memo: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }
  const { error } = await supabaseAdmin
    .from('purchase_receipts')
    .update({ memo: memo.trim() })
    .eq('id', id)
  if (error) return { success: false, error: '수정에 실패했습니다.' }
  return { success: true }
}

// 순서 저장 (ids 배열 순서대로 sort_order 0,1,2,... 재부여)
export async function reorderReceipts(ids: string[]): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }
  if (!Array.isArray(ids) || ids.length === 0) return { success: true }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseAdmin
      .from('purchase_receipts')
      .update({ sort_order: i })
      .eq('id', ids[i])
    if (error) return { success: false, error: '순서 저장에 실패했습니다.' }
  }
  return { success: true }
}

export async function deleteReceipt(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }
  const { error } = await supabaseAdmin.from('purchase_receipts').delete().eq('id', id)
  if (error) return { success: false, error: '삭제에 실패했습니다.' }
  return { success: true }
}

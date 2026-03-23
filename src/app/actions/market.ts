'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import type { ActionResult, MarketItem } from '@/types'
import { z } from 'zod'

const createMarketItemSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(100),
  description: z.string().min(1, '설명을 입력해주세요.'),
  price: z.coerce.number().int().min(0, '가격은 0원 이상이어야 합니다.'),
  images: z.string().array().default([]),
})

const updateMarketItemSchema = createMarketItemSchema.partial()

interface MarketListParams {
  status?: 'on_sale' | 'reserved' | 'sold'
  page?: number
  limit?: number
}

export async function getMarketItems(params: MarketListParams = {}) {
  const { status, page = 1, limit = 20 } = params
  const supabase = await createClient()
  const offset = (page - 1) * limit

  let query = supabase
    .from('market_items')
    .select('*, profiles!market_items_user_id_fkey(name, dong_ho)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    return { items: [], totalCount: 0, currentPage: page, totalPages: 0 }
  }

  return {
    items: data ?? [],
    totalCount: count ?? 0,
    currentPage: page,
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

export async function getMarketItemById(itemId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('market_items')
    .select('*, profiles!market_items_user_id_fkey(name, dong_ho, phone_number)')
    .eq('id', itemId)
    .single()

  if (error || !data) return null
  return data
}

export async function createMarketItem(formData: FormData): Promise<ActionResult<MarketItem>> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    price: formData.get('price'),
    images: formData.getAll('images').filter(Boolean) as string[],
  }

  const parsed = createMarketItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('market_items')
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      images: parsed.data.images,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: '게시물 등록에 실패했습니다.' }
  }

  return { success: true, data }
}

export async function updateMarketItem(itemId: string, formData: FormData): Promise<ActionResult<MarketItem>> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const raw: Record<string, unknown> = {}
  for (const key of ['title', 'description', 'price']) {
    const val = formData.get(key)
    if (val) raw[key] = val
  }
  const images = formData.getAll('images').filter(Boolean) as string[]
  if (images.length > 0) raw.images = images

  const parsed = updateMarketItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('market_items')
    .update(parsed.data)
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { success: false, error: '게시물 수정에 실패했습니다.' }
  }

  return { success: true, data }
}

export async function updateMarketItemStatus(
  itemId: string,
  status: 'on_sale' | 'reserved' | 'sold'
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('market_items')
    .update({ status })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: '상태 변경에 실패했습니다.' }
  }

  return { success: true }
}

export async function deleteMarketItem(itemId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const supabase = await createClient()

  // RLS가 본인 또는 관리자만 삭제 허용
  const { error } = await supabase
    .from('market_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    return { success: false, error: '게시물 삭제에 실패했습니다.' }
  }

  return { success: true }
}

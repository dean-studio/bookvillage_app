'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'
import { z } from 'zod'

const shelfSchema = z.object({
  name: z.string().min(1, '서재 이름을 입력해주세요.').max(50),
  position_x: z.coerce.number().int().min(0),
  position_y: z.coerce.number().int().min(0),
  width: z.coerce.number().int().min(1).default(1),
  height: z.coerce.number().int().min(1).default(1),
  color: z.string().max(20).default('#3b82f6'),
  type: z.enum(['shelf', 'label']).default('shelf'),
  font_size: z.coerce.number().int().min(0).max(48).default(0),
  font_bold: z.preprocess((v) => v === 'true' || v === true, z.boolean().default(false)),
})

export async function getShelves() {
  const supabase = await createClient()

  const { data: shelves } = await supabase
    .from('shelves')
    .select('*')
    .order('name')

  if (!shelves) return []

  // 각 서재의 도서 수 조회
  const { data: bookCounts } = await supabase
    .from('books')
    .select('location_group')
    .eq('is_deleted', false)

  const countMap: Record<string, number> = {}
  if (bookCounts) {
    for (const book of bookCounts) {
      countMap[book.location_group] = (countMap[book.location_group] || 0) + 1
    }
  }

  return shelves.map((shelf) => ({
    ...shelf,
    book_count: countMap[shelf.name] || 0,
  }))
}

export async function createShelf(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.' }
  }

  const raw = {
    name: formData.get('name'),
    position_x: formData.get('position_x') ?? 0,
    position_y: formData.get('position_y') ?? 0,
    width: formData.get('width') ?? 1,
    height: formData.get('height') ?? 1,
    color: formData.get('color') ?? '#3b82f6',
    type: formData.get('type') ?? 'shelf',
    font_size: formData.get('font_size') ?? 0,
    font_bold: formData.get('font_bold') ?? false,
  }

  const parsed = shelfSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('shelves').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: '이미 같은 이름의 서재가 있습니다.' }
    }
    return { success: false, error: '서재 추가에 실패했습니다.' }
  }

  return { success: true }
}

export async function updateShelf(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.' }
  }

  const id = formData.get('id') as string
  if (!id) return { success: false, error: '서재 ID가 필요합니다.' }

  const raw = {
    name: formData.get('name'),
    position_x: formData.get('position_x') ?? 0,
    position_y: formData.get('position_y') ?? 0,
    width: formData.get('width') ?? 1,
    height: formData.get('height') ?? 1,
    color: formData.get('color') ?? '#3b82f6',
    type: formData.get('type') ?? 'shelf',
    font_size: formData.get('font_size') ?? 0,
    font_bold: formData.get('font_bold') ?? false,
  }

  const parsed = shelfSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  // 이름 변경 시 해당 서재의 도서 location_group도 업데이트
  const { data: existing } = await supabase
    .from('shelves')
    .select('name')
    .eq('id', id)
    .single()

  if (!existing) {
    return { success: false, error: '서재를 찾을 수 없습니다.' }
  }

  const { error } = await supabase
    .from('shelves')
    .update(parsed.data)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: '이미 같은 이름의 서재가 있습니다.' }
    }
    return { success: false, error: '서재 수정에 실패했습니다.' }
  }

  // 이름이 변경된 경우 도서의 location_group 업데이트
  if (existing.name !== parsed.data.name) {
    await supabase
      .from('books')
      .update({ location_group: parsed.data.name })
      .eq('location_group', existing.name)
  }

  return { success: true }
}

export async function deleteShelf(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.' }
  }

  const supabase = await createClient()

  // 서재에 도서가 있는지 확인
  const { data: shelf } = await supabase
    .from('shelves')
    .select('name')
    .eq('id', id)
    .single()

  if (!shelf) {
    return { success: false, error: '서재를 찾을 수 없습니다.' }
  }

  const { count } = await supabase
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('location_group', shelf.name)
    .eq('is_deleted', false)

  if (count && count > 0) {
    return { success: false, error: `이 서재에 ${count}권의 도서가 있어 삭제할 수 없습니다. 도서를 먼저 이동해주세요.` }
  }

  const { error } = await supabase
    .from('shelves')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: '서재 삭제에 실패했습니다.' }
  }

  return { success: true }
}

export async function getShelfBooks(shelfName: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('books')
    .select('*')
    .eq('location_group', shelfName)
    .eq('is_deleted', false)
    .order('location_detail')

  return data ?? []
}

import { createClient } from '@/lib/supabase/client'

export async function uploadMarketImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${ext}`
  const filePath = `market/${fileName}`

  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false })

  if (error) return null

  const { data } = supabase.storage.from('images').getPublicUrl(filePath)
  return data.publicUrl
}

// 도서 표지 이미지를 업로드 전 작게 리사이즈 (최대 폭 400px, JPEG)
async function resizeImage(file: File, maxWidth = 400, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas 생성 실패'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('리사이즈 실패'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지 로드 실패'))
    }
    img.src = url
  })
}

export async function uploadBookCoverImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const fileName = `${crypto.randomUUID()}.jpg`
  const filePath = `books/${fileName}`

  // 큰 이미지도 400px JPEG로 축소해서 업로드 (용량 절감)
  let body: Blob = file
  try {
    body = await resizeImage(file)
  } catch {
    body = file // 리사이즈 실패 시 원본 업로드
  }

  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, body, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })

  if (error) return null

  const { data } = supabase.storage.from('images').getPublicUrl(filePath)
  return data.publicUrl
}

// 공지사항 이미지 업로드 (최대 폭 1000px로 축소)
export async function uploadNoticeImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const fileName = `${crypto.randomUUID()}.jpg`
  const filePath = `notices/${fileName}`

  let body: Blob = file
  try {
    body = await resizeImage(file, 1000, 0.85)
  } catch {
    body = file
  }

  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, body, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })

  if (error) return null

  const { data } = supabase.storage.from('images').getPublicUrl(filePath)
  return data.publicUrl
}

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

// 영수증 JPEG blob 하나를 storage에 업로드
async function uploadReceiptJpegBlob(body: Blob): Promise<string | null> {
  const supabase = createClient()
  const fileName = `${crypto.randomUUID()}.jpg`
  const filePath = `receipts/${fileName}`

  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, body, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })

  if (error) return null

  const { data } = supabase.storage.from('images').getPublicUrl(filePath)
  return data.publicUrl
}

// 구매 영수증 이미지 업로드 (글자 판독 위해 최대 폭 1600px로 축소)
export async function uploadReceiptImage(file: File): Promise<string | null> {
  let body: Blob = file
  try {
    body = await resizeImage(file, 1600, 0.9)
  } catch {
    body = file
  }
  return uploadReceiptJpegBlob(body)
}

// PDF의 각 페이지를 JPEG로 렌더링 (글자 판독 위해 최대 폭 1600px)
async function pdfToJpegBlobs(file: File, maxWidth = 1600, quality = 0.9): Promise<Blob[]> {
  // pdfjs는 브라우저 전용이라 동적 import (초기 번들에서 분리)
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const buf = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: buf })
  const doc = await loadingTask.promise
  const blobs: Blob[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(3, Math.max(1, maxWidth / base.width))
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    // PDF 배경이 투명할 수 있어 흰 배경을 먼저 칠한다
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvas, canvasContext: ctx, viewport }).promise

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )
    if (blob) blobs.push(blob)
  }

  await loadingTask.destroy()
  return blobs
}

// 구매 영수증 PDF 업로드: 페이지별로 JPEG 변환 후 각각 업로드, URL 배열 반환
// (여러 페이지 = 여러 장 영수증으로 저장)
export async function uploadReceiptPdf(file: File): Promise<string[]> {
  const blobs = await pdfToJpegBlobs(file)
  const urls: string[] = []
  for (const blob of blobs) {
    const url = await uploadReceiptJpegBlob(blob)
    if (url) urls.push(url)
  }
  return urls
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

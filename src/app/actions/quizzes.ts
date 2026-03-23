'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import { awardJellyForQuiz } from '@/app/actions/jelly'
import type { ActionResult, Quiz } from '@/types'
import { z } from 'zod'

const createQuizSchema = z.object({
  book_id: z.string().uuid(),
  question: z.string().min(1, '질문을 입력해주세요.'),
  options: z.string().array().length(4, '선택지는 4개여야 합니다.'),
  answer: z.coerce.number().int().min(0).max(3),
})

const submitAnswerSchema = z.object({
  quiz_id: z.string().uuid(),
  selected_answer: z.coerce.number().int().min(0).max(3),
})

export async function getQuizzesByBook(bookId: string) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, question, options')
    .eq('book_id', bookId)

  if (!quizzes || quizzes.length === 0) return []

  // 현재 사용자의 풀이 여부 확인
  let solvedQuizIds: string[] = []
  if (user) {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('quiz_id')
      .eq('user_id', user.id)
      .in('quiz_id', quizzes.map((q) => q.id))

    solvedQuizIds = (attempts ?? []).map((a) => a.quiz_id)
  }

  return quizzes.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options as string[],
    is_solved: solvedQuizIds.includes(q.id),
  }))
}

export async function createQuiz(formData: FormData): Promise<ActionResult<Quiz>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const raw = {
    book_id: formData.get('book_id'),
    question: formData.get('question'),
    options: formData.getAll('options') as string[],
    answer: formData.get('answer'),
  }

  const parsed = createQuizSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      book_id: parsed.data.book_id,
      question: parsed.data.question,
      options: parsed.data.options,
      answer: parsed.data.answer,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: '퀴즈 등록에 실패했습니다.' }
  }

  return { success: true, data }
}

interface QuizResult {
  is_correct: boolean
  correct_answer: number
  message: string
}

export async function submitQuizAnswer(formData: FormData): Promise<ActionResult<QuizResult>> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const raw = {
    quiz_id: formData.get('quiz_id'),
    selected_answer: formData.get('selected_answer'),
  }

  const parsed = submitAnswerSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { quiz_id, selected_answer } = parsed.data
  const supabase = await createClient()

  // 퀴즈 조회
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, book_id, answer, books!quizzes_book_id_fkey(title)')
    .eq('id', quiz_id)
    .single()

  if (!quiz) {
    return { success: false, error: '존재하지 않는 퀴즈입니다.' }
  }

  // 반납 이력 확인
  const { data: returnedRental } = await supabase
    .from('rentals')
    .select('id')
    .eq('book_id', quiz.book_id)
    .eq('user_id', user.id)
    .not('returned_at', 'is', null)
    .limit(1)
    .single()

  if (!returnedRental) {
    return { success: false, error: '해당 도서를 반납한 이력이 없습니다.' }
  }

  // 이미 풀었는지 확인
  const { data: existing } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('quiz_id', quiz_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return { success: false, error: '이미 풀었던 퀴즈입니다.' }
  }

  const is_correct = selected_answer === quiz.answer

  // 풀이 기록 저장
  const { error } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id,
      user_id: user.id,
      selected_answer,
      is_correct,
    })

  if (error) {
    return { success: false, error: '퀴즈 제출에 실패했습니다.' }
  }

  // 정답이면 젤리 지급
  if (is_correct) {
    const bookTitle = (quiz.books as { title: string } | null)?.title ?? ''
    awardJellyForQuiz(user.id, bookTitle, quiz.book_id).catch(() => {})
  }

  return {
    success: true,
    data: {
      is_correct,
      correct_answer: quiz.answer,
      message: is_correct ? '정답입니다!' : '오답입니다.',
    },
  }
}

import type { Database } from './supabase'

// Table row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Book = Database['public']['Tables']['books']['Row']
export type Rental = Database['public']['Tables']['rentals']['Row']
export type Quiz = Database['public']['Tables']['quizzes']['Row']
export type QuizAttempt = Database['public']['Tables']['quiz_attempts']['Row']
export type BookReport = Database['public']['Tables']['book_reports']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// View types
export type OverdueRental = Database['public']['Views']['overdue_rentals']['Row']
export type BookRating = Database['public']['Views']['book_ratings']['Row']

// Common action result type
export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

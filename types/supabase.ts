export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone_number: string
          name: string
          dong_ho: string
          role: 'resident' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone_number: string
          name: string
          dong_ho: string
          role?: 'resident' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          name?: string
          dong_ho?: string
          role?: 'resident' | 'admin'
          created_at?: string
          updated_at?: string
        }
      }
      books: {
        Row: {
          id: string
          barcode: string
          title: string
          author: string
          publisher: string | null
          cover_image: string | null
          description: string | null
          location_group: string
          location_detail: string
          is_available: boolean
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barcode: string
          title: string
          author: string
          publisher?: string | null
          cover_image?: string | null
          description?: string | null
          location_group: string
          location_detail: string
          is_available?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barcode?: string
          title?: string
          author?: string
          publisher?: string | null
          cover_image?: string | null
          description?: string | null
          location_group?: string
          location_detail?: string
          is_available?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      rentals: {
        Row: {
          id: string
          book_id: string
          user_id: string
          rented_at: string
          due_date: string
          returned_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          book_id: string
          user_id: string
          rented_at?: string
          due_date?: string
          returned_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          book_id?: string
          user_id?: string
          rented_at?: string
          due_date?: string
          returned_at?: string | null
          created_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          book_id: string
          question: string
          options: Json
          answer: number
          created_at: string
        }
        Insert: {
          id?: string
          book_id: string
          question: string
          options: Json
          answer: number
          created_at?: string
        }
        Update: {
          id?: string
          book_id?: string
          question?: string
          options?: Json
          answer?: number
          created_at?: string
        }
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_id: string
          user_id: string
          selected_answer: number
          is_correct: boolean
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          user_id: string
          selected_answer: number
          is_correct: boolean
          created_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          user_id?: string
          selected_answer?: number
          is_correct?: boolean
          created_at?: string
        }
      }
      book_reports: {
        Row: {
          id: string
          book_id: string
          user_id: string
          rating: number
          review: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          book_id: string
          user_id: string
          rating: number
          review: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          book_id?: string
          user_id?: string
          rating?: number
          review?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          rental_id: string
          type: '7day' | '30day'
          sent_at: string
          status: 'sent' | 'failed'
        }
        Insert: {
          id?: string
          rental_id: string
          type: '7day' | '30day'
          sent_at?: string
          status?: 'sent' | 'failed'
        }
        Update: {
          id?: string
          rental_id?: string
          type?: '7day' | '30day'
          sent_at?: string
          status?: 'sent' | 'failed'
        }
      }
    }
    Views: {
      overdue_rentals: {
        Row: {
          id: string
          book_id: string
          user_id: string
          rented_at: string
          due_date: string
          overdue_days: number
          book_title: string
          book_barcode: string
          user_name: string
          user_dong_ho: string
          user_phone: string
          notified_7day: boolean
          notified_30day: boolean
        }
      }
      book_ratings: {
        Row: {
          book_id: string
          review_count: number
          avg_rating: number
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

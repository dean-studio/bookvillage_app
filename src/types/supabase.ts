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
          admin_status: 'pending' | 'approved' | null
          notifications_read_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone_number: string
          name: string
          dong_ho: string
          role?: 'resident' | 'admin'
          admin_status?: 'pending' | 'approved' | null
          notifications_read_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          name?: string
          dong_ho?: string
          role?: 'resident' | 'admin'
          admin_status?: 'pending' | 'approved' | null
          notifications_read_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          isbn: string
          translators: string
          published_at: string
          price: number
          sale_price: number
          category: string
          kakao_url: string
          sale_status: string
          rental_days: number | null
          featured_until: string | null
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
          isbn?: string
          translators?: string
          published_at?: string
          price?: number
          sale_price?: number
          category?: string
          kakao_url?: string
          sale_status?: string
          rental_days?: number | null
          featured_until?: string | null
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
          isbn?: string
          translators?: string
          published_at?: string
          price?: number
          sale_price?: number
          category?: string
          kakao_url?: string
          sale_status?: string
          rental_days?: number | null
          featured_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          id: string
          book_id: string
          user_id: string
          rented_at: string
          due_date: string
          returned_at: string | null
          returned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          book_id: string
          user_id: string
          rented_at?: string
          due_date?: string
          returned_at?: string | null
          returned_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          book_id?: string
          user_id?: string
          rented_at?: string
          due_date?: string
          returned_at?: string | null
          returned_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "quizzes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "book_reports_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "notifications_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      market_items: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          price: number
          images: Json
          status: 'on_sale' | 'reserved' | 'sold'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          price: number
          images?: Json
          status?: 'on_sale' | 'reserved' | 'sold'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          price?: number
          images?: Json
          status?: 'on_sale' | 'reserved' | 'sold'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shelves: {
        Row: {
          id: string
          name: string
          position_x: number
          position_y: number
          width: number
          height: number
          color: string | null
          type: string
          font_size: number
          font_bold: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          color?: string | null
          type?: string
          font_size?: number
          font_bold?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          color?: string | null
          type?: string
          font_size?: number
          font_bold?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_settings: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      book_deletions: {
        Row: {
          id: string
          book_id: string
          book_title: string
          book_barcode: string
          book_author: string | null
          deleted_by: string
          deleted_at: string
          reason: string | null
        }
        Insert: {
          id?: string
          book_id: string
          book_title: string
          book_barcode: string
          book_author?: string | null
          deleted_by: string
          deleted_at?: string
          reason?: string | null
        }
        Update: {
          id?: string
          book_id?: string
          book_title?: string
          book_barcode?: string
          book_author?: string | null
          deleted_by?: string
          deleted_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_deletions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          id: string
          query: string
          user_id: string | null
          searched_at: string
        }
        Insert: {
          id?: string
          query: string
          user_id?: string | null
          searched_at?: string
        }
        Update: {
          id?: string
          query?: string
          user_id?: string | null
          searched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_views: {
        Row: {
          id: string
          book_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          book_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          book_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_views_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jelly_balances: {
        Row: {
          user_id: string
          balance: number
          total_earned: number
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          total_earned?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          total_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jelly_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jelly_history: {
        Row: {
          id: string
          user_id: string
          amount: number
          reason: string
          description: string | null
          book_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          reason: string
          description?: string | null
          book_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          reason?: string
          description?: string | null
          book_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jelly_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jelly_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      book_ratings: {
        Row: {
          book_id: string
          review_count: number
          avg_rating: number
        }
        Relationships: []
      }
    }
    Functions: {}
    Enums: {}
  }
}

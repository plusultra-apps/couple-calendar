// 자동 생성 파일 — 직접 고치지 말 것.
// DB 를 바꾼 뒤 Supabase MCP generate_typescript_types (또는 supabase gen types) 결과로 덮어쓴다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      anniversaries: {
        Row: {
          base_date: string
          count_days: boolean
          day_every: number | null
          day_marks: number[]
          couple_id: string
          created_at: string
          created_by: string | null
          emoji: string
          id: string
          is_lunar: boolean
          kind: string
          title: string
        }
        Insert: {
          base_date: string
          count_days?: boolean
          day_every?: number | null
          day_marks?: number[]
          couple_id?: string
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          is_lunar?: boolean
          kind?: string
          title: string
        }
        Update: {
          base_date?: string
          count_days?: boolean
          day_every?: number | null
          day_marks?: number[]
          couple_id?: string
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          is_lunar?: boolean
          kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "anniversaries_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anniversaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      couples: {
        Row: {
          cover_path: string | null
          created_at: string
          day_every: number | null
          day_marks: number[]
          id: string
          invite_code: string
          started_on: string
          us_color: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          day_every?: number | null
          day_marks?: number[]
          id?: string
          invite_code: string
          started_on: string
          us_color?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          day_every?: number | null
          day_marks?: number[]
          id?: string
          invite_code?: string
          started_on?: string
          us_color?: string
        }
        Relationships: []
      }
      event_comments: {
        Row: {
          body: string
          couple_id: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          couple_id?: string
          created_at?: string
          event_id: string
          id?: string
          user_id?: string
        }
        Update: {
          body?: string
          couple_id?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reactions: {
        Row: {
          couple_id: string
          created_at: string
          emoji: string
          event_id: string
          user_id: string
        }
        Insert: {
          couple_id?: string
          created_at?: string
          emoji: string
          event_id: string
          user_id?: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          emoji?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reactions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          event_id: string
          occ_key: string
          sent_at: string
        }
        Insert: {
          event_id: string
          occ_key: string
          sent_at?: string
        }
        Update: {
          event_id?: string
          occ_key?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_secrets: {
        Row: {
          event_id: string
          location: string | null
          memo: string | null
          title: string
          user_id: string
        }
        Insert: {
          event_id: string
          location?: string | null
          memo?: string | null
          title: string
          user_id?: string
        }
        Update: {
          event_id?: string
          location?: string | null
          memo?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_secrets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_secrets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          couple_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          ends_at: string | null
          exdates: string[]
          hidden: boolean
          id: string
          is_private: boolean
          location: string | null
          memo: string | null
          owner_id: string | null
          rrule: string | null
          start_date: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          couple_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          ends_at?: string | null
          exdates?: string[]
          hidden?: boolean
          id?: string
          is_private?: boolean
          location?: string | null
          memo?: string | null
          owner_id?: string | null
          rrule?: string | null
          start_date?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          couple_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          ends_at?: string | null
          exdates?: string[]
          hidden?: boolean
          id?: string
          is_private?: boolean
          location?: string | null
          memo?: string | null
          owner_id?: string | null
          rrule?: string | null
          start_date?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_busy: {
        Row: {
          all_day: boolean
          calendar_id: string
          couple_id: string | null
          end_date: string | null
          ends_at: string | null
          id: number
          start_date: string | null
          starts_at: string | null
          user_id: string
        }
        Insert: {
          all_day: boolean
          calendar_id: string
          couple_id?: string | null
          end_date?: string | null
          ends_at?: string | null
          id?: never
          start_date?: string | null
          starts_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean
          calendar_id?: string
          couple_id?: string | null
          end_date?: string | null
          ends_at?: string | null
          id?: never
          start_date?: string | null
          starts_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_busy_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "external_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_busy_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_busy_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendars: {
        Row: {
          created_at: string
          ics_url: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ics_url: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ics_url?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_tokens: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      keepalive: {
        Row: {
          id: number
          note: string
          pinged_at: string
        }
        Insert: {
          id?: never
          note?: string
          pinged_at?: string
        }
        Update: {
          id?: never
          note?: string
          pinged_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          couple_id: string
          created_at: string
          deferred: boolean
          id: string
          kind: string
          read_at: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          body?: string
          couple_id: string
          created_at?: string
          deferred?: boolean
          id?: string
          kind: string
          read_at?: string | null
          title: string
          url?: string
          user_id: string
        }
        Update: {
          body?: string
          couple_id?: string
          created_at?: string
          deferred?: boolean
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_likes: {
        Row: {
          couple_id: string
          created_at: string
          photo_id: string
          user_id: string
        }
        Insert: {
          couple_id?: string
          created_at?: string
          photo_id: string
          user_id?: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          caption: string | null
          couple_id: string
          created_at: string
          created_by: string | null
          day_order: number | null
          event_id: string | null
          height: number | null
          id: string
          kind: string
          path: string
          taken_on: string
          thumb_path: string
          width: number | null
        }
        Insert: {
          caption?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string | null
          day_order?: number | null
          event_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          path: string
          taken_on: string
          thumb_path: string
          width?: number | null
        }
        Update: {
          caption?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string | null
          day_order?: number | null
          event_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          path?: string
          taken_on?: string
          thumb_path?: string
          width?: number | null
        }
        Relationships: []
      }
      poker_games: {
        Row: {
          base_q: number
          couple_id: string
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          max_q: number
          round_no: number
          status: string
          water_q: number
        }
        Insert: {
          base_q?: number
          couple_id?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          max_q?: number
          round_no?: number
          status?: string
          water_q?: number
        }
        Update: {
          base_q?: number
          couple_id?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          max_q?: number
          round_no?: number
          status?: string
          water_q?: number
        }
        Relationships: [
          {
            foreignKeyName: "poker_games_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_hands: {
        Row: {
          card: number
          couple_id: string
          round_id: string
          user_id: string
        }
        Insert: {
          card: number
          couple_id?: string
          round_id: string
          user_id: string
        }
        Update: {
          card?: number
          couple_id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poker_hands_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_hands_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "poker_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_hands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_peeks: {
        Row: {
          couple_id: string
          hint: string
          round_id: string
          user_id: string
        }
        Insert: {
          couple_id?: string
          hint: string
          round_id: string
          user_id: string
        }
        Update: {
          couple_id?: string
          hint?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poker_peeks_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_peeks_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "poker_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_peeks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_players: {
        Row: {
          couple_id: string
          drunk_q: number
          game_id: string
          half_left: number
          joined_at: string
          lose_streak: number
          peek_left: number
          user_id: string
        }
        Insert: {
          couple_id?: string
          drunk_q?: number
          game_id: string
          half_left?: number
          joined_at?: string
          lose_streak?: number
          peek_left?: number
          user_id: string
        }
        Update: {
          couple_id?: string
          drunk_q?: number
          game_id?: string
          half_left?: number
          joined_at?: string
          lose_streak?: number
          peek_left?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poker_players_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "poker_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_rounds: {
        Row: {
          couple_id: string
          created_at: string
          drink_q: number | null
          ended_at: string | null
          first_user: string
          game_id: string
          half_used: boolean
          id: string
          last_action: string | null
          last_actor: string | null
          loser_id: string | null
          peeked_by: string[]
          pot_q: number
          result: string | null
          round_no: number
          status: string
          turn_user: string | null
          winner_id: string | null
        }
        Insert: {
          couple_id?: string
          created_at?: string
          drink_q?: number | null
          ended_at?: string | null
          first_user: string
          game_id: string
          half_used?: boolean
          id?: string
          last_action?: string | null
          last_actor?: string | null
          loser_id?: string | null
          peeked_by?: string[]
          pot_q: number
          result?: string | null
          round_no: number
          status?: string
          turn_user?: string | null
          winner_id?: string | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          drink_q?: number | null
          ended_at?: string | null
          first_user?: string
          game_id?: string
          half_used?: boolean
          id?: string
          last_action?: string | null
          last_actor?: string | null
          loser_id?: string | null
          peeked_by?: string[]
          pot_q?: number
          result?: string | null
          round_no?: number
          status?: string
          turn_user?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poker_rounds_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "poker_games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string
          birthday: string | null
          birthday_is_lunar: boolean
          color: string
          couple_id: string | null
          created_at: string
          id: string
          nickname: string
          notify_off: string[]
          photo_path: string | null
          quiet_hours: boolean
        }
        Insert: {
          avatar?: string
          birthday?: string | null
          birthday_is_lunar?: boolean
          color?: string
          couple_id?: string | null
          created_at?: string
          id: string
          nickname?: string
          notify_off?: string[]
          photo_path?: string | null
          quiet_hours?: boolean
        }
        Update: {
          avatar?: string
          birthday?: string | null
          birthday_is_lunar?: boolean
          color?: string
          couple_id?: string | null
          created_at?: string
          id?: string
          nickname?: string
          notify_off?: string[]
          photo_path?: string | null
          quiet_hours?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_templates: {
        Row: {
          all_day: boolean
          couple_id: string
          created_at: string
          created_by: string | null
          emoji: string
          end_time: string | null
          id: string
          location: string | null
          owner_id: string | null
          repeat: string | null
          sort_order: number
          start_time: string | null
          title: string
        }
        Insert: {
          all_day?: boolean
          couple_id?: string
          created_at?: string
          created_by?: string | null
          emoji?: string
          end_time?: string | null
          id?: string
          location?: string | null
          owner_id?: string | null
          repeat?: string | null
          sort_order?: number
          start_time?: string | null
          title: string
        }
        Update: {
          all_day?: boolean
          couple_id?: string
          created_at?: string
          created_by?: string | null
          emoji?: string
          end_time?: string | null
          id?: string
          location?: string | null
          owner_id?: string | null
          repeat?: string | null
          sort_order?: number
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_templates_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishes: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string | null
          done: boolean
          event_id: string | null
          id: string
          memo: string | null
          photo_url: string | null
          photos: string[]
          place_address: string | null
          place_id: string | null
          place_name: string | null
          place_x: number | null
          place_y: number | null
          tag: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          event_id?: string | null
          id?: string
          memo?: string | null
          photo_url?: string | null
          photos?: string[]
          place_address?: string | null
          place_id?: string | null
          place_name?: string | null
          place_x?: number | null
          place_y?: number | null
          tag?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          event_id?: string | null
          id?: string
          memo?: string | null
          photo_url?: string | null
          photos?: string[]
          place_address?: string | null
          place_id?: string | null
          place_name?: string | null
          place_x?: number | null
          place_y?: number | null
          tag?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishes_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_couple: {
        Args: { p_started_on: string }
        Returns: {
          cover_path: string | null
          created_at: string
          day_every: number | null
          day_marks: number[]
          id: string
          invite_code: string
          started_on: string
          us_color: string
        }
        SetofOptions: {
          from: "*"
          to: "couples"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_invite_code: { Args: never; Returns: string }
      join_couple: {
        Args: { p_code: string }
        Returns: {
          cover_path: string | null
          created_at: string
          day_every: number | null
          day_marks: number[]
          id: string
          invite_code: string
          started_on: string
          us_color: string
        }
        SetofOptions: {
          from: "*"
          to: "couples"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      poker_act: {
        Args: { p_action: string; p_round: string }
        Returns: undefined
      }
      poker_end: { Args: { p_game: string }; Returns: undefined }
      poker_join: { Args: { p_game: string }; Returns: undefined }
      poker_next_round: { Args: { p_game: string }; Returns: string }
      poker_open: {
        Args: { p_base?: number; p_max?: number; p_water?: number }
        Returns: string
      }
      poker_peek: { Args: { p_round: string }; Returns: string }
      poker_use_half: { Args: { p_round: string }; Returns: number }
      rotate_feed_token: { Args: never; Returns: string }
      save_event: {
        Args: { p: Json }
        Returns: {
          all_day: boolean
          couple_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          ends_at: string | null
          exdates: string[]
          hidden: boolean
          id: string
          is_private: boolean
          location: string | null
          memo: string | null
          owner_id: string | null
          rrule: string | null
          start_date: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

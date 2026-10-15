
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attendees": {
                  Row: {
                    "member_id": string,"minutes_played": number | null,"present": boolean,"rsvp": Database["public"]['Enums']["rsvp_status"] | null,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "member_id": string,"minutes_played"?: number | null,"present"?: boolean,"rsvp"?: Database["public"]['Enums']["rsvp_status"] | null,"session_id": string
                  }
                  Update: {
                    "member_id"?: string,"minutes_played"?: number | null,"present"?: boolean,"rsvp"?: Database["public"]['Enums']["rsvp_status"] | null,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendees_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendees_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"after": Json | null,"at": string,"before": Json | null,"entity": string,"entity_id": string,"group_id": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"entity": string,"entity_id": string,"group_id": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"entity"?: string,"entity_id"?: string,"group_id"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_member_id_fkey"
      columns: ["actor_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "body": string,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"group_id": string,"id": number,"member_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"group_id": string,"id"?: never,"member_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"group_id"?: string,"id"?: never,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_messages_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_messages_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"court_scorers": {
                  Row: {
                    "assigned_at": string,"court_no": number,"member_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"court_no": number,"member_id": string,"session_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"court_no"?: number,"member_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "court_scorers_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "court_scorers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_shares": {
                  Row: {
                    "amount": number,"expense_id": string,"member_id": string,"weight": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"expense_id": string,"member_id": string,"weight"?: number | null
                  }
                  Update: {
                    "amount"?: number,"expense_id"?: string,"member_id"?: string,"weight"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_shares_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_shares_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"meta": Json | null,"mode": Database["public"]['Enums']["split_mode"],"name": string,"paid_by": string,"preset": string | null,"session_id": string,"split_all": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"meta"?: Json | null,"mode"?: Database["public"]['Enums']["split_mode"],"name": string,"paid_by": string,"preset"?: string | null,"session_id": string,"split_all"?: boolean
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"meta"?: Json | null,"mode"?: Database["public"]['Enums']["split_mode"],"name"?: string,"paid_by"?: string,"preset"?: string | null,"session_id"?: string,"split_all"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "game_no": number,"match_id": string,"score_a": number,"score_b": number
                  }
                  ComputedFields: never
                  Insert: {
                    "game_no": number,"match_id": string,"score_a"?: number,"score_b"?: number
                  }
                  Update: {
                    "game_no"?: number,"match_id"?: string,"score_a"?: number,"score_b"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"group_moments": {
                  Row: {
                    "caption": string | null,"created_at": string,"group_id": string,"id": string,"image_path": string,"member_id": string,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"group_id": string,"id"?: string,"image_path": string,"member_id": string,"session_id"?: string | null
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"group_id"?: string,"id"?: string,"image_path"?: string,"member_id"?: string,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_moments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_moments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_moments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"default_play_mode": Database["public"]['Enums']["play_mode"],"emoji": string | null,"id": string,"invite_code": string,"is_public": boolean,"logo_path": string | null,"match_games": number,"name": string,"owner_id": string,"round_to": number,"rules": NonNullable<Json>,"scoring": NonNullable<Json>,"theme": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"default_play_mode"?: Database["public"]['Enums']["play_mode"],"emoji"?: string | null,"id"?: string,"invite_code"?: string,"is_public"?: boolean,"logo_path"?: string | null,"match_games"?: number,"name": string,"owner_id": string,"round_to"?: number,"rules"?: NonNullable<Json>,"scoring"?: NonNullable<Json>,"theme"?: string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"default_play_mode"?: Database["public"]['Enums']["play_mode"],"emoji"?: string | null,"id"?: string,"invite_code"?: string,"is_public"?: boolean,"logo_path"?: string | null,"match_games"?: number,"name"?: string,"owner_id"?: string,"round_to"?: number,"rules"?: NonNullable<Json>,"scoring"?: NonNullable<Json>,"theme"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"match_players": {
                  Row: {
                    "match_id": string,"member_id": string,"side": string
                  }
                  ComputedFields: never
                  Insert: {
                    "match_id": string,"member_id": string,"side": string
                  }
                  Update: {
                    "match_id"?: string,"member_id"?: string,"side"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_players_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_players_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "bracket_round": number | null,"bracket_slot": number | null,"completed_at": string | null,"court_no": number | null,"created_at": string,"entry_a": number | null,"entry_b": number | null,"games_max": number | null,"id": string,"kind": Database["public"]['Enums']["match_kind"],"report_job_id": string | null,"rules": Json | null,"seq": number,"serving": string | null,"session_id": string,"status": Database["public"]['Enums']["match_status"],"tournament_id": string | null,"video_url": string | null,"winner": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bracket_round"?: number | null,"bracket_slot"?: number | null,"completed_at"?: string | null,"court_no"?: number | null,"created_at"?: string,"entry_a"?: number | null,"entry_b"?: number | null,"games_max"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["match_kind"],"report_job_id"?: string | null,"rules"?: Json | null,"seq": number,"serving"?: string | null,"session_id": string,"status"?: Database["public"]['Enums']["match_status"],"tournament_id"?: string | null,"video_url"?: string | null,"winner"?: string | null
                  }
                  Update: {
                    "bracket_round"?: number | null,"bracket_slot"?: number | null,"completed_at"?: string | null,"court_no"?: number | null,"created_at"?: string,"entry_a"?: number | null,"entry_b"?: number | null,"games_max"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["match_kind"],"report_job_id"?: string | null,"rules"?: Json | null,"seq"?: number,"serving"?: string | null,"session_id"?: string,"status"?: Database["public"]['Enums']["match_status"],"tournament_id"?: string | null,"video_url"?: string | null,"winner"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "chat_read_id": number | null,"claim_token": string | null,"created_at": string,"display_name": string,"grade": Database["public"]['Enums']["grade"] | null,"group_id": string,"id": string,"is_active": boolean,"kiko": Json | null,"role": Database["public"]['Enums']["member_role"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "chat_read_id"?: number | null,"claim_token"?: string | null,"created_at"?: string,"display_name": string,"grade"?: Database["public"]['Enums']["grade"] | null,"group_id": string,"id"?: string,"is_active"?: boolean,"kiko"?: Json | null,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string | null
                  }
                  Update: {
                    "chat_read_id"?: number | null,"claim_token"?: string | null,"created_at"?: string,"display_name"?: string,"grade"?: Database["public"]['Enums']["grade"] | null,"group_id"?: string,"id"?: string,"is_active"?: boolean,"kiko"?: Json | null,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_infos": {
                  Row: {
                    "account_name": string | null,"account_no": string | null,"created_at": string,"id": string,"kind": string,"label": string,"member_id": string,"qr_image_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name"?: string | null,"account_no"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"label": string,"member_id": string,"qr_image_path"?: string | null
                  }
                  Update: {
                    "account_name"?: string | null,"account_no"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"label"?: string,"member_id"?: string,"qr_image_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_infos_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seasons": {
                  Row: {
                    "closed_at": string | null,"ends_on": string | null,"group_id": string,"id": string,"name": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"ends_on"?: string | null,"group_id": string,"id"?: string,"name": string,"starts_on": string
                  }
                  Update: {
                    "closed_at"?: string | null,"ends_on"?: string | null,"group_id"?: string,"id"?: string,"name"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasons_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "bill_version": number,"court_count": number,"created_at": string,"created_by": string | null,"duration_min": number | null,"fixed_pairs": Json | null,"group_id": string,"id": string,"kocok_seed": number | null,"match_games": number | null,"note": string | null,"play_mode": Database["public"]['Enums']["play_mode"],"recap_public": boolean,"rotation_queue": (string)[] | null,"rules": Json | null,"season_id": string | null,"share_token": string,"shuttle_per_slop": number,"shuttle_price_per_slop": number | null,"shuttles_used": number,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"venue": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bill_version"?: number,"court_count"?: number,"created_at"?: string,"created_by"?: string | null,"duration_min"?: number | null,"fixed_pairs"?: Json | null,"group_id": string,"id"?: string,"kocok_seed"?: number | null,"match_games"?: number | null,"note"?: string | null,"play_mode"?: Database["public"]['Enums']["play_mode"],"recap_public"?: boolean,"rotation_queue"?: (string)[] | null,"rules"?: Json | null,"season_id"?: string | null,"share_token"?: string,"shuttle_per_slop"?: number,"shuttle_price_per_slop"?: number | null,"shuttles_used"?: number,"starts_at": string,"status"?: Database["public"]['Enums']["session_status"],"venue"?: string | null
                  }
                  Update: {
                    "bill_version"?: number,"court_count"?: number,"created_at"?: string,"created_by"?: string | null,"duration_min"?: number | null,"fixed_pairs"?: Json | null,"group_id"?: string,"id"?: string,"kocok_seed"?: number | null,"match_games"?: number | null,"note"?: string | null,"play_mode"?: Database["public"]['Enums']["play_mode"],"recap_public"?: boolean,"rotation_queue"?: (string)[] | null,"rules"?: Json | null,"season_id"?: string | null,"share_token"?: string,"shuttle_per_slop"?: number,"shuttle_price_per_slop"?: number | null,"shuttles_used"?: number,"starts_at"?: string,"status"?: Database["public"]['Enums']["session_status"],"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "amount": number,"from_member": string,"id": string,"paid_at": string | null,"self_reported": boolean,"session_id": string,"status": Database["public"]['Enums']["pay_status"],"to_member": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"from_member": string,"id"?: string,"paid_at"?: string | null,"self_reported"?: boolean,"session_id": string,"status"?: Database["public"]['Enums']["pay_status"],"to_member": string
                  }
                  Update: {
                    "amount"?: number,"from_member"?: string,"id"?: string,"paid_at"?: string | null,"self_reported"?: boolean,"session_id"?: string,"status"?: Database["public"]['Enums']["pay_status"],"to_member"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_from_member_fkey"
      columns: ["from_member"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_to_member_fkey"
      columns: ["to_member"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_entries": {
                  Row: {
                    "group_no": number | null,"player1": string,"player2": string | null,"seed": number,"tournament_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_no"?: number | null,"player1": string,"player2"?: string | null,"seed": number,"tournament_id": string
                  }
                  Update: {
                    "group_no"?: number | null,"player1"?: string,"player2"?: string | null,"seed"?: number,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_entries_player1_fkey"
      columns: ["player1"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_entries_player2_fkey"
      columns: ["player2"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_entries_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournaments": {
                  Row: {
                    "advance_count": number | null,"created_at": string,"created_by": string | null,"format": string,"group_count": number | null,"group_id": string,"id": string,"kind": Database["public"]['Enums']["match_kind"],"name": string,"seeding": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advance_count"?: number | null,"created_at"?: string,"created_by"?: string | null,"format"?: string,"group_count"?: number | null,"group_id": string,"id"?: string,"kind": Database["public"]['Enums']["match_kind"],"name": string,"seeding": string,"session_id": string
                  }
                  Update: {
                    "advance_count"?: number | null,"created_at"?: string,"created_by"?: string | null,"format"?: string,"group_count"?: number | null,"group_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["match_kind"],"name"?: string,"seeding"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournaments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournaments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournaments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assign_seasons":
{ Args: { "p_group": string }; Returns: undefined
                           },
"create_group":
{ Args: { "p_display_name": string,"p_emoji": string,"p_name": string,"p_owner": string }; Returns: string
                           },
"create_session":
{ Args: { "p_attendees": (string)[],"p_creator": string,"p_expenses": Json,"p_group": string,"p_session": Json }; Returns: string
                           },
"create_tournament":
{ Args: { "p_advance_count": number,"p_created_by": string,"p_entries": Json,"p_format": string,"p_group_count": number,"p_kind": Database["public"]['Enums']["match_kind"],"p_name": string,"p_seeding": string,"p_session": string }; Returns: string
                           },
"delete_group":
{ Args: { "p_group": string }; Returns: undefined
                           },
"delete_tournament":
{ Args: { "p_tournament": string }; Returns: undefined
                           },
"expense_snapshot":
{ Args: { "p_expense": string }; Returns: Json
                           },
"gen_token":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"insert_match":
{ Args: { "p_match": Json,"p_session": string,"p_status": Database["public"]['Enums']["match_status"] }; Returns: string
                           },
"match_snapshot":
{ Args: { "p_match": string }; Returns: Json
                           },
"record_result":
{ Args: { "p_match": string,"p_next": Json,"p_queue": (string)[],"p_result": Json,"p_session": string }; Returns: string
                           },
"request_actor":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"save_bill":
{ Args: { "p_expense": Json,"p_op": string,"p_present": (string)[],"p_session": string,"p_settlements": Json,"p_shares": Json,"p_version": number }; Returns: number
                           },
"set_live_score":
{ Args: { "p_games": Json,"p_match": string,"p_serving": string }; Returns: undefined
                           },
"set_payment_status":
{ Args: { "p_action": string,"p_paid_at": string,"p_session": string,"p_settlement": string }; Returns: boolean
                           },
"start_matches":
{ Args: { "p_matches": Json,"p_queue": (string)[],"p_seed": number,"p_session": string }; Returns: (string)[]
                           },
"void_match":
{ Args: { "p_match": string,"p_queue": (string)[],"p_session": string }; Returns: undefined
                           },
"write_games":
{ Args: { "p_games": Json,"p_match": string }; Returns: undefined
                           },
"write_match_players":
{ Args: { "p_match": string,"p_players": Json }; Returns: undefined
                           }
          }
          Enums: {
            "grade": "A"|"B"|"C"|"D","match_kind": "doubles"|"singles","match_status": "running"|"completed"|"void","member_role": "admin"|"referee"|"member","pay_status": "unpaid"|"paid","play_mode": "kocok"|"rotasi"|"fix_pasangan"|"round_robin","rsvp_status": "going"|"not_going"|"maybe","session_status": "planned"|"running"|"finished","split_mode": "equal"|"custom"|"weighted"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "grade": ["A", "B", "C", "D"],"match_kind": ["doubles", "singles"],"match_status": ["running", "completed", "void"],"member_role": ["admin", "referee", "member"],"pay_status": ["unpaid", "paid"],"play_mode": ["kocok", "rotasi", "fix_pasangan", "round_robin"],"rsvp_status": ["going", "not_going", "maybe"],"session_status": ["planned", "running", "finished"],"split_mode": ["equal", "custom", "weighted"]
          }
        }
} as const

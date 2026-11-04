
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "chapter_clovers": {
                  Row: {
                    "chapter_number": number,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_number": number,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "chapter_number"?: number,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapter_clovers_chapter_number_fkey"
      columns: ["chapter_number"]
isOneToOne: false
      referencedRelation: "community_chapters"
      referencedColumns: ["chapter_number"]
    }
                  ]
                },"comment_reports": {
                  Row: {
                    "comment_id": string,"created_at": string,"details": string | null,"id": string,"reason_code": string,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id": string,"created_at"?: string,"details"?: string | null,"id"?: string,"reason_code": string,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "comment_id"?: string,"created_at"?: string,"details"?: string | null,"id"?: string,"reason_code"?: string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_reports_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"chapter_number": number,"client_request_id": string,"created_at": string,"id": string,"moderated_at": string | null,"moderated_by": string | null,"moderation_reason": string | null,"pseudonym": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"chapter_number": number,"client_request_id": string,"created_at"?: string,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_reason"?: string | null,"pseudonym": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"chapter_number"?: number,"client_request_id"?: string,"created_at"?: string,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_reason"?: string | null,"pseudonym"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_chapter_number_fkey"
      columns: ["chapter_number"]
isOneToOne: false
      referencedRelation: "community_chapters"
      referencedColumns: ["chapter_number"]
    }
                  ]
                },"community_chapters": {
                  Row: {
                    "chapter_number": number,"created_at": string,"enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_number": number,"created_at"?: string,"enabled"?: boolean
                  }
                  Update: {
                    "chapter_number"?: number,"created_at"?: string,"enabled"?: boolean
                  }
                  Relationships: [

                  ]
                },"community_moderators": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"moderation_audit": {
                  Row: {
                    "action": string,"comment_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"moderator_id": string,"reason": string | null,"report_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"comment_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"moderator_id": string,"reason"?: string | null,"report_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"comment_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"moderator_id"?: string,"reason"?: string | null,"report_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_audit_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_audit_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "comment_reports"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "community_mutate":
{ Args: { "p_actor": string,"p_input": Json,"p_operation": string }; Returns: Json
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
  "public": {
          Enums: {

          }
        }
} as const

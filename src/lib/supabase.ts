// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          wallet_address: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          wallet_address: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description?: string;
          xmtp_group_id?: string;
          creator_id: string;
          created_at: string;
          is_active: boolean;
        };
        Insert: {
          name: string;
          description?: string;
          xmtp_group_id?: string;
          creator_id: string;
        };
      };
      proposals: {
        Row: {
          id: string;
          group_id: string;
          title: string;
          description?: string;
          proposal_type: string;
          options: any[];
          voting_deadline: string;
          created_by: string;
          created_at: string;
          status: string;
          xmtp_message_id?: string;
        };
        Insert: {
          group_id: string;
          title: string;
          description?: string;
          proposal_type: string;
          options: any[];
          voting_deadline: string;
          created_by: string;
          xmtp_message_id?: string;
        };
      };
    };
  };
}
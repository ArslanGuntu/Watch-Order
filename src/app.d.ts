/// <reference types="@supabase/supabase-js" />

declare global {
  namespace App {
    interface Locals {
      supabase: import('@supabase/supabase-js').SupabaseClient
    }
  }
}

export {}
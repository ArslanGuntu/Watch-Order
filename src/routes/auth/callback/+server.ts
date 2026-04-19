import { redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } from '$env/static/private'

export const GET = async ({ url }) => {
  const code = url.searchParams.get('code')
  
  if (code) {
    const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    await supabase.auth.exchangeCodeForSession(code)
  }
  
  throw redirect(303, '/app')
}
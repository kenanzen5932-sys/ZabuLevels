import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rotriajxffiwouamtocp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvdHJpYWp4ZmZpd291YW10b2NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjI3NTAsImV4cCI6MjA4NzE5ODc1MH0.bTu0eeyc1ndOAEZttV8AcCauureUxvJLlzrDOllvxEM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

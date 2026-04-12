import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rotriajxffiwouamtocp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvdHJpYWp4ZmZpd291YW10b2NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2MzA1NTcsImV4cCI6MjA1OTIwNjU1N30.p1VDvNx5r--V8tM-OCk0Y0kDWnFIotsRK3FhEB6clsc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

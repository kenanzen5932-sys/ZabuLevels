import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://supabseapi.trloca.com'
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3OTIzNzk2MCwiZXhwIjo0OTM0OTExNTYwLCJyb2xlIjoiYW5vbiJ9.p2pa9amOFoZ9Q3e35r25oK1SxM-zSFtQx4Xlme-k30I'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

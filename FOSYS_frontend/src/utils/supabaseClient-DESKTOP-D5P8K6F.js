import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lqfxbenyazhbxgnikmvu.supabase.co";

// MUST be anon key from your AUTH project
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZnhiZW55YXpoYnhnbmlrbXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODU2MzAsImV4cCI6MjA3Njk2MTYzMH0.VYu0qS8996i7iSCFxnFnPHaRbQCHV3rAUfoXxRo4DmY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,       // 🔥 stores the login session
    autoRefreshToken: true,     // 🔥 keeps the session alive
    detectSessionInUrl: true,   // 🔥 handles redirects
  },
});

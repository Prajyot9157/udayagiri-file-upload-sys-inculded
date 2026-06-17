import { createClient } from "@supabase/supabase-js";

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === "YOUR_SUPABASE_URL") {
    supabaseUrl = "https://mvqmobgmxuoqohospmae.supabase.co";
}

if (!supabaseAnonKey || supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY") {
    supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cW1vYmdteHVvcW9ob3NwbWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NjMxNDUsImV4cCI6MjA5NzIzOTE0NX0.3qn8FSQfUv1xCXUh3uKwcfJ5O3wx6G-yG612dQVRj0s";
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

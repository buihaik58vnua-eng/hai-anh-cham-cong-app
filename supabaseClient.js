import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ekskfjzuqvkvorfcegqe.supabase.co";

const supabaseKey = "sb_publishable_xxxxxxxxxxxxxxxxx";

export const supabase = createClient(supabaseUrl, supabaseKey);

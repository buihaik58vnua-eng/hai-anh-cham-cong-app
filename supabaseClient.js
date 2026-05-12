import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "DÁN_PROJECT_URL";
const supabaseKey = "DÁN_PUBLISHABLE_KEY";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

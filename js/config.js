// Browser-safe by design: the publishable key only identifies the project.
// All authorization lives in Postgres grants + RLS (see db/schema.sql).
export const SUPABASE_URL = "https://jgenasvgeyyigfnkdvxu.supabase.co";
export const SUPABASE_KEY = "sb_publishable_IBk3E0WRZIOj8DcAlpM70A_cQlKX7Yg";

// Login email → display name; will also drive the "who paid" default.
export const HOUSEHOLD = {
  "shawntanwr@gmail.com": "Shawn",
  "ongmy.claire@gmail.com": "Claire",
};

// Display names live in Supabase auth metadata (display_name, set once per
// account in the dashboard) — never in this repo: it is public, and Pages
// serves every client file to anyone.
export function displayNameFor(user) {
  const name = user?.user_metadata?.display_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

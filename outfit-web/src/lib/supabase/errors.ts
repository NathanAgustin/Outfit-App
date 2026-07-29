export function friendlySupabaseError(message: string): string {
  if (
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  ) {
    return "Database not set up yet. In Supabase, open SQL Editor, paste and run outfit-web/supabase/schema.sql, then refresh this page.";
  }

  if (message.includes("Bucket not found") || message.includes("clothing-images")) {
    return "Image storage not set up. Run outfit-web/supabase/schema.sql in Supabase SQL Editor, then refresh.";
  }

  if (
    message.includes("clothing_items_category_check") ||
    (message.includes("check constraint") && message.includes("category")) ||
    message.includes("violates check constraint")
  ) {
    return "Your database still needs an update for Dresses and Outerwear. In Supabase → SQL Editor, run outfit-web/supabase/migration_dress_outerwear_optional_slots.sql, then try again.";
  }

  if (message.includes("dress_id") || message.includes("outerwear_id")) {
    return "Your database is missing dress/outerwear columns. In Supabase → SQL Editor, run outfit-web/supabase/migration_dress_outerwear_optional_slots.sql, then try again.";
  }

  return message;
}

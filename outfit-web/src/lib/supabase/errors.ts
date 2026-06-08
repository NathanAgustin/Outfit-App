export function friendlySupabaseError(message: string): string {
  if (
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("relation") && message.includes("does not exist")
  ) {
    return "Database not set up yet. In Supabase, open SQL Editor, paste and run outfit-web/supabase/schema.sql, then refresh this page.";
  }

  if (message.includes("Bucket not found") || message.includes("clothing-images")) {
    return "Image storage not set up. Run outfit-web/supabase/schema.sql in Supabase SQL Editor, then refresh.";
  }

  return message;
}

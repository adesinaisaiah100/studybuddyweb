// lib/studyagent/resolve-course-id.ts
import { createClient } from "@/lib/supabase/client";

type ResolveCourseInput = {
  courseRef: string; // could be UUID, code like "TME224", or title
};

export async function resolveCourseIdForUser({ courseRef }: ResolveCourseInput) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Unauthorized");
  const ref = courseRef.trim();

  // 1) If caller already passed UUID, honor it if owned by user
  const { data: byId } = await supabase
    .from("courses")
    .select("id")
    .eq("id", ref)
    .eq("user_id", user.id)
    .maybeSingle();

  if (byId?.id) return byId.id;

  // 2) Try exact code match
  const { data: byCode } = await supabase
    .from("courses")
    .select("id")
    .eq("user_id", user.id)
    .ilike("code", ref)
    .maybeSingle();

  if (byCode?.id) return byCode.id;

  // 3) Try title fuzzy match
  const { data: byTitle, error } = await supabase
    .from("courses")
    .select("id, title")
    .eq("user_id", user.id)
    .ilike("title", `%${ref}%`)
    .limit(2);

  if (error) throw error;
  if (!byTitle || byTitle.length === 0) throw new Error("Course not found");
  if (byTitle.length > 1) throw new Error("Ambiguous course. Be more specific.");

  return byTitle[0].id;
}


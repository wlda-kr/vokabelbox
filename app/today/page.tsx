import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDueVocabulary } from "@/lib/actions/lessons";
import { TodaySession } from "./TodaySession";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const due = await getDueVocabulary(30);
  if (due.length === 0) {
    redirect("/");
  }

  return <TodaySession vocabulary={due} />;
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sortEstatesWithDefaultFirst } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ estates: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey ?? supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase
    .from("estates")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    estates: sortEstatesWithDefaultFirst(
      (data ?? []).map((estate) => ({
        id: estate.id,
        name: estate.name
      }))
    )
  });
}

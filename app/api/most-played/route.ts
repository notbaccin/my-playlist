import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();

    // Conta plays por faixa via RPC simples usando group by no Postgres.
    const { data, error } = await supabase.rpc("most_played_tracks", { limit_count: 20 });

    if (error) {
      // Fallback: se a function SQL ainda não foi criada, calcula em memória.
      const { data: logs, error: logsError } = await supabase
        .from("play_log")
        .select("spotify_id");
      if (logsError) throw logsError;

      const counts: Record<string, number> = {};
      for (const row of logs ?? []) {
        counts[row.spotify_id] = (counts[row.spotify_id] ?? 0) + 1;
      }
      const topIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id);

      if (topIds.length === 0) return NextResponse.json({ tracks: [] });

      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("*")
        .in("spotify_id", topIds);
      if (tracksError) throw tracksError;

      const merged = topIds.map((id) => ({
        ...tracks!.find((t) => t.spotify_id === id),
        play_count: counts[id]
      }));

      return NextResponse.json({ tracks: merged });
    }

    return NextResponse.json({ tracks: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

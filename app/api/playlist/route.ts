import { NextResponse } from "next/server";
import { getValidAccessToken, fetchPlaylistTracks } from "../../../lib/spotify";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    const playlistId = process.env.SPOTIFY_PLAYLIST_ID!;
    const tracks = await fetchPlaylistTracks(accessToken, playlistId);

    const supabase = getSupabase();

    // Marca todas as faixas atuais como membros e insere/atualiza cada uma
    const currentIds = tracks.map((t) => t.spotify_id);

    if (tracks.length > 0) {
      const { error: upsertError } = await supabase.from("tracks").upsert(
        tracks.map((t) => ({
          spotify_id: t.spotify_id,
          name: t.name,
          artist: t.artist,
          album: t.album,
          image_url: t.image_url,
          duration_ms: t.duration_ms,
          added_at: t.added_at,
          is_current_member: true
        })),
        { onConflict: "spotify_id", ignoreDuplicates: false }
      );
      if (upsertError) throw upsertError;
    }

    // Marca como "não é mais membro" quem saiu da playlist
    await supabase
      .from("tracks")
      .update({ is_current_member: false })
      .not("spotify_id", "in", `(${currentIds.map((id) => `"${id}"`).join(",") || "''"})`);

    const sorted = [...tracks].sort((a, b) => {
      const dateA = a.added_at ? new Date(a.added_at).getTime() : 0;
      const dateB = b.added_at ? new Date(b.added_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ tracks: sorted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

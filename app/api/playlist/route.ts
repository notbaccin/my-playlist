import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getValidAccessToken } from "../../../lib/spotify";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  headers(); 
  const supabase = getSupabase();

  try {
    const playlistId = (process.env.SPOTIFY_PLAYLIST_ID || "").trim().replace(/["']/g, "");
    const accessToken = await getValidAccessToken();

    const s1 = "spo";
    const s2 = "tify";
    const s3 = ".com";
    const domain = s1 + s2 + s3;

    const spotifyUrl = `https://api.${domain}/v1/playlists/${playlistId}/tracks`;

    const spotifyRes = await fetch(spotifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (spotifyRes.ok) {
      const data = await spotifyRes.json();
      
      const tracks = (data.items || []).map((item: any) => {
        const track = item.track;
        if (!track) return null;
        return {
          spotify_id: track.id,
          name: track.name,
          artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          album: track.album?.name || "",
          image_url: track.album?.images?.[0]?.url || "",
          duration_ms: track.duration_ms,
          added_at: item.added_at,
          is_current_member: true
        };
      }).filter(Boolean);

      const currentIds = tracks.map((t: any) => t.spotify_id);

      if (tracks.length > 0) {
        await supabase.from("tracks").upsert(
          tracks.map((t: any) => ({
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
      }

      if (currentIds.length > 0) {
        await supabase
          .from("tracks")
          .update({ is_current_member: false })
          .not("spotify_id", "in", `(${currentIds.join(",")})`); 
      }
    }
  } catch (syncError) {
    console.error("Sincronização em segundo plano falhou:", syncError);
  }

  try {
    const { data: dbTracks, error: dbError } = await supabase
      .from("tracks")
      .select("*")
      .eq("is_current_member", true);

    if (dbError) throw dbError;

    const sorted = (dbTracks || []).sort((a: any, b: any) => {
      const dateA = a.added_at ? new Date(a.added_at).getTime() : 0;
      const dateB = b.added_at ? new Date(b.added_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ tracks: sorted });
  } catch (err: any) {
    console.error("Erro ao buscar dados do Supabase:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
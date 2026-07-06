import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getValidAccessToken } from "../../../lib/spotify";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  headers(); 

  try {
    const accessToken = await getValidAccessToken();
    const playlistId = (process.env.SPOTIFY_PLAYLIST_ID || "").trim().replace(/["']/g, "");

    // 🔍 DIAGNÓSTICO: Fazendo o fetch manual para expor o payload real do Spotify
    const spotifyUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
    
    const spotifyRes = await fetch(spotifyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Se o Spotify der erro, ele vai cuspir o status E o texto bruto do erro na tela
    if (!spotifyRes.ok) {
      const errorText = await spotifyRes.text();
      throw new Error(`Spotify respondeu com ${spotifyRes.status}: ${errorText} | URL chamada: ${spotifyUrl}`);
    }

    const data = await spotifyRes.json();
    
    // Mapeia os dados brutos recebidos do Spotify
    const tracks = (data.items || []).map((item: any) => {
      const track = item.track;
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
    });

    const supabase = getSupabase();
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

    if (currentIds.length > 0) {
      await supabase
        .from("tracks")
        .update({ is_current_member: false })
        .not("spotify_id", "in", `(${currentIds.join(",")})`); 
    }

    const sorted = [...tracks].sort((a, b) => {
      const dateA = a.added_at ? new Date(a.added_at).getTime() : 0;
      const dateB = b.added_at ? new Date(b.added_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ tracks: sorted });
  } catch (err: any) {
    console.error("Erro crítico na rota da playlist:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
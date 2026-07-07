import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getValidAccessToken } from "../../../lib/spotify";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  headers(); 
  const supabase = getSupabase();
  let liveTracks: any[] = []; 

  try {
    const playlistId = (process.env.SPOTIFY_PLAYLIST_ID || "").trim().replace(/["']/g, "");
    const accessToken = await getValidAccessToken();

    const s1 = "spo";
    const s2 = "tify";
    const s3 = ".com";
    const domain = s1 + s2 + s3;

    const masterUrl = `https://api.${domain}/v1/playlists/${playlistId}/items?limit=1`;
    const masterRes = await fetch(masterUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    if (!masterRes.ok) {
      const errText = await masterRes.text();
      throw new Error(`Falha ao obter total da playlist: ${masterRes.status} - ${errText}`);
    }

    const masterData = await masterRes.json();
    const total = masterData.total || 0;

    const limit = 5;
    const offset = Math.max(0, total - limit);

    const spotifyUrl = `https://api.${domain}/v1/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`;
    const spotifyRes = await fetch(spotifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    if (!spotifyRes.ok) {
      const errText = await spotifyRes.text();
      throw new Error(`Falha ao buscar últimas faixas do Spotify: ${spotifyRes.status} - ${errText}`);
    }

    const data = await spotifyRes.json();
    
    liveTracks = (data.items || []).map((item: any) => {
      const track = item.item ?? item.track;
      if (!track) return null;
      return {
        spotify_id: track.id,
        name: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        album: track.album?.name || "",
        image_url: track.album?.images?.[0]?.url || "",
        duration_ms: track.duration_ms,
        preview_url: track.preview_url, 
        added_at: item.added_at,
        is_current_member: true
      };
    }).filter(Boolean);

    if (liveTracks.length > 0) {
      await supabase
        .from("tracks")
        .update({ is_current_member: false })
        .eq("is_current_member", true);

      const { error: upsertError } = await supabase.from("tracks").upsert(
        liveTracks.map((t: any) => ({
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

  } catch (syncError: any) {
    console.error("Erro crítico na sincronização:", syncError);
    return NextResponse.json({ error: `Falha de sincronização: ${syncError.message}` }, { status: 500 });
  }

  try {
    const { data: dbTracks, error: dbError } = await supabase
      .from("tracks")
      .select("*")
      .eq("is_current_member", true);

    if (dbError) throw dbError;

    const merged = (dbTracks || []).map((dbTrack: any) => {
      const match = liveTracks.find((t) => t.spotify_id === dbTrack.spotify_id);
      return {
        ...dbTrack,
        preview_url: match?.preview_url || null 
      };
    });

    const sorted = merged.sort((a: any, b: any) => {
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
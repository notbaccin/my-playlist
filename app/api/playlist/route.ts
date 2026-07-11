import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getValidAccessToken } from "../../../lib/spotify";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  headers(); 
  const supabase = getSupabase();
  let tracksToReturn: any[] = [];

  try {
    const playlistId = (process.env.SPOTIFY_PLAYLIST_ID || "").trim().replace(/["']/g, "");
    const accessToken = await getValidAccessToken();
    const domain = "spotify.com";

    const masterUrl = `https://api.${domain}/v1/playlists/${playlistId}/items?limit=1`;
    const masterRes = await fetch(masterUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    if (!masterRes.ok) {
      throw new Error(`Spotify respondeu com status: ${masterRes.status}`);
    }

    const masterData = await masterRes.json();
    const total = masterData.total || 0;

    const limit = Math.min(40, total);
    const offset = Math.max(0, total - limit);

    const spotifyUrl = `https://api.${domain}/v1/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`;
    const spotifyRes = await fetch(spotifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    if (!spotifyRes.ok) {
      throw new Error(`Falha no lote do Spotify: ${spotifyRes.status}`);
    }

    const data = await spotifyRes.json();
    
    const livePool = (data.items || []).map((item: any) => {
      const track = item.item ?? item.track;
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

    if (livePool.length > 0) {
      await supabase
        .from("tracks")
        .update({ is_current_member: false })
        .eq("is_current_member", true);

      await supabase.from("tracks").upsert(
        livePool.map((t: any) => ({
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

      tracksToReturn = livePool.sort((a: any, b: any) => {
        return new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime();
      });
    }

  } catch (syncError: any) {
    console.warn("⚠️ Modo de Segurança: Spotify indisponível. Carregando dados salvos no Supabase.", syncError.message);
  }

    try {
      const { data: dbTracks } = await supabase
        .from("tracks")
        .select("*")
        .eq("is_current_member", true);

      if (dbTracks && dbTracks.length > 0) {
        tracksToReturn = dbTracks.sort((a: any, b: any) => {
          return new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime();
        });
      }
    } catch (dbError) {
      console.error("Erro crítico no fallback do Supabase:", dbError);
    }
  }

  return NextResponse.json({ tracks: tracksToReturn });
}
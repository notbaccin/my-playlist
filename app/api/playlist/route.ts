import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  headers(); 

  try {
    const playlistId = (process.env.SPOTIFY_PLAYLIST_ID || "").trim().replace(/["']/g, "");
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      throw new Error(`Erro ao gerar token de servidor: ${tokenErr}`);
    }

    const tokenData = await tokenRes.json();
    const serverToken = tokenData.access_token;

    const spotifyUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
    const spotifyRes = await fetch(spotifyUrl, {
      headers: { Authorization: `Bearer ${serverToken}` },
    });

    if (!spotifyRes.ok) {
      const errorText = await spotifyRes.text();
      throw new Error(`Spotify respondeu com ${spotifyRes.status}: ${errorText}`);
    }

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

    const supabase = getSupabase();
    const currentIds = tracks.map((t: any) => t.spotify_id);

    if (tracks.length > 0) {
      const { error: upsertError } = await supabase.from("tracks").upsert(
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
      if (upsertError) throw upsertError;
    }

    if (currentIds.length > 0) {
      await supabase
        .from("tracks")
        .update({ is_current_member: false })
        .not("spotify_id", "in", `(${currentIds.join(",")})`); 
    }

    const sorted = [...tracks].sort((a: any, b: any) => {
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
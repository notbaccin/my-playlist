import { getSupabase } from "./supabase";

const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative"
].join(" ");

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function basicAuthHeader() {
  const raw = `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`;
  return "Basic " + Buffer.from(raw).toString("base64");
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader()
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
    })
  });

  if (!res.ok) {
    throw new Error(`Falha ao trocar code por token: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader()
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!res.ok) {
    throw new Error(`Falha ao renovar token: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

// Retorna um access_token válido, renovando via refresh_token se necessário.
export async function getValidAccessToken(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("spotify_auth")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data?.refresh_token) {
    throw new Error(
      "Nenhuma conta Spotify autorizada ainda. Acesse /api/spotify/login primeiro."
    );
  }

  const stillValid =
    data.access_token &&
    data.access_token_expires_at &&
    new Date(data.access_token_expires_at).getTime() - Date.now() > 60_000;

  if (stillValid) {
    return data.access_token as string;
  }

  const refreshed = await refreshAccessToken(data.refresh_token);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("spotify_auth")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: expiresAt,
      refresh_token: refreshed.refresh_token ?? data.refresh_token,
      updated_at: new Date().toISOString()
    })
    .eq("id", 1);

  return refreshed.access_token;
}

export async function saveTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  const supabase = getSupabase();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase.from("spotify_auth").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    access_token_expires_at: expiresAt,
    updated_at: new Date().toISOString()
  });
}

type SpotifyImage = { url: string; width: number; height: number };

export type NormalizedTrack = {
  spotify_id: string;
  name: string;
  artist: string;
  album: string;
  image_url: string | null;
  duration_ms: number;
  added_at: string | null;
};

function normalizeTrack(item: any, addedAt: string | null): NormalizedTrack | null {
  const track = item.track ?? item; // playlist item vs raw track object
  if (!track || !track.id) return null;
  const images: SpotifyImage[] = track.album?.images ?? [];
  return {
    spotify_id: track.id,
    name: track.name,
    artist: (track.artists ?? []).map((a: any) => a.name).join(", "),
    album: track.album?.name ?? "",
    image_url: images[0]?.url ?? null,
    duration_ms: track.duration_ms ?? 0,
    added_at: addedAt
  };
}

export async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<NormalizedTrack[]> {
  const tracks: NormalizedTrack[] = [];
  let url =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks` +
    `?fields=next,items(added_at,track(id,name,duration_ms,artists(name),album(name,images)))&limit=100`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Erro ao buscar playlist: ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    for (const item of json.items ?? []) {
      const normalized = normalizeTrack(item, item.added_at ?? null);
      if (normalized) tracks.push(normalized);
    }
    url = json.next;
  }

  return tracks;
}

export type CurrentlyPlaying = {
  is_playing: boolean;
  track: NormalizedTrack | null;
  progress_ms: number | null;
};

export async function fetchCurrentlyPlaying(
  accessToken: string
): Promise<CurrentlyPlaying> {
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  // 204 = nada tocando no momento
  if (res.status === 204) {
    return { is_playing: false, track: null, progress_ms: null };
  }
  if (!res.ok) {
    throw new Error(`Erro ao buscar now-playing: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (!json || !json.item) {
    return { is_playing: false, track: null, progress_ms: null };
  }
  return {
    is_playing: json.is_playing,
    track: normalizeTrack(json.item, null),
    progress_ms: json.progress_ms ?? null
  };
}

// Duração aproximada de uma música: evita logar a mesma faixa repetidas
// vezes enquanto ela ainda está tocando.
const DEDUPE_WINDOW_MS = 3 * 60 * 1000;

// Busca a música atual e, se houver uma nova, registra em play_log.
// Usado tanto pela rota /api/now-playing (chamada pelo front) quanto
// pela rota /api/cron/poll (chamada por um cron externo).
export async function pollAndLogCurrentTrack(): Promise<CurrentlyPlaying> {
  const accessToken = await getValidAccessToken();
  const current = await fetchCurrentlyPlaying(accessToken);

  if (current.is_playing && current.track) {
    const supabase = getSupabase();
    const track = current.track;

    await supabase.from("tracks").upsert(
      {
        spotify_id: track.spotify_id,
        name: track.name,
        artist: track.artist,
        album: track.album,
        image_url: track.image_url,
        duration_ms: track.duration_ms
      },
      { onConflict: "spotify_id", ignoreDuplicates: false }
    );

    const { data: lastPlay } = await supabase
      .from("play_log")
      .select("spotify_id, played_at")
      .order("played_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isSameRecentPlay =
      lastPlay?.spotify_id === track.spotify_id &&
      Date.now() - new Date(lastPlay.played_at).getTime() < DEDUPE_WINDOW_MS;

    if (!isSameRecentPlay) {
      await supabase.from("play_log").insert({ spotify_id: track.spotify_id });
    }
  }

  return current;
}

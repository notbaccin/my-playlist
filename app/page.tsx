"use client";

import { useEffect, useRef, useState } from "react";

type Track = {
  spotify_id: string;
  name: string;
  artist: string;
  album: string;
  image_url: string | null;
  duration_ms: number;
  added_at?: string | null;
  play_count?: number;
};

type NowPlaying = {
  is_playing: boolean;
  track: Track | null;
  progress_ms: number | null;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks}sem`;
  const months = Math.floor(days / 30);
  return `há ${months}m`;
}

function isRecent(iso?: string | null, days = 3) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < days * 24 * 60 * 60 * 1000;
}

export default function Home() {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [recent, setRecent] = useState<Track[] | null>(null);
  const [mostPlayed, setMostPlayed] = useState<Track[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadNowPlaying() {
    try {
      const res = await fetch("/api/now-playing");
      const json = await res.json();
      if (json.error) {
        if (String(json.error).includes("Nenhuma conta")) setNeedsAuth(true);
        return;
      }
      setNeedsAuth(false);
      setNowPlaying(json);
      setLocalProgress(json.progress_ms);
    } catch {
      /* ignora falha pontual de rede */
    }
  }

  async function loadPlaylist() {
    try {
      const res = await fetch("/api/playlist");
      const json = await res.json();
      if (!json.error) setRecent(json.tracks);
    } catch {
      /* ignora */
    }
  }

  async function loadMostPlayed() {
    try {
      const res = await fetch("/api/most-played");
      const json = await res.json();
      if (!json.error) setMostPlayed(json.tracks);
    } catch {
      /* ignora */
    }
  }

  useEffect(() => {
    loadNowPlaying();
    loadPlaylist();
    loadMostPlayed();

    const nowPlayingPoll = setInterval(loadNowPlaying, 8000);
    const playlistPoll = setInterval(loadPlaylist, 60000);
    const mostPlayedPoll = setInterval(loadMostPlayed, 60000);

    return () => {
      clearInterval(nowPlayingPoll);
      clearInterval(playlistPoll);
      clearInterval(mostPlayedPoll);
    };
  }, []);

  // Barra de progresso local entre os polls de 8s, pra parecer fluida
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (nowPlaying?.is_playing) {
      tickRef.current = setInterval(() => {
        setLocalProgress((p) => (p !== null ? p + 1000 : p));
      }, 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [nowPlaying?.is_playing, nowPlaying?.track?.spotify_id]);

  const track = nowPlaying?.track;
  const duration = track?.duration_ms ?? 0;
  const progressPct =
    duration > 0 && localProgress !== null
      ? Math.min(100, (localProgress / duration) * 100)
      : 0;

  return (
    <main className="page">
      <div className="top-bar">
        <h1>Minha playlist</h1>
        <span className="subtitle">atualizado ao vivo</span>
      </div>

      {needsAuth ? (
        <div className="connect-card">
          Ainda não conectei à sua conta do Spotify.{" "}
          <a href="/api/spotify/login">Conectar agora</a>.
        </div>
      ) : (
        <div
          className="hero"
          style={{ "--tint": "rgba(250,45,72,0.3)" } as React.CSSProperties}
        >
          {track?.image_url && (
            <div
              className="hero-bg"
              style={{ backgroundImage: `url(${track.image_url})` }}
            />
          )}
          {track ? (
            <img className="hero-art" src={track.image_url ?? ""} alt={track.album} />
          ) : (
            <div className="hero-art-empty">nada tocando</div>
          )}
          <div className="hero-info">
            <div className="hero-eyebrow">
              {nowPlaying?.is_playing ? (
                <>
                  <span className="eq">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  tocando agora
                </>
              ) : (
                "em pausa"
              )}
            </div>
            <p className="hero-title">{track?.name ?? "Nada tocando no momento"}</p>
            <p className="hero-artist">{track?.artist ?? "Dá o play no Spotify"}</p>
            {track && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      <section>
        <h2 className="section-title">Adicionadas recentemente</h2>
        {recent === null ? (
          <p className="empty-state">Carregando…</p>
        ) : recent.length === 0 ? (
          <p className="empty-state">Nenhuma música na playlist ainda.</p>
        ) : (
          <div className="row-scroll">
            {recent.slice(0, 20).map((t) => (
              <div className="track-card" key={t.spotify_id}>
                {t.image_url ? (
                  <img src={t.image_url} alt={t.album} loading="lazy" />
                ) : (
                  <div className="art-fallback" />
                )}
                {isRecent(t.added_at) && <div className="badge-new">nova</div>}
                <div className="track-name">{t.name}</div>
                <div className="track-artist">{t.artist}</div>
                <div className="track-added">{timeAgo(t.added_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Mais tocadas</h2>
        {mostPlayed === null ? (
          <p className="empty-state">Carregando…</p>
        ) : mostPlayed.length === 0 ? (
          <p className="empty-state">
            Ainda não há dados suficientes — as reproduções vão aparecer aqui conforme o
            site for registrando o que você escuta.
          </p>
        ) : (
          <div className="rank-list">
            {mostPlayed.map((t, i) => (
              <div className="rank-row" key={t.spotify_id}>
                <div className="rank-number">{i + 1}</div>
                {t.image_url ? (
                  <img className="rank-art" src={t.image_url} alt={t.album} />
                ) : (
                  <div className="rank-art" />
                )}
                <div className="rank-info">
                  <div className="rank-name">{t.name}</div>
                  <div className="rank-artist">{t.artist}</div>
                </div>
                <div className="rank-count">{t.play_count}x</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Track = {
  spotify_id: string;
  name: string;
  artist: string;
  album: string;
  image_url: string | null;
  duration_ms: number;
  added_at?: string | null;
  play_count?: number;
  preview_url?: string | null;
};

type NowPlaying = {
  is_playing: boolean;
  track: Track | null;
  progress_ms: number | null;
};

const SECTIONS = [
  { id: "now-playing", label: "Ouvindo agora" },
  { id: "albums", label: "Álbuns" },
  { id: "recent", label: "Recentes" },
  { id: "most-played", label: "Mais tocadas" }
];

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

function formatDuration(ms?: number) {
  if (!ms) return "";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [recent, setRecent] = useState<Track[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [mostPlayed, setMostPlayed] = useState<Track[] | null>(null);
  const [mostPlayedError, setMostPlayedError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("now-playing");
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
      /* ignora falha pontual */
    }
  }

  async function loadPlaylist() {
    try {
      const res = await fetch("/api/playlist");
      const json = await res.json();
      if (json.error) {
        setRecentError(json.error);
      } else {
        setRecentError(null);
        setRecent(json.tracks);
      }
    } catch (err: any) {
      setRecentError(err?.message ?? "Falha de rede ao buscar a playlist.");
    }
  }

  async function loadMostPlayed() {
    try {
      const res = await fetch("/api/most-played");
      const json = await res.json();
      if (json.error) {
        setMostPlayedError(json.error);
      } else {
        setMostPlayedError(null);
        setMostPlayed(json.tracks);
      }
    } catch (err: any) {
      setMostPlayedError(err?.message ?? "Falha de rede ao buscar o ranking.");
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

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 50) {
        setActiveSection("now-playing");
        return;
      }

      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60;

      const activationLine = 110; 
      let currentSection = "now-playing";

      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= activationLine) {
            currentSection = s.id;
          }
        }
      }

      if (isAtBottom) {
        const existingSections = SECTIONS.filter((s) => document.getElementById(s.id));
        if (existingSections.length > 0) {
          currentSection = existingSections[existingSections.length - 1].id;
        }
      }

      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); 

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const track = nowPlaying?.track;
  const duration = track?.duration_ms ?? 0;
  const progressPct =
    duration > 0 && localProgress !== null
      ? Math.min(100, (localProgress / duration) * 100)
      : 0;

  const featuredAlbums = useMemo(() => {
    if (!mostPlayed) return [];
    const seen = new Set<string>();
    const albums: { key: string; album: string; artist: string; image_url: string | null }[] = [];
    for (const t of mostPlayed) {
      const key = `${t.album}::${t.artist}`;
      if (seen.has(key) || !t.image_url) continue;
      seen.add(key);
      albums.push({ key, album: t.album, artist: t.artist, image_url: t.image_url });
      if (albums.length >= 8) break;
    }
    return albums;
  }, [mostPlayed]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const backdropUrl = track?.image_url ?? recent?.[0]?.image_url ?? null;

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
        {backdropUrl && (
          <div
            key={backdropUrl}
            className="ambient-backdrop"
            style={{ backgroundImage: `url(${backdropUrl})` }}
          />
        )}
      </div>

      <nav className="topnav">
        <div className="topnav-inner">
          <div className="brand">バシン</div>
          <div className="segmented">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`segmented-item ${activeSection === s.id ? "active" : ""}`}
                onClick={() => scrollTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="page">
        {needsAuth ? (
          <div className="connect-card">
            Ainda não conectei à sua conta do Spotify.{" "}
            <a href="/api/spotify/login">Conectar agora</a>.
          </div>
        ) : (
          <section id="now-playing" className="hero-section">
            <div className="hero">
              {track?.image_url && (
                <div
                  className="hero-bg"
                  style={{ backgroundImage: `url(${track.image_url})` }}
                />
              )}
              <div className="hero-glass">
                <div className="hero-art-wrap">
                  {track ? (
                    <img className="hero-art" src={track.image_url ?? ""} alt={track.album} />
                  ) : (
                    <div className="hero-art-empty">nada tocando</div>
                  )}
                </div>
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
                  <p className="hero-artist">
                    {track ? `${track.artist} — ${track.album}` : "Dá o play no Spotify"}
                  </p>
                  {track && (
                    <>
                      <div className="apple-wave-wrapper">
                        <div className={`apple-wave-bars ${nowPlaying?.is_playing ? "playing" : "paused"}`}>
                          {Array.from({ length: 19 }).map((_, i) => (
                            <span key={i} className="wave-bar" />
                          ))}
                        </div>
                      </div>

                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                      <div className="progress-labels">
                        <span>{formatDuration(localProgress ?? 0)}</span>
                        <span>{formatDuration(duration)}</span>
                      </div>
                      <a
                        className="spotify-link"
                        href={`https://open.spotify.com/track/${track.spotify_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir no Spotify ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {featuredAlbums.length > 0 && (
          <section id="albums">
            <h2 className="section-title">Álbuns em destaque</h2>
            <p className="section-subtitle">Dos álbuns que você mais ouviu recentemente</p>
            <div className="album-grid">
              {featuredAlbums.map((a) => (
                <div className="album-tile" key={a.key}>
                  <img src={a.image_url ?? ""} alt={a.album} loading="lazy" />
                  <div className="album-tile-caption">
                    <div className="album-tile-name">{a.album}</div>
                    <div className="album-tile-artist">{a.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="recent">
          <h2 className="section-title">Adicionadas recentemente</h2>
          <p className="section-subtitle">Novidades da playlist, em ordem de chegada</p>
          {recentError ? (
            <p className="empty-state error-state">Erro ao carregar a playlist: {recentError}</p>
          ) : recent === null ? (
            <p className="empty-state">Carregando…</p>
          ) : recent.length === 0 ? (
            <p className="empty-state">Nenhuma música na playlist ainda.</p>
          ) : (
            <div className="row-scroll">
              {recent.slice(0, 24).map((t) => (
                <a
                  className="track-card"
                  key={t.spotify_id}
                  href={`https://open.spotify.com/track/${t.spotify_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="track-art-wrap">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.album} loading="lazy" />
                    ) : (
                      <div className="art-fallback" />
                    )}
                    {isRecent(t.added_at) && <div className="badge-new">nova</div>}
                  </div>
                  <div 
                    className="track-name" 
                    style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    title={t.name}
                    >
                      {t.name}
                  </div>
                  <div className="track-artist">{t.artist}</div>
                  <div className="track-added">{timeAgo(t.added_at)}</div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section id="most-played">
          <h2 className="section-title">Mais tocadas</h2>
          <p className="section-subtitle">Ranking calculado a partir do histórico de reproduções</p>
          {mostPlayedError ? (
            <p className="empty-state error-state">Erro ao carregar o ranking: {mostPlayedError}</p>
          ) : mostPlayed === null ? (
            <p className="empty-state">Carregando…</p>
          ) : mostPlayed.length === 0 ? (
            <p className="empty-state">
              Ainda não há dados suficientes — as reproduções vão aparecer aqui conforme o
              site for registrando o que você escuta.
            </p>
          ) : (
            <div className="rank-list">
              {mostPlayed.map((t, i) => (
                <a
                  className="rank-row"
                  key={t.spotify_id}
                  href={`https://open.spotify.com/track/${t.spotify_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="rank-number">{i + 1}</div>
                  {t.image_url ? (
                    <img className="rank-art" src={t.image_url} alt={t.album} />
                  ) : (
                    <div className="rank-art" />
                  )}
                  <div className="rank-info">
                    <div 
                        className="rank-name" 
                        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        title={t.name}
                      >
                        {t.name}
                    </div>
                    <div className="rank-artist">{t.artist}</div>
                  </div>
                  <div className="rank-count">{t.play_count}x</div>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>

      {track && (
        <div className="mini-player">
          <img className="mini-player-art" src={track.image_url ?? ""} alt={track.album} />
          <div className="mini-player-info">
            <div className="mini-player-name">{track.name}</div>
            <div className="mini-player-artist">{track.artist}</div>
          </div>
          <div className="mini-player-eq-wrap">
            {nowPlaying?.is_playing && (
              <span className="eq eq-mini">
                <span></span>
                <span></span>
                <span></span>
              </span>
            )}
          </div>
          <a
            className="mini-player-link"
            href={`https://open.spotify.com/track/${track.spotify_id}`}
            target="_blank"
            rel="noreferrer"
          >
            Abrir
          </a>
        </div>
      )}
    </>
  );
}
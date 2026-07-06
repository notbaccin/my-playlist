create table if not exists tracks (
  spotify_id text primary key,
  name text not null,
  artist text not null,
  album text not null,
  image_url text,
  duration_ms integer,
  added_at timestamptz,       
  first_seen_at timestamptz default now(), 
  is_current_member boolean default true  
);

create table if not exists play_log (
  id bigint generated always as identity primary key,
  spotify_id text not null references tracks(spotify_id),
  played_at timestamptz not null default now()
);

create index if not exists play_log_spotify_id_idx on play_log(spotify_id);
create index if not exists play_log_played_at_idx on play_log(played_at);

create table if not exists spotify_auth (
  id integer primary key default 1,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz default now()
);

insert into spotify_auth (id) values (1)
on conflict (id) do nothing;

create or replace function most_played_tracks(limit_count integer default 20)
returns table (
  spotify_id text,
  name text,
  artist text,
  album text,
  image_url text,
  duration_ms integer,
  play_count bigint
) as $$
  select
    t.spotify_id,
    t.name,
    t.artist,
    t.album,
    t.image_url,
    t.duration_ms,
    count(p.id) as play_count
  from tracks t
  join play_log p on p.spotify_id = t.spotify_id
  group by t.spotify_id, t.name, t.artist, t.album, t.image_url, t.duration_ms
  order by play_count desc
  limit limit_count;
$$ language sql stable;
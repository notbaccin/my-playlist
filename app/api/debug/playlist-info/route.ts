import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../../../lib/spotify";

export const dynamic = "force-dynamic";

// Rota só de diagnóstico: mostra quem está logado no site e quem é o
// dono da playlist, segundo o próprio Spotify — sem tocar no endpoint
// de itens (que é o que retorna 403). Ajuda a confirmar se o 403 é
// mesmo por falta de permissão de dono, ou é outra coisa.
export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    const playlistId = process.env.SPOTIFY_PLAYLIST_ID!;

    const [meRes, playlistRes] = await Promise.all([
      fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,public,collaborative,owner(id,display_name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    ]);

    const me = meRes.ok ? await meRes.json() : { error: await meRes.text(), status: meRes.status };
    const playlist = playlistRes.ok
      ? await playlistRes.json()
      : { error: await playlistRes.text(), status: playlistRes.status };

    return NextResponse.json({
      playlist_id_configurado: playlistId,
      conta_logada_no_site: {
        id: me.id,
        nome: me.display_name,
        erro: me.error ?? null
      },
      playlist: {
        nome: playlist.name,
        publica: playlist.public,
        colaborativa: playlist.collaborative,
        dono_id: playlist.owner?.id,
        dono_nome: playlist.owner?.display_name,
        erro: playlist.error ?? null
      },
      mesma_conta: me.id && playlist.owner?.id ? me.id === playlist.owner.id : null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

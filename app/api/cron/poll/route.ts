import { NextRequest, NextResponse } from "next/server";
import { pollAndLogCurrentTrack } from "../../../../lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await pollAndLogCurrentTrack();
    console.log("-> Cron: Status de reprodução e logs de audição atualizados.");
  } catch (err: any) {
    console.error("-> Cron Erro (Now Playing):", err.message);
  }

  try {
    const playlistUrl = new URL("/api/playlist", req.url);
    await fetch(playlistUrl.toString(), { cache: "no-store" });
    console.log("-> Cron: Playlist atualizada via requisição interna.");
  } catch (err: any) {
    console.error("-> Cron Erro (Playlist Sync):", err.message);
  }

  return NextResponse.json({ 
    ok: true, 
    message: "Sincronização completa de histórico e playlist executada com sucesso!" 
  });
}
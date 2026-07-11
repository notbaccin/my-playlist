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
    console.log("-> Cron: Histórico de audição verificado e atualizado.");
  } catch (err: any) {
    console.error("-> Cron Erro (Now Playing):", err.message);
  }

  return NextResponse.json({ 
    ok: true, 
    message: "Histórico de reprodução verificado com sucesso!" 
  });
}
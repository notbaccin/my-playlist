import { NextRequest, NextResponse } from "next/server";
import { pollAndLogCurrentTrack } from "../../../../lib/spotify";

export const dynamic = "force-dynamic";

// Chame esta rota periodicamente (Vercel Cron, GitHub Actions ou cron-job.org)
// com o header  Authorization: Bearer SEU_CRON_SECRET
// para registrar "plays" mesmo com ninguém olhando o site.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const current = await pollAndLogCurrentTrack();
    return NextResponse.json({ ok: true, current });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

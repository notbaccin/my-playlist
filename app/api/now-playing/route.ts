import { NextResponse } from "next/server";
import { pollAndLogCurrentTrack } from "../../../lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await pollAndLogCurrentTrack();
    return NextResponse.json(current);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

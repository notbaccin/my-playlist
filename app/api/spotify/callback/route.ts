import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens } from "../../../../lib/spotify";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieState = req.cookies.get("spotify_auth_state")?.value;

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ error: "state inválido ou ausente" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveTokens(tokens);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.delete("spotify_auth_state");
  return response;
}

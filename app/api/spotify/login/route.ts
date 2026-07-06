import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "../../../../lib/spotify";

export async function GET() {
  const state = Math.random().toString(36).slice(2);
  const url = buildAuthorizeUrl(state);

  const response = NextResponse.redirect(url);
  response.cookies.set("spotify_auth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/"
  });
  return response;
}

export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";
import { authOptions } from "../../../lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to access your account data." }, { status: 401 });
  }
  const secret = process.env.API_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    console.error("API_AUTH_SECRET must contain at least 32 characters.");
    return NextResponse.json({ error: "Account API is not configured." }, { status: 503 });
  }
  const token = jwt.sign({}, secret, {
    subject: session.user.id,
    issuer: "cookwhat-web",
    audience: "cookwhat-api",
    expiresIn: "5m",
  });
  return NextResponse.json({ token, expiresIn: 300 }, { headers: { "Cache-Control": "no-store" } });
}

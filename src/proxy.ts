import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PROTECTED = ["/dashboard", "/camp", "/activities", "/teachers", "/campers", "/schedule", "/print", "/settings", "/team", "/import"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("camp_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/camp/:path*", "/activities/:path*", "/teachers/:path*", "/campers/:path*", "/schedule/:path*", "/print/:path*", "/settings/:path*", "/team/:path*", "/import/:path*"],
};

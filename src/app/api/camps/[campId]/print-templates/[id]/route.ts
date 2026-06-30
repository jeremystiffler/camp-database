import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanSettings(value: unknown) {
  if (typeof value === "string") {
    try { JSON.parse(value); return value; } catch { return "{}"; }
  }
  try { return JSON.stringify(value && typeof value === "object" ? value : {}); } catch { return "{}"; }
}

async function authorize(campId: string, minRole: "viewer" | "editor" = "editor") {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const member = await getMember(session.userId, campId);
  if (!member || (minRole === "editor" && !hasPermission(member.role, "editor"))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { member };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const { campId, id } = await params;
  const auth = await authorize(campId, "editor");
  if (auth.error) return auth.error;

  try {
    const existing = await prisma.printTemplate.findFirst({ where: { campId, id } });
    if (!existing) return NextResponse.json({ error: "Print template not found" }, { status: 404 });
    const body = await req.json();
    const type = cleanString(body.type, existing.type);
    const isDefault = body.isDefault === undefined ? existing.isDefault : Boolean(body.isDefault);
    if (isDefault) await prisma.printTemplate.updateMany({ where: { campId, type, NOT: { id } }, data: { isDefault: false } });

    const item = await prisma.printTemplate.update({
      where: { id },
      data: {
        name: cleanString(body.name, existing.name),
        type,
        category: cleanString(body.category, existing.category),
        paperSize: cleanString(body.paperSize, existing.paperSize),
        orientation: cleanString(body.orientation, existing.orientation),
        settings: body.settings === undefined ? existing.settings : cleanSettings(body.settings),
        isDefault,
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Print template PATCH error:", error);
    return NextResponse.json({ error: "Failed to update print template", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const { campId, id } = await params;
  const auth = await authorize(campId, "editor");
  if (auth.error) return auth.error;

  await prisma.printTemplate.deleteMany({ where: { campId, id } });
  return NextResponse.json({ success: true });
}

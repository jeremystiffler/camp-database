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

function compact(template: Awaited<ReturnType<typeof prisma.printTemplate.findMany>>[number]) {
  return {
    ...template,
    settings: cleanSettings(template.settings),
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const items = await prisma.printTemplate.findMany({
      where: { campId },
      orderBy: [{ category: "asc" }, { type: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items.map(compact));
  } catch (error) {
    console.error("Print template GET error:", error);
    return NextResponse.json({ error: "Failed to load print templates", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can save print templates" }, { status: 403 });

  try {
    const body = await req.json();
    const type = cleanString(body.type, "custom_table");
    const name = cleanString(body.name, "New print template");
    const isDefault = Boolean(body.isDefault);

    if (isDefault) {
      await prisma.printTemplate.updateMany({ where: { campId, type }, data: { isDefault: false } });
    }

    const item = await prisma.printTemplate.create({
      data: {
        campId,
        name,
        type,
        category: cleanString(body.category, "operations"),
        paperSize: cleanString(body.paperSize, "letter"),
        orientation: cleanString(body.orientation, "portrait"),
        settings: cleanSettings(body.settings),
        isDefault,
      },
    });
    return NextResponse.json(compact(item), { status: 201 });
  } catch (error) {
    console.error("Print template POST error:", error);
    return NextResponse.json({ error: "Failed to save print template", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

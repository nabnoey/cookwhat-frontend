export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

type KitchenItemInput = {
  name: string;
  category: string;
  unit: string;
  remainingQuantity: number | null;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  packageSize?: string;
  ownedQuantity?: number;
  expiresOn?: string;
  note?: string;
  addedAt?: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isKitchenItem(item: unknown): item is KitchenItemInput {
  if (typeof item !== "object" || item === null) return false;
  if (!("name" in item) || typeof item.name !== "string" || !item.name.trim()) return false;
  if (!("category" in item) || typeof item.category !== "string") return false;
  if (!("unit" in item) || typeof item.unit !== "string") return false;
  if (!("remainingQuantity" in item) || (item.remainingQuantity !== null && (typeof item.remainingQuantity !== "number" || !Number.isFinite(item.remainingQuantity) || item.remainingQuantity < 0))) return false;
  if ("ownedQuantity" in item && item.ownedQuantity !== undefined && (typeof item.ownedQuantity !== "number" || !Number.isFinite(item.ownedQuantity) || item.ownedQuantity < 0)) return false;
  if ("barcode" in item && item.barcode !== undefined && typeof item.barcode !== "string") return false;
  if ("expiresOn" in item && item.expiresOn !== undefined && (typeof item.expiresOn !== "string" || Number.isNaN(Date.parse(item.expiresOn)))) return false;
  return true;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to sync your kitchen." }, { status: 401 });

  const [inventory, equipment, settings, diet, allergies, dislikes] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId: session.user.id }, include: { product: { select: { imageUrl: true } } }, orderBy: { addedAt: "desc" } }),
    prisma.kitchenEquipment.findMany({ where: { userId: session.user.id }, select: { name: true } }),
    prisma.userPreference.findUnique({ where: { userId: session.user.id } }),
    prisma.userDietaryPreference.findMany({ where: { userId: session.user.id }, select: { name: true } }),
    prisma.userAllergy.findMany({ where: { userId: session.user.id }, select: { name: true } }),
    prisma.userDislike.findMany({ where: { userId: session.user.id }, select: { name: true } }),
  ]);
  return NextResponse.json({
    inventory: inventory.map((item) => ({ ...item, imageUrl: item.product?.imageUrl ?? undefined, product: undefined, expiresOn: item.expiresOn?.toISOString().slice(0, 10) })),
    equipment: equipment.map((item) => item.name),
    preferences: {
      diet: diet.map((item) => item.name),
      allergies: allergies.map((item) => item.name),
      dislikes: dislikes.map((item) => item.name),
      maxCookingMinutes: settings?.maxCookingMinutes ?? null,
      skillLevel: settings?.skillLevel ?? "Any",
      servings: settings?.servings ?? 2,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to sync your kitchen." }, { status: 401 });
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) return NextResponse.json({ error: "Invalid kitchen data." }, { status: 400 });
  const value = body as Record<string, unknown>;
  const inventory = value.inventory;
  const equipment = value.equipment;
  const preferences = value.preferences;
  if (
    !Array.isArray(inventory) ||
    !inventory.every(isKitchenItem) ||
    !isStringArray(equipment) ||
    typeof preferences !== "object" ||
    preferences === null
  ) return NextResponse.json({ error: "Kitchen data is incomplete or invalid." }, { status: 400 });

  const preference = preferences as Record<string, unknown>;
  const servings = preference.servings;
  const maxCookingMinutes = preference.maxCookingMinutes;
  const skillLevel = preference.skillLevel;
  if (
    !isStringArray(preference.diet) ||
    !isStringArray(preference.allergies) ||
    !isStringArray(preference.dislikes) ||
    (maxCookingMinutes !== null && typeof maxCookingMinutes !== "number") ||
    (skillLevel !== "Any" && skillLevel !== "Easy" && skillLevel !== "Medium") ||
    typeof servings !== "number" ||
    !Number.isInteger(servings) ||
    servings < 1 ||
    servings > 12
  ) return NextResponse.json({ error: "Kitchen preferences are invalid." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.deleteMany({ where: { userId: session.user.id } });
    const data = [];
    for (const item of inventory) {
      const product = item.barcode
        ? await tx.product.upsert({
            where: { barcode: item.barcode },
            create: {
              barcode: item.barcode,
              name: item.name,
              brand: item.brand ?? "",
              imageUrl: item.imageUrl ?? "",
              category: item.category,
              packageSize: item.packageSize ?? "",
            },
            update: {
              name: item.name,
              brand: item.brand ?? "",
              imageUrl: item.imageUrl ?? "",
              category: item.category,
              packageSize: item.packageSize ?? "",
            },
            select: { id: true },
          })
        : null;
      data.push({
        userId: session.user.id,
        productId: product?.id,
        name: item.name.trim(),
        category: item.category,
        unit: item.unit,
        remainingQuantity: item.remainingQuantity,
        brand: item.brand,
        barcode: item.barcode,
        packageSize: item.packageSize,
        ownedQuantity: item.ownedQuantity,
        expiresOn: item.expiresOn ? new Date(item.expiresOn) : null,
        note: item.note,
        addedAt: item.addedAt && !Number.isNaN(Date.parse(item.addedAt)) ? new Date(item.addedAt) : new Date(),
      });
    }
    if (data.length) await tx.inventoryItem.createMany({ data });
    await tx.kitchenEquipment.deleteMany({ where: { userId: session.user.id } });
    if (equipment.length) {
      await tx.kitchenEquipment.createMany({
        data: Array.from(new Set(equipment.map((name) => name.trim()).filter(Boolean))).map((name) => ({ userId: session.user.id, name })),
      });
    }
    await tx.userPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        maxCookingMinutes: typeof maxCookingMinutes === "number" ? maxCookingMinutes : null,
        skillLevel,
        servings,
      },
      update: {
        maxCookingMinutes: typeof maxCookingMinutes === "number" ? maxCookingMinutes : null,
        skillLevel,
        servings,
      },
    });
    await tx.userDietaryPreference.deleteMany({ where: { userId: session.user.id } });
    await tx.userAllergy.deleteMany({ where: { userId: session.user.id } });
    await tx.userDislike.deleteMany({ where: { userId: session.user.id } });
    if ((preference.diet as string[]).length) {
      await tx.userDietaryPreference.createMany({
        data: (preference.diet as string[]).map((name) => ({ userId: session.user.id, name })),
      });
    }
    if ((preference.allergies as string[]).length) {
      await tx.userAllergy.createMany({
        data: (preference.allergies as string[]).map((name) => ({ userId: session.user.id, name })),
      });
    }
    if ((preference.dislikes as string[]).length) {
      await tx.userDislike.createMany({
        data: (preference.dislikes as string[]).map((name) => ({ userId: session.user.id, name })),
      });
    }
    return { inventory: data.length, equipment: equipment.length };
  });
  return NextResponse.json({ saved: true, ...result });
}

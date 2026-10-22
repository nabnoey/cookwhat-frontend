import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to view your recipes." }, { status: 401 });
  }
  const recipes = await prisma.recipe.findMany({
    where: { OR: [{ userId: session.user.id }, { userId: null }] },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to save a recipe." }, { status: 401 });
  }

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Invalid recipe." }, { status: 400 });
  }
  const values = payload as Record<string, unknown>;
  if (
    typeof values.title !== "string" ||
    !values.title.trim() ||
    typeof values.category !== "string" ||
    typeof values.cookingMinutes !== "number" ||
    !Number.isInteger(values.cookingMinutes) ||
    values.cookingMinutes < 1 ||
    typeof values.servings !== "number" ||
    !Number.isInteger(values.servings) ||
    values.servings < 1 ||
    !Array.isArray(values.ingredients) ||
    !values.ingredients.every((item) => typeof item === "string")
  ) {
    return NextResponse.json({ error: "Recipe details are incomplete or invalid." }, { status: 400 });
  }

  const recipe = await prisma.recipe.create({
    data: {
      userId: session.user.id,
      title: values.title.trim(),
      category: values.category,
      cookingMinutes: values.cookingMinutes,
      servings: values.servings,
      calories: typeof values.calories === "number" ? Math.max(0, Math.round(values.calories)) : 0,
      imageUrl: typeof values.imageUrl === "string" ? values.imageUrl : "",
      description: typeof values.description === "string" ? values.description : "",
      ingredients: JSON.stringify(values.ingredients),
    },
  });
  return NextResponse.json({ recipe }, { status: 201 });
}

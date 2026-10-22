import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MealInput = { recipeId: string; date: string; slot: string };

function isMealInput(meal: unknown): meal is MealInput {
  if (typeof meal !== "object" || meal === null) return false;
  return (
    "recipeId" in meal &&
    typeof meal.recipeId === "string" &&
    "date" in meal &&
    typeof meal.date === "string" &&
    !Number.isNaN(Date.parse(meal.date)) &&
    "slot" in meal &&
    ["breakfast", "lunch", "dinner"].includes(String(meal.slot))
  );
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to view your plan." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  if (!weekStart || Number.isNaN(Date.parse(weekStart))) {
    return NextResponse.json({ error: "A valid weekStart date is required." }, { status: 400 });
  }
  const plan = await prisma.mealPlan.findUnique({
    where: { userId_weekStart: { userId: session.user.id, weekStart: new Date(weekStart) } },
    include: { meals: { include: { recipe: true }, orderBy: { date: "asc" } } },
  });
  return NextResponse.json({ plan });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to save your plan." }, { status: 401 });
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Invalid meal plan." }, { status: 400 });
  }
  const values = payload as Record<string, unknown>;
  const weekStartValue = values.weekStart;
  const mealsValue = values.meals;
  if (
    typeof weekStartValue !== "string" ||
    Number.isNaN(Date.parse(weekStartValue)) ||
    !Array.isArray(mealsValue) ||
    !mealsValue.every(isMealInput)
  ) {
    return NextResponse.json({ error: "Meal plan details are invalid." }, { status: 400 });
  }
  const meals = mealsValue;

  const recipes = await prisma.recipe.findMany({
    where: {
      id: { in: meals.map((meal) => meal.recipeId) },
      OR: [{ userId: session.user.id }, { userId: null }],
    },
    select: { id: true },
  });
  const validIds = new Set(recipes.map((recipe) => recipe.id));
  if (meals.some((meal) => !validIds.has(meal.recipeId))) {
    return NextResponse.json({ error: "A selected recipe is not available." }, { status: 400 });
  }

  const weekStart = new Date(weekStartValue);
  const plan = await prisma.$transaction(async (tx) => {
    const savedPlan = await tx.mealPlan.upsert({
      where: { userId_weekStart: { userId: session.user.id, weekStart } },
      create: { userId: session.user.id, weekStart },
      update: {},
    });
    await tx.plannedMeal.deleteMany({ where: { planId: savedPlan.id } });
    if (meals.length) {
      await tx.plannedMeal.createMany({
        data: meals.map((meal) => ({
          planId: savedPlan.id,
          recipeId: meal.recipeId,
          date: new Date(meal.date),
          slot: meal.slot,
        })),
      });
    }
    return tx.mealPlan.findUnique({
      where: { id: savedPlan.id },
      include: { meals: { include: { recipe: true }, orderBy: { date: "asc" } } },
    });
  });
  return NextResponse.json({ plan });
}

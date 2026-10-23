import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Prisma, PrismaClient } from "@prisma/client";
import { recommendRecipes, type InventoryItem, type MatchableRecipe, type UserPreferences } from "@cookwhat/shared";

export const prisma = new PrismaClient();
const barcodePattern = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;
const app = express();
app.use(cors({
  origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((item) => item.trim()),
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "1mb" }));

type AuthenticatedRequest = Request & { userId?: string };

function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = process.env.API_AUTH_SECRET;
  if (!token || !secret) {
    response.status(401).json({ error: { message: "Authentication is required." } });
    return;
  }
  try {
    const payload = jwt.verify(token, secret, { issuer: "cookwhat-web", audience: "cookwhat-api" });
    if (typeof payload === "string" || !payload.sub) throw new Error("Invalid token subject.");
    (request as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    response.status(401).json({ error: { message: "Your session is invalid or expired." } });
  }
}

function userId(request: Request) {
  const id = (request as AuthenticatedRequest).userId;
  if (!id) throw new Error("Authenticated user is unavailable.");
  return id;
}

function routeParam(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<unknown>) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };
}

const inventoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60).default("Other"),
  unit: z.string().trim().min(1).max(20).default("pieces"),
  remainingQuantity: z.number().finite().nonnegative().nullable().default(null),
  ownedQuantity: z.number().finite().nonnegative().optional(),
  brand: z.string().max(120).optional(),
  barcode: z.string().regex(barcodePattern).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  packageSize: z.string().max(80).optional(),
  expiresOn: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
});
const productInput = z.object({
  barcode: z.string().regex(barcodePattern),
  name: z.string().trim().min(1).max(120),
  brand: z.string().max(120).default(""),
  imageUrl: z.string().url().or(z.literal("")).default(""),
  category: z.string().max(60).default("Pantry"),
  packageSize: z.string().max(80).default(""),
  nutrition: z.record(z.string(), z.unknown()).optional(),
});
const equipmentInput = z.object({ name: z.string().trim().min(1).max(80) });
const groceryInput = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.string().max(80).default(""),
  unit: z.string().max(20).default(""),
  checked: z.boolean().default(false),
});
const preferencesInput = z.object({
  diet: z.array(z.string().trim().min(1).max(60)).max(20),
  allergies: z.array(z.string().trim().min(1).max(60)).max(30),
  dislikes: z.array(z.string().trim().min(1).max(60)).max(30),
  maxCookingMinutes: z.number().int().positive().nullable(),
  skillLevel: z.enum(["Any", "Easy", "Medium"]),
  servings: z.number().int().min(1).max(12),
});

function invalid(response: Response, error: z.ZodError) {
  return response.status(400).json({ error: { message: "Request validation failed.", details: error.issues } });
}

app.get("/api/health", asyncRoute(async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`;
  response.json({ data: { status: "ok", database: "connected" } });
}));

app.get("/api/products/barcode/:code", asyncRoute(async (request, response) => {
  const barcode = routeParam(request, "code");
  if (!barcodePattern.test(barcode)) {
    response.status(400).json({ error: { message: "Enter a valid EAN or UPC barcode." } });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const upstream = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,image_front_url,categories_tags,quantity,product_quantity,product_quantity_unit,nutriments`,
      { headers: { "User-Agent": "CookWhat/1.0 (kitchen inventory; contact: support@cookwhat.app)" }, signal: controller.signal },
    );
    if (!upstream.ok) {
      response.status(502).json({ error: { message: "Open Food Facts is temporarily unavailable." } });
      return;
    }
    const result = await upstream.json() as {
      status?: number;
      product?: {
        product_name?: string; product_name_en?: string; brands?: string; image_front_url?: string;
        categories_tags?: string[]; quantity?: string; product_quantity?: number;
        product_quantity_unit?: string; nutriments?: Record<string, unknown>;
      };
    };
    const product = result.product;
    const name = product?.product_name?.trim() || product?.product_name_en?.trim();
    if (result.status !== 1 || !product || !name) {
      response.status(404).json({ data: { found: false, barcode } });
      return;
    }
    const categories = (product.categories_tags ?? []).join(" ").toLowerCase();
    const category = categories.includes("vegetable") ? "Vegetables"
      : categories.includes("fruit") ? "Fruit"
      : categories.includes("meat") ? "Meat"
      : /fish|seafood/.test(categories) ? "Seafood"
      : categories.includes("egg") ? "Eggs"
      : /dairy|milk|cheese/.test(categories) ? "Dairy"
      : /condiment|sauce|spice/.test(categories) ? "Seasonings" : "Pantry";
    response.json({ data: { found: true, product: {
      barcode, name, brand: product.brands?.split(",")[0]?.trim() ?? "",
      imageUrl: product.image_front_url ?? "", category, packageSize: product.quantity ?? "",
      nutrition: product.nutriments ?? {},
    } } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      response.status(504).json({ error: { message: "Open Food Facts lookup timed out." } });
    } else {
      response.status(502).json({ error: { message: "Could not reach Open Food Facts." } });
    }
  } finally {
    clearTimeout(timeout);
  }
}));

app.post("/api/products", requireAuth, asyncRoute(async (request, response) => {
  const parsed = productInput.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const product = await prisma.product.upsert({
    where: { barcode: parsed.data.barcode },
    create: { ...parsed.data, nutrition: parsed.data.nutrition ? JSON.stringify(parsed.data.nutrition) : null },
    update: {
      name: parsed.data.name, brand: parsed.data.brand, imageUrl: parsed.data.imageUrl,
      category: parsed.data.category, packageSize: parsed.data.packageSize,
      nutrition: parsed.data.nutrition ? JSON.stringify(parsed.data.nutrition) : null,
    },
  });
  response.status(201).json({ data: product });
}));

app.use("/api/inventory", requireAuth);
app.get("/api/inventory", asyncRoute(async (request, response) => {
  const data = await prisma.inventoryItem.findMany({
    where: { userId: userId(request) }, include: { product: true }, orderBy: { addedAt: "desc" },
  });
  response.json({ data: data.map((item) => ({ ...item, imageUrl: item.product?.imageUrl || undefined })) });
}));
app.post("/api/inventory", asyncRoute(async (request, response) => {
  const parsed = inventoryInput.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const input = parsed.data;
  const owner = userId(request);
  const duplicate = input.barcode ? await prisma.inventoryItem.findFirst({ where: { userId: owner, barcode: input.barcode } }) : null;
  if (duplicate) {
    response.status(409).json({ error: { message: "This product is already in your inventory.", existingId: duplicate.id } });
    return;
  }
  const created = await prisma.$transaction(async (tx) => {
    const product = input.barcode ? await tx.product.upsert({
      where: { barcode: input.barcode! },
      create: {
        barcode: input.barcode!, name: input.name, brand: input.brand ?? "", imageUrl: input.imageUrl ?? "",
        category: input.category, packageSize: input.packageSize ?? "",
      },
      update: {},
    }) : null;
    return tx.inventoryItem.create({
      data: {
        userId: owner, productId: product?.id, name: input.name, category: input.category, unit: input.unit,
        remainingQuantity: input.remainingQuantity, ownedQuantity: input.ownedQuantity, brand: input.brand,
        barcode: input.barcode, packageSize: input.packageSize, expiresOn: input.expiresOn, note: input.note,
      },
    });
  });
  response.status(201).json({ data: created });
}));
app.get("/api/inventory/:id", asyncRoute(async (request, response) => {
  const id = routeParam(request, "id");
  const data = await prisma.inventoryItem.findFirst({ where: { id, userId: userId(request) }, include: { product: true } });
  if (!data) { response.status(404).json({ error: { message: "Inventory item not found." } }); return; }
  response.json({ data: { ...data, imageUrl: data.product?.imageUrl || undefined } });
}));
app.patch("/api/inventory/:id", asyncRoute(async (request, response) => {
  const parsed = inventoryInput.partial().safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const owner = userId(request);
  const id = routeParam(request, "id");
  const existing = await prisma.inventoryItem.findFirst({ where: { id, userId: owner } });
  if (!existing) { response.status(404).json({ error: { message: "Inventory item not found." } }); return; }
  const data = await prisma.inventoryItem.update({ where: { id: existing.id }, data: parsed.data });
  response.json({ data });
}));
app.delete("/api/inventory/:id", asyncRoute(async (request, response) => {
  const deleted = await prisma.inventoryItem.deleteMany({ where: { id: routeParam(request, "id"), userId: userId(request) } });
  if (!deleted.count) { response.status(404).json({ error: { message: "Inventory item not found." } }); return; }
  response.status(204).end();
}));

app.use("/api/equipment", requireAuth);
app.get("/api/equipment", asyncRoute(async (request, response) => {
  const data = await prisma.kitchenEquipment.findMany({ where: { userId: userId(request) }, orderBy: { name: "asc" } });
  response.json({ data });
}));
app.post("/api/equipment", asyncRoute(async (request, response) => {
  const parsed = equipmentInput.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const data = await prisma.kitchenEquipment.upsert({
    where: { userId_name: { userId: userId(request), name: parsed.data.name } },
    create: { userId: userId(request), name: parsed.data.name }, update: {},
  });
  response.status(201).json({ data });
}));
app.patch("/api/equipment/:id", asyncRoute(async (request, response) => {
  const parsed = equipmentInput.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const id = routeParam(request, "id");
  const updated = await prisma.kitchenEquipment.updateMany({
    where: { id, userId: userId(request) }, data: { name: parsed.data.name },
  });
  if (!updated.count) { response.status(404).json({ error: { message: "Equipment not found." } }); return; }
  response.json({ data: await prisma.kitchenEquipment.findUnique({ where: { id } }) });
}));
app.delete("/api/equipment/:id", asyncRoute(async (request, response) => {
  const deleted = await prisma.kitchenEquipment.deleteMany({ where: { id: routeParam(request, "id"), userId: userId(request) } });
  if (!deleted.count) { response.status(404).json({ error: { message: "Equipment not found." } }); return; }
  response.status(204).end();
}));

app.use("/api/shopping-list", requireAuth);
app.get("/api/shopping-list", asyncRoute(async (request, response) => {
  const data = await prisma.groceryItem.findMany({ where: { userId: userId(request) }, orderBy: { createdAt: "asc" } });
  response.json({ data });
}));
app.post("/api/shopping-list", asyncRoute(async (request, response) => {
  const parsed = groceryInput.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const data = await prisma.groceryItem.create({ data: { ...parsed.data, userId: userId(request) } });
  response.status(201).json({ data });
}));
app.patch("/api/shopping-list/:id", asyncRoute(async (request, response) => {
  const parsed = groceryInput.partial().safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const id = routeParam(request, "id");
  const result = await prisma.groceryItem.updateMany({ where: { id, userId: userId(request) }, data: parsed.data });
  if (!result.count) { response.status(404).json({ error: { message: "Shopping-list item not found." } }); return; }
  response.json({ data: await prisma.groceryItem.findUnique({ where: { id } }) });
}));
app.delete("/api/shopping-list/:id", asyncRoute(async (request, response) => {
  const result = await prisma.groceryItem.deleteMany({ where: { id: routeParam(request, "id"), userId: userId(request) } });
  if (!result.count) { response.status(404).json({ error: { message: "Shopping-list item not found." } }); return; }
  response.status(204).end();
}));

app.get("/api/preferences", requireAuth, asyncRoute(async (request, response) => {
  const owner = userId(request);
  const [settings, diet, allergies, dislikes] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: owner } }),
    prisma.userDietaryPreference.findMany({ where: { userId: owner }, select: { name: true } }),
    prisma.userAllergy.findMany({ where: { userId: owner }, select: { name: true } }),
    prisma.userDislike.findMany({ where: { userId: owner }, select: { name: true } }),
  ]);
  response.json({ data: {
    diet: diet.map((item) => item.name), allergies: allergies.map((item) => item.name), dislikes: dislikes.map((item) => item.name),
    maxCookingMinutes: settings?.maxCookingMinutes ?? null, skillLevel: settings?.skillLevel ?? "Any",
    servings: settings?.servings ?? 2,
  } });
}));
app.put("/api/preferences", requireAuth, asyncRoute(async (request, response) => {
  const parsed = preferencesInput.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const owner = userId(request);
  const p = parsed.data;
  await prisma.$transaction([
    prisma.userPreference.upsert({
      where: { userId: owner }, create: { userId: owner, maxCookingMinutes: p.maxCookingMinutes, skillLevel: p.skillLevel, servings: p.servings },
      update: { maxCookingMinutes: p.maxCookingMinutes, skillLevel: p.skillLevel, servings: p.servings },
    }),
    prisma.userDietaryPreference.deleteMany({ where: { userId: owner } }),
    prisma.userAllergy.deleteMany({ where: { userId: owner } }),
    prisma.userDislike.deleteMany({ where: { userId: owner } }),
    ...(p.diet.length ? [prisma.userDietaryPreference.createMany({ data: p.diet.map((name) => ({ userId: owner, name })) })] : []),
    ...(p.allergies.length ? [prisma.userAllergy.createMany({ data: p.allergies.map((name) => ({ userId: owner, name })) })] : []),
    ...(p.dislikes.length ? [prisma.userDislike.createMany({ data: p.dislikes.map((name) => ({ userId: owner, name })) })] : []),
  ]);
  response.json({ data: p });
}));

const recipeInclude = { recipeIngredients: true, instructions: { orderBy: { step: "asc" as const } } };

function asMatchable(recipe: Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>): MatchableRecipe {
  const ingredients: string[] = JSON.parse(recipe.ingredients);
  return {
    id: recipe.id, title: recipe.title, category: recipe.category as MatchableRecipe["category"],
    minutes: recipe.cookingMinutes, servings: recipe.servings, calories: recipe.calories,
    image: recipe.imageUrl, description: recipe.description, ingredients, tag: "RECIPE",
    requirements: recipe.recipeIngredients.length ? recipe.recipeIngredients : ingredients.map((name) => ({ name, amount: 1, unit: "pieces" })),
    equipment: JSON.parse(recipe.equipment), dietaryTags: JSON.parse(recipe.dietaryTags),
    instructions: (recipe.instructions.length ? recipe.instructions : JSON.parse(recipe.instructionsText)).map((instruction: { text: string } | string) => typeof instruction === "string" ? instruction : instruction.text),
    difficulty: recipe.difficulty as MatchableRecipe["difficulty"],
  };
}
app.get("/api/recipes", asyncRoute(async (request, response) => {
  const owner = request.header("authorization") ? (request as AuthenticatedRequest).userId : undefined;
  const data = await prisma.recipe.findMany({
    where: { OR: [{ userId: null }, ...(owner ? [{ userId: owner }] : [])] },
    include: recipeInclude, orderBy: { title: "asc" },
  });
  response.json({ data: data.map(asMatchable) });
}));
app.get("/api/recipes/recommendations", requireAuth, asyncRoute(async (request, response) => {
  const owner = userId(request);
  const mode = z.enum(["ready", "almost", "soon", "healthy"]).catch("ready").parse(
    typeof request.query.mode === "string" ? request.query.mode : undefined,
  );
  const [inventory, equipment, recipes, settings, diet, allergies, dislikes] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId: owner } }),
    prisma.kitchenEquipment.findMany({ where: { userId: owner }, select: { name: true } }),
    prisma.recipe.findMany({ where: { OR: [{ userId: null }, { userId: owner }] }, include: recipeInclude }),
    prisma.userPreference.findUnique({ where: { userId: owner } }),
    prisma.userDietaryPreference.findMany({ where: { userId: owner }, select: { name: true } }),
    prisma.userAllergy.findMany({ where: { userId: owner }, select: { name: true } }),
    prisma.userDislike.findMany({ where: { userId: owner }, select: { name: true } }),
  ]);
  const preferences: UserPreferences = {
    diet: diet.map((item) => item.name), allergies: allergies.map((item) => item.name), dislikes: dislikes.map((item) => item.name),
    maxCookingMinutes: settings?.maxCookingMinutes ?? null,
    skillLevel: (settings?.skillLevel ?? "Any") as UserPreferences["skillLevel"], servings: settings?.servings ?? 2,
  };
  const matchInventory: InventoryItem[] = inventory.map((item) => ({
    ...item,
    brand: item.brand ?? undefined,
    barcode: item.barcode ?? undefined,
    imageUrl: undefined,
    packageSize: item.packageSize ?? undefined,
    ownedQuantity: item.ownedQuantity ?? undefined,
    note: item.note ?? undefined,
    expiresOn: item.expiresOn?.toISOString().slice(0, 10),
    addedAt: item.addedAt.toISOString(),
  }));
  const matches = recommendRecipes(recipes.map(asMatchable), matchInventory, equipment.map((item) => item.name), preferences, mode);
  response.json({ data: matches });
}));
app.get("/api/recipes/:id", asyncRoute(async (request, response) => {
  const id = routeParam(request, "id");
  const data = await prisma.recipe.findFirst({
    where: { id, OR: [{ userId: null }, { userId: (request as AuthenticatedRequest).userId ?? "__anonymous__" }] },
    include: recipeInclude,
  });
  if (!data) { response.status(404).json({ error: { message: "Recipe not found." } }); return; }
  response.json({ data: asMatchable(data) });
}));
app.post("/api/recipes", requireAuth, asyncRoute(async (request, response) => {
  const inputSchema = z.object({
    title: z.string().trim().min(1).max(120), description: z.string().max(500).default(""),
    category: z.enum(["Breakfast", "Lunch", "Dinner"]), minutes: z.number().int().positive().max(1440),
    servings: z.number().int().min(1).max(24), calories: z.number().int().nonnegative().default(0),
    image: z.string().url().or(z.literal("")).default(""),
    requirements: z.array(z.object({ name: z.string().min(1), amount: z.number().positive(), unit: z.string().min(1), optional: z.boolean().optional() })).min(1),
    equipment: z.array(z.string()), dietaryTags: z.array(z.string()), instructions: z.array(z.string()),
    difficulty: z.enum(["Easy", "Medium"]).default("Easy"),
  });
  const parsed = inputSchema.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error);
  const p = parsed.data;
  const data = await prisma.recipe.create({
    data: {
      userId: userId(request), title: p.title, description: p.description, category: p.category,
      cookingMinutes: p.minutes, servings: p.servings, calories: p.calories, imageUrl: p.image,
      ingredients: JSON.stringify(p.requirements.map((i) => i.name)), dietaryTags: JSON.stringify(p.dietaryTags),
      equipment: JSON.stringify(p.equipment), instructionsText: JSON.stringify(p.instructions), difficulty: p.difficulty,
      recipeIngredients: { create: p.requirements }, instructions: { create: p.instructions.map((text, index) => ({ step: index + 1, text })) },
    }, include: recipeInclude,
  });
  response.status(201).json({ data: asMatchable(data) });
}));

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: { message: "Malformed JSON request body." } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({ error: { message: "That record already exists." } });
    return;
  }
  console.error("CookWhat API request failed.", error);
  response.status(500).json({ error: { message: "The request could not be completed." } });
});

export default app;

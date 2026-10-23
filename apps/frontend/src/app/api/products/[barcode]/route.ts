import { NextResponse } from "next/server";

const barcodePattern = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;

type OpenFoodFactsProduct = {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  image_front_url?: string;
  categories_tags?: string[];
  quantity?: string;
  product_quantity?: number;
  product_quantity_unit?: string;
};

function mapCategory(tags: string[] | undefined) {
  const categories = (tags ?? []).join(" ").toLowerCase();
  if (categories.includes("vegetable")) return "Vegetables";
  if (categories.includes("fruit")) return "Fruit";
  if (categories.includes("meat")) return "Meat";
  if (categories.includes("fish") || categories.includes("seafood")) return "Seafood";
  if (categories.includes("egg")) return "Eggs";
  if (categories.includes("dairy") || categories.includes("milk") || categories.includes("cheese")) return "Dairy";
  if (categories.includes("condiment") || categories.includes("sauce") || categories.includes("spice")) return "Seasonings";
  return "Pantry";
}

export async function GET(_request: Request, { params }: { params: { barcode: string } }) {
  const barcode = params.barcode;
  if (!barcodePattern.test(barcode)) {
    return NextResponse.json({ error: "Enter a valid EAN or UPC barcode." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,image_front_url,categories_tags,quantity,product_quantity,product_quantity_unit`,
      {
        headers: { "User-Agent": "CookWhat/1.0 (kitchen inventory)" },
        signal: controller.signal,
        next: { revalidate: 60 * 60 * 24 },
      },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "The product database is temporarily unavailable." }, { status: 502 });
    }

    const data = (await response.json()) as { status?: number; product?: OpenFoodFactsProduct };
    const product = data.product;
    const name = product?.product_name?.trim() || product?.product_name_en?.trim();
    if (data.status !== 1 || !product || !name) {
      return NextResponse.json({ found: false, barcode });
    }
    return NextResponse.json({
      found: true,
      product: {
        name,
        brand: product.brands?.split(",")[0]?.trim() ?? "",
        imageUrl: product.image_front_url ?? "",
        category: mapCategory(product.categories_tags),
        packageSize: product.quantity ?? "",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Product lookup timed out. Please try again." }, { status: 504 });
    }
    console.error("Open Food Facts product lookup failed.", error);
    return NextResponse.json({ error: "Could not reach the product database. You can add the item manually." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

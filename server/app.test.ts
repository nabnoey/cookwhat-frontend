/** @jest-environment node */

import jwt from "jsonwebtoken";
import request from "supertest";
import app, { prisma } from "./app";

const authSecret = "test-api-auth-secret-with-at-least-32-characters";
process.env.API_AUTH_SECRET = authSecret;

function authorization(userId = "user-a") {
  const token = jwt.sign({}, authSecret, {
    subject: userId,
    issuer: "cookwhat-web",
    audience: "cookwhat-api",
    expiresIn: "5m",
  });
  return `Bearer ${token}`;
}

describe("CookWhat REST API", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reports a healthy database connection", async () => {
    jest.spyOn(prisma, "$queryRaw").mockResolvedValue([] as never);

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: "ok", database: "connected" });
  });

  it("rejects account data requests without a valid token", async () => {
    const response = await request(app).get("/api/inventory");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/authentication/i);
  });

  it("scopes inventory item reads to the authenticated user", async () => {
    const findFirst = jest.spyOn(prisma.inventoryItem, "findFirst").mockResolvedValue(null as never);

    const response = await request(app)
      .get("/api/inventory/item-from-another-user")
      .set("Authorization", authorization());

    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-from-another-user", userId: "user-a" },
    }));
  });

  it("rejects malformed barcode values before calling the external service", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch");

    const response = await request(app).get("/api/products/barcode/not-a-barcode");

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes a product found by Open Food Facts", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        product_name: "Oat milk",
        brands: "Example Brand",
        quantity: "1 L",
        categories_tags: ["en:plant-based-milks"],
        nutriments: { energy_kcal_100g: 42 },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await request(app).get("/api/products/barcode/12345670");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      found: true,
      product: {
        barcode: "12345670",
        name: "Oat milk",
        brand: "Example Brand",
        packageSize: "1 L",
      },
    });
  });

  it("distinguishes an unknown barcode from an upstream failure", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 0 }), { status: 200 }))
      .mockRejectedValueOnce(new Error("network unavailable"));

    const notFound = await request(app).get("/api/products/barcode/12345670");
    const failed = await request(app).get("/api/products/barcode/12345670");

    expect(notFound.status).toBe(404);
    expect(failed.status).toBe(502);
  });
});


export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  const payload: unknown = await request.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("name" in payload) ||
    !("email" in payload) ||
    !("password" in payload)
  ) {
    return NextResponse.json({ error: "Please complete all fields." }, { status: 400 });
  }

  const { name, email, password } = payload as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return NextResponse.json(
      { error: "Use a valid email, a name with at least 2 characters, and a password with at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
      },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    throw error;
  }
}

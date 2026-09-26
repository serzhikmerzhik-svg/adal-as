import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth/jwt";

const bodySchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

const ROLE_HOME: Record<string, string> = {
  KITCHEN: "/kitchen",
  NURSE: "/nurse",
  SES: "/ses",
  EDU: "/edu",
  ADMIN: "/training",
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });
  }

  const { login, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Логин немесе құпиясөз қате" }, { status: 401 });
  }

  const token = await signSession({
    userId: user.id,
    login: user.login,
    role: user.role,
    schoolId: user.schoolId,
    name: user.name,
  });

  const response = NextResponse.json({
    role: user.role,
    name: user.name,
    redirectTo: ROLE_HOME[user.role] ?? "/",
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

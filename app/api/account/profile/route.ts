import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { issueSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function PATCH(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const form = await req.formData();
  const displayName = String(form.get("displayName") ?? "").trim() || null;
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  const avatar = form.get("avatar");

  const user = await prisma.user.findUnique({
    where: { id: guard.session.sub },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
    return NextResponse.json({ error: "Вкажіть коректний email" }, { status: 400 });
  }

  const emailChanged = emailRaw !== user.email;
  const passwordChanged = newPassword.length > 0;
  if ((emailChanged || passwordChanged) && !currentPassword) {
    return NextResponse.json(
      { error: "Щоб змінити логін або пароль, введіть поточний пароль" },
      { status: 400 }
    );
  }
  if (emailChanged || passwordChanged) {
    const ok = await verifyPassword(currentPassword, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Невірний поточний пароль" }, { status: 400 });
    }
  }
  if (passwordChanged && newPassword.length < 8) {
    return NextResponse.json(
      { error: "Новий пароль має бути щонайменше 8 символів" },
      { status: 400 }
    );
  }

  let avatarUrl = user.avatarUrl;
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Аватар до 2 МБ" }, { status: 400 });
    }
    const ext = AVATAR_TYPES[avatar.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Аватар: лише JPEG, PNG або WebP" },
        { status: 400 }
      );
    }
    const dir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(dir, { recursive: true });
    const filename = `${user.id}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await avatar.arrayBuffer()));
    avatarUrl = `/uploads/avatars/${filename}?v=${Date.now()}`;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        email: emailRaw,
        avatarUrl,
        ...(passwordChanged ? { password: await hashPassword(newPassword) } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    const res = NextResponse.json({ user: updated });
    if (emailChanged) {
      const token = await issueSession(updated);
      setSessionCookie(res, token);
    }
    return res;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Цей email уже зайнятий" },
        { status: 409 }
      );
    }
    console.error("PATCH /api/account/profile", err);
    return NextResponse.json(
      { error: "Не вдалося зберегти профіль" },
      { status: 500 }
    );
  }
}

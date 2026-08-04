import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function getAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Nicht angemeldet.", status: 401 };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return { error: "Ungültige Sitzung.", status: 401 };

  const admin = createClient(url, service);
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return { error: "Nur Administratoren dürfen das.", status: 403 };
  return { admin, user };
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAdmin(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { userId, name, phone, avatarUrl, isAdmin, temporaryPassword } = await req.json();

    const profileUpdate: Record<string, unknown> = {};
    if (typeof name === "string") profileUpdate.name = name.trim();
    if (typeof phone === "string") profileUpdate.phone = phone.trim();
    if (typeof avatarUrl === "string" || avatarUrl === null) profileUpdate.avatar_url = avatarUrl;
    if (typeof isAdmin === "boolean") profileUpdate.is_admin = isAdmin;

    if (Object.keys(profileUpdate).length) {
      const { error } = await auth.admin.from("profiles").update(profileUpdate).eq("id", userId);
      if (error) throw error;
    }

    if (typeof temporaryPassword === "string" && temporaryPassword.length >= 6) {
      const { error } = await auth.admin.auth.admin.updateUserById(userId, {
        password: temporaryPassword
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

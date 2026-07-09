import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    // caller identity + admin check
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);

    const { data: isAdmin, error: roleErr } = await asUser.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) return json({ error: "Somente admin" }, 403);

    const body = await req.json();
    const { email, nome, cargo, role, password } = body as {
      email?: string;
      nome?: string;
      cargo?: string;
      role?: "admin" | "staff" | "contador";
      password?: string;
    };
    if (!email || !nome || !role) return json({ error: "Campos obrigatórios: email, nome, role" }, 400);
    if (role !== "admin" && role !== "staff" && role !== "contador") {
      return json({ error: "role inválido" }, 400);
    }
    if (password && password.length < 8) return json({ error: "Senha deve ter no mínimo 8 caracteres" }, 400);

    const admin = createClient(url, serviceKey);

    // use provided password or generate a random temporary one
    const tempPassword = password && password.length >= 8
      ? password
      : crypto.randomUUID().replace(/-/g, "") + "A1!";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    const userId = created.user!.id;

    // profile info
    await admin.from("profiles").update({ nome, cargo: cargo ?? null }).eq("id", userId);

    // role (replace default 'staff' set by trigger)
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: insErr } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role });
    if (insErr) throw insErr;

    return json({ ok: true, userId, tempPassword });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "erro" }, 500);
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { count, error: countErr } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw countErr;
    const setupNeeded = (count ?? 0) === 0;

    if (req.method === "GET") {
      return new Response(JSON.stringify({ setupNeeded }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    if (req.method === "POST") {
      if (!setupNeeded) {
        return new Response(
          JSON.stringify({ error: "Setup já foi concluído." }),
          { status: 403, headers: { ...cors, "content-type": "application/json" } },
        );
      }

      const { email, password, nome } = await req.json();
      if (!email || !password || password.length < 8) {
        return new Response(
          JSON.stringify({ error: "E-mail e senha (mín. 8 caracteres) obrigatórios." }),
          { status: 400, headers: { ...cors, "content-type": "application/json" } },
        );
      }

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome: nome ?? email },
      });
      if (createErr) throw createErr;

      const userId = created.user!.id;
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleErr) throw roleErr;

      await supabase
        .from("profiles")
        .update({ nome: nome ?? email, cargo: "Sócio" })
        .eq("id", userId);

      return new Response(JSON.stringify({ ok: true, userId }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: cors });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "erro" }),
      { status: 500, headers: { ...cors, "content-type": "application/json" } },
    );
  }
});
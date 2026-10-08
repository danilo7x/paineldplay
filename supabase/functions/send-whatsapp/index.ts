import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  connectionStateRequest,
  evolutionErrorMessage,
  isConnected,
  messageIdFrom,
  normalizePhone,
  readConfig,
  sendTextRequest,
  validateSend,
} from "./logic.ts";

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

async function readJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    // Tudo roda como o usuário: o RLS decide quais leads ele pode usar.
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);

    const { data: allowed, error: accessErr } = await asUser.rpc("has_commercial_access", {
      _user_id: userData.user.id,
    });
    if (accessErr) throw accessErr;
    if (!allowed) return json({ error: "Sem acesso ao Acompanhamento de Leads" }, 403);

    const body = (await req.json()) as {
      action?: "status" | "send";
      lead_id?: string;
      activity_id?: string;
      text?: string;
    };
    const cfg = readConfig((k) => Deno.env.get(k));

    if (body.action === "status") {
      if (!cfg) return json({ configured: false, connected: false });
      const r = connectionStateRequest(cfg);
      const res = await fetch(r.url, r.init).catch(() => null);
      const connected = !!res && res.ok && isConnected(await readJson(res));
      return json({ configured: true, connected });
    }

    if (body.action !== "send") return json({ error: "Ação inválida" }, 400);
    if (!cfg) return json({ error: "Envio pelo WhatsApp ainda não configurado." }, 400);
    if (!body.lead_id || !body.activity_id || typeof body.text !== "string")
      return json({ error: "Campos obrigatórios: lead_id, activity_id, text" }, 400);

    const [{ data: lead }, { data: activity }] = await Promise.all([
      asUser
        .from("partner_leads")
        .select("id, telefone, nao_contatar, cadencia_status")
        .eq("id", body.lead_id)
        .maybeSingle(),
      asUser
        .from("lead_activities")
        .select("id, lead_id, tipo, status, chave")
        .eq("id", body.activity_id)
        .maybeSingle(),
    ]);

    const invalid = validateSend(lead, activity, body.text);
    if (invalid) return json({ error: invalid }, 400);

    const r = sendTextRequest(cfg, normalizePhone(lead!.telefone)!, body.text);
    const res = await fetch(r.url, r.init).catch(() => null);
    if (!res) return json({ error: "Não foi possível conectar à Evolution API." }, 502);
    const payload = await readJson(res);
    if (!res.ok) return json({ error: evolutionErrorMessage(res.status, payload) }, 502);

    return json({ ok: true, messageId: messageIdFrom(payload) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "erro" }, 500);
  }
});

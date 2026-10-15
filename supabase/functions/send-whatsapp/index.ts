import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALREADY_SENT_MESSAGE,
  API_CHANNEL,
  NO_INSTANCE_MESSAGE,
  NO_QR_MESSAGE,
  connectRequest,
  connectionStateRequest,
  createInstanceRequest,
  evolutionErrorMessage,
  isConnected,
  logoutRequest,
  messageIdFrom,
  normalizePhone,
  pickInstance,
  qrFrom,
  readConfig,
  sendTextRequest,
  stateFrom,
  validInstanceName,
  validateSend,
  type EvolutionConfig,
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

async function connected(cfg: EvolutionConfig, instance: string) {
  const r = connectionStateRequest(cfg, instance);
  const res = await fetch(r.url, r.init).catch(() => null);
  return !!res && res.ok && isConnected(await readJson(res));
}

async function stateOf(cfg: EvolutionConfig, instance: string) {
  const r = connectionStateRequest(cfg, instance);
  const res = await fetch(r.url, r.init).catch(() => null);
  if (!res) return null;
  return stateFrom(res.status, await readJson(res));
}

/** Instância cadastrada para a pessoa (lida como o usuário, sob RLS). */
async function instanceOf(db: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await db
    .from("commercial_whatsapp_instances")
    .select("instance")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.instance as string | undefined) ?? null;
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
      action?: "status" | "send" | "admin_status" | "admin_connect" | "admin_logout";
      lead_id?: string;
      activity_id?: string;
      text?: string;
      user_id?: string;
      instance?: string;
      number?: string;
    };
    const cfg = readConfig((k) => Deno.env.get(k));

    // Conexão dos números (Equipe → Conectar WhatsApp): só admin.
    if (body.action?.startsWith("admin_")) {
      const { data: adminRow } = await asUser
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRow) return json({ error: "Somente admin" }, 403);
      if (!cfg) return json({ error: "Envio pelo WhatsApp ainda não configurado." }, 400);
      if (!body.user_id) return json({ error: "Informe a pessoa (user_id)." }, 400);
      const unreachable = () => json({ error: "Não foi possível conectar à Evolution API." }, 502);

      if (body.action === "admin_status") {
        const instance = await instanceOf(asUser, body.user_id);
        if (!instance) return json({ instance: null, state: "missing" });
        const state = await stateOf(cfg, instance);
        return state ? json({ instance, state }) : unreachable();
      }

      if (body.action === "admin_logout") {
        const instance = await instanceOf(asUser, body.user_id);
        if (!instance) return json({ instance: null, state: "missing" });
        const r = logoutRequest(cfg, instance);
        const res = await fetch(r.url, r.init).catch(() => null);
        if (!res) return unreachable();
        if (!res.ok && res.status !== 404) {
          const payload = await readJson(res);
          // Já desconectada: a Evolution responde erro, mas o resultado é o mesmo.
          if (!/not connected|disconnected|close/i.test(JSON.stringify(payload ?? "")))
            return json({ error: evolutionErrorMessage(res.status, payload) }, 502);
        }
        return json({ instance, state: (await stateOf(cfg, instance)) ?? "close" });
      }

      if (body.action === "admin_connect") {
        const instance = validInstanceName(body.instance);
        if (!instance)
          return json(
            { error: "Nome da instância inválido: use só letras, números, - ou _ (ex.: Flavio)." },
            400,
          );
        const number = body.number ? normalizePhone(body.number) : null;
        if (body.number && !number)
          return json({ error: "Número inválido. Use DDD + número, ex.: 11999998888." }, 400);

        // Vincula a instância à pessoa (RPC de admin, como o usuário).
        const { error: linkErr } = await asUser.rpc("admin_set_whatsapp_instance", {
          _user_id: body.user_id,
          _instance: instance,
        });
        if (linkErr) return json({ error: linkErr.message }, 400);

        const state = await stateOf(cfg, instance);
        if (!state) return unreachable();
        if (state === "open") return json({ instance, state, qr: null, pairingCode: null });

        let payload: unknown = null;
        if (state === "missing") {
          // Instância nova: a própria criação já devolve o QR Code.
          const r = createInstanceRequest(cfg, instance, number);
          const res = await fetch(r.url, r.init).catch(() => null);
          if (!res) return unreachable();
          payload = await readJson(res);
          if (!res.ok) return json({ error: evolutionErrorMessage(res.status, payload) }, 502);
        }
        let codes = qrFrom(payload);
        if (!codes.qr && !codes.pairingCode) {
          const r = connectRequest(cfg, instance, number);
          const res = await fetch(r.url, r.init).catch(() => null);
          if (!res) return unreachable();
          payload = await readJson(res);
          if (!res.ok) return json({ error: evolutionErrorMessage(res.status, payload) }, 502);
          codes = qrFrom(payload);
        }
        if (!codes.qr && !codes.pairingCode) return json({ error: NO_QR_MESSAGE }, 502);
        return json({ instance, state: "connecting", ...codes });
      }
      return json({ error: "Ação inválida" }, 400);
    }

    if (body.action === "status") {
      if (!cfg) return json({ configured: false, connected: false, instances: [] });

      // Status do número que enviaria para este lead (o do responsável).
      if (body.lead_id) {
        const { data: lead } = await asUser
          .from("partner_leads")
          .select("responsavel_id")
          .eq("id", body.lead_id)
          .maybeSingle();
        const instance = pickInstance(await instanceOf(asUser, lead?.responsavel_id));
        if (!instance) return json({ configured: true, connected: false, instance: null });
        return json({ configured: true, connected: await connected(cfg, instance), instance });
      }

      // Visão geral: o número de cada pessoa cadastrada.
      const { data: rows } = await asUser
        .from("commercial_whatsapp_instances")
        .select("user_id, instance");
      const list = (rows ?? []) as { user_id: string; instance: string }[];
      const instances = await Promise.all(
        list.map(async (r) => ({ ...r, connected: await connected(cfg, r.instance) })),
      );
      return json({
        configured: true,
        connected: instances.some((i) => i.connected),
        instances,
      });
    }

    if (body.action !== "send") return json({ error: "Ação inválida" }, 400);
    if (!cfg) return json({ error: "Envio pelo WhatsApp ainda não configurado." }, 400);
    if (!body.lead_id || !body.activity_id || typeof body.text !== "string")
      return json({ error: "Campos obrigatórios: lead_id, activity_id, text" }, 400);

    const [{ data: lead }, { data: activity }] = await Promise.all([
      asUser
        .from("partner_leads")
        .select("id, responsavel_id, telefone, nao_contatar, cadencia_status")
        .eq("id", body.lead_id)
        .maybeSingle(),
      asUser
        .from("lead_activities")
        .select("id, lead_id, tipo, status, chave, canal")
        .eq("id", body.activity_id)
        .maybeSingle(),
    ]);

    const invalid = validateSend(lead, activity, body.text);
    if (invalid === ALREADY_SENT_MESSAGE)
      return json({ error: invalid, code: "already_sent" }, 409);
    if (invalid) return json({ error: invalid }, 400);

    // A mensagem sai do número do responsável pelo lead.
    const instance = pickInstance(await instanceOf(asUser, lead!.responsavel_id));
    if (!instance) return json({ error: NO_INSTANCE_MESSAGE }, 400);

    // Trava atômica: só um envio por mensagem prevista, mesmo com dois cliques ou
    // duas abas. O registro do envio (feito em seguida pela tela) mantém o canal.
    const { data: claimed, error: claimErr } = await asUser
      .from("lead_activities")
      .update({ canal: API_CHANNEL })
      .eq("id", activity!.id)
      .eq("status", "prevista")
      .or(`canal.is.null,canal.neq.${API_CHANNEL}`)
      .select("id");
    if (claimErr) throw claimErr;
    if (!claimed?.length) return json({ error: ALREADY_SENT_MESSAGE, code: "already_sent" }, 409);
    const release = () =>
      asUser
        .from("lead_activities")
        .update({ canal: activity!.canal ?? null })
        .eq("id", activity!.id)
        .eq("status", "prevista");

    const r = sendTextRequest(cfg, instance, normalizePhone(lead!.telefone)!, body.text);
    const res = await fetch(r.url, r.init).catch(() => null);
    if (!res) {
      await release();
      return json({ error: "Não foi possível conectar à Evolution API." }, 502);
    }
    const payload = await readJson(res);
    if (!res.ok) {
      await release();
      return json({ error: evolutionErrorMessage(res.status, payload) }, 502);
    }

    return json({ ok: true, messageId: messageIdFrom(payload), instance });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "erro" }, 500);
  }
});

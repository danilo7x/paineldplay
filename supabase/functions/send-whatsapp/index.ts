import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALREADY_SENT_MESSAGE,
  API_CHANNEL,
  NO_INSTANCE_MESSAGE,
  connectionStateRequest,
  evolutionErrorMessage,
  isConnected,
  messageIdFrom,
  normalizePhone,
  pickInstance,
  readConfig,
  sendTextRequest,
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
      action?: "status" | "send";
      lead_id?: string;
      activity_id?: string;
      text?: string;
    };
    const cfg = readConfig((k) => Deno.env.get(k));

    if (body.action === "status") {
      if (!cfg) return json({ configured: false, connected: false, instances: [] });

      // Status do número que enviaria para este lead (o do responsável).
      if (body.lead_id) {
        const { data: lead } = await asUser
          .from("partner_leads")
          .select("responsavel_id")
          .eq("id", body.lead_id)
          .maybeSingle();
        const ownerInstance = await instanceOf(asUser, lead?.responsavel_id);
        const instance = pickInstance(ownerInstance, cfg.defaultInstance);
        if (!instance) return json({ configured: true, connected: false, instance: null });
        return json({
          configured: true,
          connected: await connected(cfg, instance),
          instance,
          // false = sem número do responsável; usa o número padrão.
          from_owner: !!ownerInstance,
        });
      }

      // Visão geral: cada número cadastrado e o padrão, se houver.
      const { data: rows } = await asUser
        .from("commercial_whatsapp_instances")
        .select("user_id, instance");
      const list: { user_id: string | null; instance: string }[] = [
        ...((rows ?? []) as { user_id: string; instance: string }[]),
      ];
      if (cfg.defaultInstance && !list.some((r) => r.instance === cfg.defaultInstance))
        list.push({ user_id: null, instance: cfg.defaultInstance });
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
    const instance = pickInstance(
      await instanceOf(asUser, lead!.responsavel_id),
      cfg.defaultInstance,
    );
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

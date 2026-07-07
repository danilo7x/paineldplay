import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function detect(ua: string) {
  const isMobile = /Mobi|Android|iPhone/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device_type = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  let browser = "Desconhecido";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  let os = "Desconhecido";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { device_type, browser, os, device_name: `${browser} · ${os}` };
}

function sessionKey() {
  const KEY = "dplay_session_key";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(KEY, v);
  }
  return v;
}

let started = false;
export async function trackSession(userId: string) {
  if (started) return;
  started = true;
  const key = sessionKey();
  const info = detect(navigator.userAgent);
  const { data: existing } = await supabase
    .from("user_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("session_key", key)
    .maybeSingle();
  const isNew = !existing;
  let ip: string | null = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (r.ok) ip = (await r.json()).ip ?? null;
  } catch {}
  await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      session_key: key,
      ...info,
      ip_address: ip,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_key" },
  );
  if (isNew) {
    toast.info("Novo dispositivo detectado", {
      description: `${info.device_name}${ip ? ` · ${ip}` : ""}`,
    });
  }
  // heartbeat
  setInterval(() => {
    supabase
      .from("user_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("session_key", key)
      .then(() => {});
  }, 60_000);
}

export function currentSessionKey() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dplay_session_key");
}
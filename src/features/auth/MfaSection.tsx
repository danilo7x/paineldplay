import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at?: string;
};

type Enroll = {
  factorId: string;
  qr: string;
  secret: string;
  uri: string;
};

export function MfaSection() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error("Erro ao carregar 2FA", { description: error.message });
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const verified = factors.filter((f) => f.status === "verified");
  const hasVerified = verified.length > 0;

  async function startEnroll() {
    setBusy(true);
    // Clean up any leftover unverified factor first
    const pending = factors.find((f) => f.status !== "verified");
    if (pending) {
      await supabase.auth.mfa.unenroll({ factorId: pending.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `DPlay ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error("Não foi possível iniciar 2FA", { description: error?.message });
      return;
    }
    setEnroll({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
    setCode("");
  }

  async function verifyEnroll() {
    if (!enroll) return;
    if (code.length < 6) {
      toast.error("Código inválido", { description: "Informe os 6 dígitos do app." });
      return;
    }
    setBusy(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: enroll.factorId,
    });
    if (chalErr || !chal) {
      setBusy(false);
      toast.error("Falha no desafio", { description: chalErr?.message });
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (verErr) {
      toast.error("Código incorreto", { description: verErr.message });
      return;
    }
    toast.success("2FA ativado");
    setEnroll(null);
    setCode("");
    refresh();
  }

  async function cancelEnroll() {
    if (!enroll) return;
    await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode("");
    refresh();
  }

  async function removeFactor(factorId: string) {
    if (!confirm("Remover a autenticação de dois fatores desta conta?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error("Não foi possível remover", { description: error.message });
      return;
    }
    toast.success("2FA removido");
    refresh();
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              Verificação em duas etapas
            </h2>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Use um app como Google Authenticator, 1Password ou Authy para pedir um código
              de 6 dígitos a cada login.
            </p>
          </div>
          <div>
            {hasVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                <ShieldCheck className="size-3.5" /> Ativado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <ShieldOff className="size-3.5" /> Desativado
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
          </div>
        ) : hasVerified ? (
          <div className="space-y-2">
            {verified.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-muted-foreground" />
                  <span>{f.friendly_name ?? "Autenticador TOTP"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeFactor(f.id)}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Button onClick={startEnroll} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Ativar 2FA
          </Button>
        )}
      </CardContent>

      <Dialog
        open={!!enroll}
        onOpenChange={(v) => {
          if (!v) cancelEnroll();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ativar verificação em duas etapas</DialogTitle>
            <DialogDescription>
              Escaneie o QR code no seu app autenticador e informe o código gerado.
            </DialogDescription>
          </DialogHeader>
          {enroll && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg bg-white p-4">
                <img src={enroll.qr} alt="QR code para 2FA" className="size-48" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Ou digite manualmente
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-border/40 bg-background/50 px-3 py-2 font-mono text-xs">
                    {enroll.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(enroll.secret);
                      toast.success("Copiado");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                <Input
                  id="mfa-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="text-center font-mono text-lg tracking-widest"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelEnroll} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={verifyEnroll} disabled={busy || code.length < 6} className="gap-2">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Verificar e ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
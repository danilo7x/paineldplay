import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/dplay-logo.png.asset.json";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-first-admin`;

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupNome, setSetupNome] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setCheckingSession(false);
      try {
        const res = await fetch(FUNCTIONS_URL, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const json = await res.json();
        setSetupNeeded(!!json.setupNeeded);
      } catch {
        // silencioso
      }
    })();
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email, password, nome: setupNome }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha no setup");
      toast.success("Administrador criado. Faça login.");
      setSetupMode(false);
      setSetupNeeded(false);
    } catch (err) {
      toast.error("Erro no setup", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* fundo com halos azuis sutis */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(600px 400px at 15% 20%, rgba(5,126,243,0.18), transparent 60%), radial-gradient(700px 500px at 85% 90%, rgba(1,87,198,0.22), transparent 65%)",
        }}
      />
      <div className="relative z-10 min-h-screen grid place-items-center px-4 py-10">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center gap-4">
            <img
              src={logo.url}
              alt="DPlay Solutions"
              className="size-16 drop-shadow-[0_8px_24px_rgba(5,126,243,0.45)]"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">DPlay Solutions</h1>
              <p className="text-sm text-muted-foreground">Painel interno</p>
            </div>
          </div>

          <Card className="border-border/60 bg-card/70 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
            <CardContent className="p-6">
              {setupMode ? (
                <form onSubmit={handleSetup} className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Configuração inicial</h2>
                    <p className="text-xs text-muted-foreground">
                      Nenhum administrador cadastrado. Crie o primeiro acesso de sócio.
                    </p>
                  </div>
                  <Field label="Nome">
                    <Input
                      value={setupNome}
                      onChange={(e) => setSetupNome(e.target.value)}
                      placeholder="Seu nome"
                      required
                    />
                  </Field>
                  <Field label="E-mail">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Senha (mín. 8 caracteres)">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Criar administrador
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSetupMode(false)}
                  >
                    Voltar
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Entrar</h2>
                    <p className="text-xs text-muted-foreground">
                      Acesso restrito a colaboradores DPlay.
                    </p>
                  </div>
                  <Field label="E-mail">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@dplaysolutions.com"
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field label="Senha">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Entrar
                  </Button>
                  {setupNeeded && (
                    <button
                      type="button"
                      className="block w-full text-center text-xs text-primary hover:underline"
                      onClick={() => setSetupMode(true)}
                    >
                      Configurar primeiro administrador
                    </button>
                  )}
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} DPlay Solutions · Uso interno
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
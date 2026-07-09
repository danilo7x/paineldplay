import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/dplay-logo-transparent.png.asset.json";

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
  const [mfaStep, setMfaStep] = useState<{ factorId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const blobsData = useMemo(
    () =>
      Array.from({ length: 6 }).map(() => ({
        size: Math.random() * 200 + 150,
        left: Math.random() * 80 + 10,
        top: Math.random() * 80 + 10,
        animationDelay: Math.random() * -20,
        animationDuration: Math.random() * 15 + 15,
      })),
    [],
  );
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      blobRefs.current.forEach((blob, index) => {
        if (blob) {
          const speed = (index + 1) * 20;
          blob.style.marginLeft = `${x * speed}px`;
          blob.style.marginTop = `${y * speed}px`;
        }
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    // Check if MFA challenge is required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
      const { data: fac } = await supabase.auth.mfa.listFactors();
      const totp = (fac?.totp ?? []).find((f) => f.status === "verified");
      if (totp) {
        setMfaStep({ factorId: totp.id });
        setMfaCode("");
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaStep) return;
    if (mfaCode.length < 6) return;
    setLoading(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: mfaStep.factorId,
    });
    if (chalErr || !chal) {
      setLoading(false);
      toast.error("Falha no desafio", { description: chalErr?.message });
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: mfaStep.factorId,
      challengeId: chal.id,
      code: mfaCode,
    });
    setLoading(false);
    if (verErr) {
      toast.error("Código incorreto", { description: verErr.message });
      return;
    }
    toast.success("Bem-vindo!");
    setMfaStep(null);
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleMfaCancel() {
    await supabase.auth.signOut();
    setMfaStep(null);
    setMfaCode("");
    setPassword("");
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
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "#04070d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <style>{`
          @keyframes dplayPulse {
            0%, 100% { transform: scale(1);    opacity: 0.65; }
            50%      { transform: scale(1.12); opacity: 1;    }
          }
        `}</style>
        <img
          src={logo.url}
          alt="DPlay Solutions"
          style={{
            width: 88,
            height: 88,
            animation: "dplayPulse 1.4s ease-in-out infinite",
            filter: "drop-shadow(0 6px 24px rgba(5,126,243,0.55))",
          }}
        />
      </div>
    );
  }

  return (
    <div className="mercury-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;500;800&family=Space+Mono&display=swap');

        .mercury-wrapper {
          --bg: #04070d;
          --mercury: #057EF3;
          --mercury-dark: #0157C6;
          --accent: #ffffff;
          --text-dim: rgba(255, 255, 255, 0.5);
          background-color: var(--bg);
          color: var(--accent);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          width: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .mercury-wrapper * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        .stage {
          position: absolute; inset: 0; z-index: 0;
          filter: url('#dp-gooey'); opacity: 0.55;
        }
        .blob {
          position: absolute;
          background: linear-gradient(135deg, var(--mercury), var(--mercury-dark));
          border-radius: 50%;
          filter: blur(20px);
          animation: dpFloat 20s infinite alternate ease-in-out;
          box-shadow: inset -10px -10px 20px rgba(0,0,0,0.5), 10px 10px 30px rgba(5,126,243,0.25);
          transition: margin 0.1s ease-out;
        }
        @keyframes dpFloat {
          0% { transform: translate(0,0) scale(1); }
          33% { transform: translate(10vw, 20vh) scale(1.2); }
          66% { transform: translate(-5vw, 10vh) scale(0.8); }
          100% { transform: translate(5vw, -10vh) scale(1.1); }
        }
        .auth-container {
          position: relative; z-index: 10;
          width: 100%; max-width: 440px; padding: 40px;
        }
        .brand-row { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .brand-row img { width: 40px; height: 40px; filter: drop-shadow(0 6px 20px rgba(5,126,243,0.55)); }
        .header { margin-bottom: 48px; text-align: left; }
        .brand-id {
          font-family: 'Space Mono', monospace;
          font-size: 10px; letter-spacing: 4px;
          text-transform: uppercase; color: var(--text-dim);
          margin-bottom: 10px; display: block;
        }
        .header h1 {
          font-weight: 800; font-size: 3rem; line-height: 0.9;
          letter-spacing: -2px; margin: 0 0 0 -3px;
        }
        .header p {
          font-family: 'Space Mono', monospace;
          font-size: 11px; color: var(--text-dim);
          margin-top: 14px; text-transform: uppercase; letter-spacing: 2px;
        }
        .form-group {
          position: relative; margin-bottom: 28px;
          transition: transform 0.4s cubic-bezier(0.2,1,0.3,1);
        }
        .form-group:focus-within { transform: translateX(10px); }
        .form-group label {
          display: block; font-family: 'Space Mono', monospace;
          font-size: 11px; color: var(--text-dim);
          margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;
        }
        .form-group input {
          width: 100%; background: transparent; border: none;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          color: var(--accent); padding: 12px 0;
          font-size: 18px; outline: none;
          transition: border-color 0.4s;
          font-family: 'Inter', sans-serif;
        }
        .form-group input::placeholder { color: rgba(255,255,255,0.2); }
        .input-glow {
          position: absolute; bottom: 0; left: 0;
          width: 0%; height: 2px; background: var(--mercury);
          transition: width 0.6s cubic-bezier(0.2,1,0.3,1);
          box-shadow: 0 0 15px var(--mercury);
        }
        .form-group input:focus ~ .input-glow { width: 100%; }
        .submit-wrap {
          margin-top: 44px; position: relative;
          filter: url('#dp-gooey');
        }
        .btn-base {
          background: var(--mercury); color: #04070d;
          border: none; padding: 20px 40px;
          font-size: 13px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 2px;
          cursor: pointer; width: 100%; position: relative;
          z-index: 2; transition: letter-spacing 0.3s, opacity 0.3s;
          font-family: 'Inter', sans-serif;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-base:hover:not(:disabled) { letter-spacing: 4px; }
        .btn-base:disabled { opacity: 0.6; cursor: not-allowed; }
        .mercury-drop {
          position: absolute; top: 50%; left: 50%;
          width: 100%; height: 100%;
          background: var(--mercury);
          transform: translate(-50%, -50%);
          z-index: 1; border-radius: 50px;
          transition: all 0.5s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        .submit-wrap:hover .mercury-drop {
          transform: translate(-50%, -50%) scale(1.05, 1.2);
          filter: brightness(1.15);
        }
        .footer-nav {
          margin-top: 36px; display: flex; justify-content: space-between;
          font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 1px;
        }
        .footer-nav button {
          background: none; border: none; padding: 0; cursor: pointer;
          color: var(--text-dim); text-decoration: none;
          transition: color 0.3s; font-family: inherit; font-size: inherit; letter-spacing: inherit;
          text-transform: uppercase;
        }
        .footer-nav button:hover { color: var(--accent); }
        .svg-filter-hidden { position: absolute; width: 0; height: 0; }
      `}</style>

      <svg className="svg-filter-hidden" aria-hidden>
        <defs>
          <filter id="dp-gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="stage">
        {blobsData.map((data, index) => (
          <div
            key={index}
            ref={(el) => {
              blobRefs.current[index] = el;
            }}
            className="blob"
            style={{
              width: `${data.size}px`,
              height: `${data.size}px`,
              left: `${data.left}%`,
              top: `${data.top}%`,
              animationDelay: `${data.animationDelay}s`,
              animationDuration: `${data.animationDuration}s`,
            }}
          />
        ))}
      </div>

      <main className="auth-container">
        <div className="brand-row">
          <img src={logo.url} alt="DPlay Solutions" />
        </div>
        <header className="header">
          <span className="brand-id">DPlay Solutions · Painel Interno</span>
          <h1>
            ACESSO
            <br />
            RESTRITO
          </h1>
          <p>{setupMode ? "Configuração inicial" : "Somente colaboradores"}</p>
        </header>

        {mfaStep ? (
          <form onSubmit={handleMfaVerify} autoComplete="off">
            <div className="form-group">
              <label>Código do autenticador</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
                style={{ letterSpacing: "0.4em", fontFamily: "'Space Mono', monospace" }}
              />
              <div className="input-glow" />
            </div>
            <div className="submit-wrap">
              <div className="mercury-drop" />
              <button
                type="submit"
                className="btn-base"
                disabled={loading || mfaCode.length < 6}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Verificar
              </button>
            </div>
            <div className="footer-nav">
              <button type="button" onClick={handleMfaCancel}>
                ← Cancelar
              </button>
              <span>2FA obrigatório</span>
            </div>
          </form>
        ) : setupMode ? (
          <form onSubmit={handleSetup} autoComplete="off">
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={setupNome}
                onChange={(e) => setSetupNome(e.target.value)}
                placeholder="Seu nome"
                required
              />
              <div className="input-glow" />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@dplaysolutions.com"
                required
              />
              <div className="input-glow" />
            </div>
            <div className="form-group">
              <label>Senha (mín. 8)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
              <div className="input-glow" />
            </div>
            <div className="submit-wrap">
              <div className="mercury-drop" />
              <button type="submit" className="btn-base" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Criar administrador
              </button>
            </div>
            <div className="footer-nav">
              <button type="button" onClick={() => setSetupMode(false)}>
                ← Voltar ao login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} autoComplete="off">
            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@dplaysolutions.com"
                autoComplete="email"
                required
              />
              <div className="input-glow" />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <div className="input-glow" />
            </div>
            <div className="submit-wrap">
              <div className="mercury-drop" />
              <button type="submit" className="btn-base" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Entrar
              </button>
            </div>
            {setupNeeded && (
              <div className="footer-nav">
                <span>© {new Date().getFullYear()} DPlay</span>
                <button type="button" onClick={() => setSetupMode(true)}>
                  Configurar 1º admin
                </button>
              </div>
            )}
            {!setupNeeded && (
              <div className="footer-nav">
                <span>© {new Date().getFullYear()} DPlay Solutions</span>
                <span>Uso interno</span>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Folder, Receipt, Wallet, StickyNote, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  kind: "projeto" | "venda" | "despesa" | "nota";
  title: string;
  subtitle?: string;
  onSelect: () => void;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener("dplay:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dplay:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const like = `%${term}%`;
    const run = async () => {
      const [projects, sales, expenses, notes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, nome, cliente")
          .or(`nome.ilike.${like},cliente.ilike.${like},descricao.ilike.${like}`)
          .limit(6),
        supabase
          .from("sales")
          .select("id, cliente_nome, cliente_email, valor")
          .or(`cliente_nome.ilike.${like},cliente_email.ilike.${like},observacoes.ilike.${like}`)
          .limit(6),
        supabase
          .from("expenses")
          .select("id, descricao, valor")
          .ilike("descricao", like)
          .limit(6),
        supabase
          .from("notes")
          .select("id, titulo, conteudo")
          .or(`titulo.ilike.${like},conteudo.ilike.${like}`)
          .limit(6),
      ]);
      if (cancelled) return;
      const out: Result[] = [];
      (projects.data ?? []).forEach((p) =>
        out.push({
          id: `p-${p.id}`,
          kind: "projeto",
          title: p.nome,
          subtitle: p.cliente ?? undefined,
          onSelect: () => navigate({ to: "/projetos/$id", params: { id: p.id } }),
        }),
      );
      (sales.data ?? []).forEach((s) =>
        out.push({
          id: `s-${s.id}`,
          kind: "venda",
          title: s.cliente_nome,
          subtitle: s.cliente_email ?? `R$ ${Number(s.valor).toLocaleString("pt-BR")}`,
          onSelect: () => navigate({ to: "/faturamento" }),
        }),
      );
      (expenses.data ?? []).forEach((e) =>
        out.push({
          id: `e-${e.id}`,
          kind: "despesa",
          title: e.descricao,
          subtitle: `R$ ${Number(e.valor).toLocaleString("pt-BR")}`,
          onSelect: () => navigate({ to: "/financeiro" }),
        }),
      );
      (notes.data ?? []).forEach((n) =>
        out.push({
          id: `n-${n.id}`,
          kind: "nota",
          title: n.titulo || "Sem título",
          subtitle: (n.conteudo ?? "").slice(0, 60),
          onSelect: () => navigate({ to: "/notas" }),
        }),
      );
      setResults(out);
      setLoading(false);
    };
    const t = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setLoading(false);
    };
  }, [q, navigate]);

  const groups = useMemo(() => {
    const g: Record<string, Result[]> = { projeto: [], venda: [], despesa: [], nota: [] };
    results.forEach((r) => g[r.kind].push(r));
    return g;
  }, [results]);

  const handleSelect = (r: Result) => {
    setOpen(false);
    setQ("");
    r.onSelect();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Buscar projetos, vendas, despesas, notas…"
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-3 animate-spin" /> Buscando…
          </div>
        )}
        {!loading && q.trim() && results.length === 0 && (
          <CommandEmpty>Nenhum resultado.</CommandEmpty>
        )}
        {!loading && !q.trim() && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Digite para buscar. Atalho: <kbd className="rounded bg-muted px-1">⌘K</kbd>
          </div>
        )}
        {groups.projeto.length > 0 && (
          <CommandGroup heading="Projetos">
            {groups.projeto.map((r) => (
              <CommandItem key={r.id} value={`${r.title} ${r.subtitle ?? ""} ${r.id}`} onSelect={() => handleSelect(r)}>
                <Folder className="mr-2 size-4 text-primary" />
                <div className="flex flex-col">
                  <span>{r.title}</span>
                  {r.subtitle && <span className="text-xs text-muted-foreground">{r.subtitle}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.venda.length > 0 && (
          <CommandGroup heading="Vendas / Clientes">
            {groups.venda.map((r) => (
              <CommandItem key={r.id} value={`${r.title} ${r.subtitle ?? ""} ${r.id}`} onSelect={() => handleSelect(r)}>
                <Receipt className="mr-2 size-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span>{r.title}</span>
                  {r.subtitle && <span className="text-xs text-muted-foreground">{r.subtitle}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.despesa.length > 0 && (
          <CommandGroup heading="Despesas">
            {groups.despesa.map((r) => (
              <CommandItem key={r.id} value={`${r.title} ${r.subtitle ?? ""} ${r.id}`} onSelect={() => handleSelect(r)}>
                <Wallet className="mr-2 size-4 text-amber-400" />
                <div className="flex flex-col">
                  <span>{r.title}</span>
                  {r.subtitle && <span className="text-xs text-muted-foreground">{r.subtitle}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.nota.length > 0 && (
          <CommandGroup heading="Notas">
            {groups.nota.map((r) => (
              <CommandItem key={r.id} value={`${r.title} ${r.subtitle ?? ""} ${r.id}`} onSelect={() => handleSelect(r)}>
                <StickyNote className="mr-2 size-4 text-sky-400" />
                <div className="flex flex-col">
                  <span>{r.title}</span>
                  {r.subtitle && <span className="text-xs text-muted-foreground">{r.subtitle}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function openGlobalSearch() {
  window.dispatchEvent(new Event("dplay:open-search"));
}

export function GlobalSearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => openGlobalSearch()}
      className="relative hidden h-8 w-full max-w-sm items-center gap-2 rounded-full border border-border/50 bg-card/40 pl-8 pr-3 text-left text-xs text-muted-foreground transition hover:border-border md:flex"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <span className="flex-1">Buscar…</span>
      <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
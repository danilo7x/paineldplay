import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, StickyNote, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  titulo: string | null;
  conteudo: string;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/notas")({
  component: NotasPage,
});

function NotasPage() {
  const { user } = Route.useRouteContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Erro ao carregar", { description: error.message });
    setNotes((data ?? []) as Note[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  function openNew() {
    setActiveId("new");
    setTitulo("");
    setConteudo("");
  }
  function openNote(n: Note) {
    setActiveId(n.id);
    setTitulo(n.titulo ?? "");
    setConteudo(n.conteudo);
  }

  async function save() {
    setSaving(true);
    if (activeId === "new") {
      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: user.id, titulo: titulo || null, conteudo })
        .select()
        .maybeSingle();
      setSaving(false);
      if (error) return toast.error("Erro ao salvar", { description: error.message });
      if (data) setActiveId(data.id);
      toast.success("Nota criada");
    } else if (activeId) {
      const { error } = await supabase
        .from("notes")
        .update({ titulo: titulo || null, conteudo })
        .eq("id", activeId);
      setSaving(false);
      if (error) return toast.error("Erro ao salvar", { description: error.message });
      toast.success("Nota atualizada");
    }
    fetchAll();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    if (activeId === id) setActiveId(null);
    fetchAll();
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pessoal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Espaço privado só seu. Ninguém mais vê estas notas.
          </p>
        </div>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="size-4" /> Nova nota
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Sem notas ainda.
              </div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNote(n)}
                  className={cn(
                    "block w-full rounded-xl p-3 text-left transition",
                    activeId === n.id ? "bg-primary/15" : "hover:bg-white/5",
                  )}
                >
                  <p className="truncate text-sm font-medium">
                    {n.titulo || "Sem título"}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {n.conteudo || "—"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.updated_at).toLocaleString("pt-BR")}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="p-6">
            {activeId ? (
              <div className="space-y-4">
                <Input
                  placeholder="Título"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="h-11 rounded-xl border-border/50 bg-card/60 text-lg font-semibold"
                />
                <Textarea
                  placeholder="Escreva sua nota…"
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  rows={16}
                  className="rounded-xl border-border/50 bg-card/60"
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-300 hover:text-rose-200"
                    onClick={() => activeId !== "new" && remove(activeId)}
                    disabled={activeId === "new"}
                  >
                    <Trash2 className="mr-1 size-3.5" /> Excluir
                  </Button>
                  <Button onClick={save} disabled={saving} className="gap-2">
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                <StickyNote className="size-8 opacity-60" />
                <p className="text-sm">Selecione uma nota ou crie uma nova.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

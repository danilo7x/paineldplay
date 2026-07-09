import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { notifyProfileUpdated } from "@/lib/profile-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

type Profile = {
  nome: string | null;
  email: string | null;
  cargo: string | null;
  telefone: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
};

function PerfilPage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile>({
    nome: "",
    email: user.email ?? "",
    cargo: "",
    telefone: "",
    bio: "",
    avatar_url: null,
    cover_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome, email, cargo, telefone, bio, avatar_url, cover_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar perfil", { description: error.message });
      if (data) setProfile(data);
      setLoading(false);
    })();
  }, [user.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: profile.nome,
        cargo: profile.cargo,
        telefone: profile.telefone,
        bio: profile.bio,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Perfil atualizado");
    notifyProfileUpdated();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? null;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (updErr) throw updErr;
      setProfile((p) => ({ ...p, avatar_url: url }));
      toast.success("Avatar atualizado");
      notifyProfileUpdated();
    } catch (err) {
      toast.error("Falha no upload", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? null;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ cover_url: url })
        .eq("id", user.id);
      if (updErr) throw updErr;
      setProfile((p) => ({ ...p, cover_url: url }));
      toast.success("Capa atualizada");
    } catch (err) {
      toast.error("Falha no upload", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setUploadingCover(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function handleRemoveCover() {
    const { error } = await supabase
      .from("profiles")
      .update({ cover_url: null })
      .eq("id", user.id);
    if (error) {
      toast.error("Erro ao remover capa", { description: error.message });
      return;
    }
    setProfile((p) => ({ ...p, cover_url: null }));
    toast.success("Capa removida");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const initial = (profile.nome ?? profile.email ?? "?")[0]?.toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Pessoal</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estas informações aparecem para outros membros do painel.
        </p>
      </header>

      <Card className="border-border/50 bg-card/60 backdrop-blur">
        <CardContent className="p-0">
          <div className="relative h-40 w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-primary/20 via-primary/10 to-background sm:h-52">
            {profile.cover_url ? (
              <img
                src={profile.cover_url}
                alt="Capa do perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Adicione uma capa opcional
              </div>
            )}
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadCover}
            />
            <div className="absolute right-3 top-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5 bg-background/80 backdrop-blur"
                onClick={() => coverInput.current?.click()}
                disabled={uploadingCover}
              >
                {uploadingCover ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="size-3.5" />
                )}
                {profile.cover_url ? "Trocar capa" : "Adicionar capa"}
              </Button>
              {profile.cover_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 bg-background/80 backdrop-blur"
                  onClick={handleRemoveCover}
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </Button>
              )}
            </div>
          </div>
          <div className="p-6">
          <div className="flex flex-wrap items-center gap-6">
            <Avatar className="size-20">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.nome ?? ""} />
              <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Trocar avatar
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG. Até 2 MB.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={profile.nome ?? ""}
                onChange={(e) => setProfile({ ...profile, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={profile.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={profile.cargo ?? ""}
                onChange={(e) => setProfile({ ...profile, cargo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={profile.telefone ?? ""}
                onChange={(e) => setProfile({ ...profile, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio ?? ""}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={4}
                placeholder="Uma breve descrição sobre você"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
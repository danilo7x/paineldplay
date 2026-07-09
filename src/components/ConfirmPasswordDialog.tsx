import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirmed: () => Promise<void> | void;
};

/**
 * Re-authenticates the current user by password before running a destructive action.
 * Verifies via supabase.auth.signInWithPassword using the currently signed-in email.
 */
export function ConfirmPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  danger = false,
  onConfirmed,
}: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email;
      if (!email) throw new Error("Sessão expirada. Faça login novamente.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Senha incorreta", { description: "Confirme sua senha atual." });
        setLoading(false);
        return;
      }
      await onConfirmed();
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível confirmar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {danger && <ShieldAlert className="size-5 text-destructive" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Sua senha atual</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !password}
              variant={danger ? "destructive" : "default"}
              className="gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
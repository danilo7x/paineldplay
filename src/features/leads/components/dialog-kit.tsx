import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_CHANNELS, type Lead } from "../model";

export type LeadDialogProps = {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
};

export function DialogActions({
  onCancel,
  onConfirm,
  pending,
  disabled,
  error,
  label = "Registrar",
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  disabled?: boolean;
  error?: string | null;
  label?: string;
}) {
  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={pending || disabled}>
          {pending && <Loader2 className="size-4 animate-spin" />} {label}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Confirmação no estilo do app (no lugar do confirm() do navegador). */
export type ConfirmRequest = {
  title: string;
  description: string;
  label: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onClose,
  pending = false,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={!!request} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={request?.destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => request?.onConfirm()}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} {request?.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ChannelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>Canal</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTACT_CHANNELS.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** "Ver mais" simples: esconde o conteúdo secundário até a pessoa pedir. */
export function Disclosure({
  label,
  labelOpen,
  defaultOpen = false,
  className,
  children,
}: {
  label: string;
  labelOpen?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("space-y-4", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? (labelOpen ?? label) : label}
      </button>
      {open && children}
    </div>
  );
}

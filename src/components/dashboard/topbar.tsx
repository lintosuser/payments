"use client";

import { cn } from "@/lib/utils";

export function Topbar({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 border-b border-border pb-6 mb-8")}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

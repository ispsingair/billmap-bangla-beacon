import { cva } from "class-variance-authority";
import { STATUS_LABEL, type BillStatus } from "@/lib/billing";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", {
  variants: {
    status: {
      paid: "bg-paid text-paid-foreground",
      unpaid: "bg-due text-due-foreground",
      overdue: "bg-overdue text-overdue-foreground",
    },
  },
});

export function StatusBadge({ status, className }: { status: BillStatus; className?: string }) {
  return <span className={cn(badge({ status }), className)}>{STATUS_LABEL[status]}</span>;
}

export function StatusDot({ status }: { status: BillStatus }) {
  const cls = { paid: "bg-paid", unpaid: "bg-due", overdue: "bg-overdue" }[status];
  return <span className={cn("inline-block size-2.5 rounded-full", cls)} />;
}

export type BillStatus = "paid" | "unpaid" | "overdue";

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Paid when nothing is owed; overdue once the due date has passed; otherwise unpaid. */
export function customerStatus(dueAmount: number, dueDate: string, today: string = todayISO()): BillStatus {
  if (Number(dueAmount) <= 0) return "paid";
  return dueDate < today ? "overdue" : "unpaid";
}

export function formatBDT(n: number | null | undefined): string {
  return "৳" + Math.round(Number(n ?? 0)).toLocaleString("en-IN");
}

/** External directions link to the customer's stored coordinates. No origin is sent. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export const STATUS_LABEL: Record<BillStatus, string> = {
  paid: "Paid",
  unpaid: "Due",
  overdue: "Overdue",
};

export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "bank"] as const;

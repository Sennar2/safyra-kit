import { cn } from "@/lib/utils";

type Status = "green" | "amber" | "red";

const statusConfig: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  green: { label: "Compliant", dot: "bg-status-green", bg: "bg-status-green-bg", text: "text-status-green" },
  amber: { label: "At Risk", dot: "bg-status-amber", bg: "bg-status-amber-bg", text: "text-status-amber" },
  red: { label: "Non-Compliant", dot: "bg-status-red", bg: "bg-status-red-bg", text: "text-status-red" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", config.bg, config.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

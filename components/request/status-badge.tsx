import { cn } from "@/lib/utils"

type RequestStatus = "PENDING" | "PAID" | "DECLINED" | "EXPIRED" | "CANCELLED"

const styles: Record<RequestStatus, string> = {
  PENDING: "bg-accent/15 text-accent ring-accent/30",
  PAID: "bg-green-100 text-green-900 ring-green-200",
  DECLINED: "bg-red-100 text-red-900 ring-red-200",
  EXPIRED: "bg-gray-100 text-gray-900 ring-gray-200",
  CANCELLED: "bg-gray-100 text-gray-900 ring-gray-200",
}

export function StatusBadge({ status }: { status: RequestStatus | string }) {
  const s = (status as RequestStatus) in styles ? (status as RequestStatus) : "PENDING"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[s]
      )}
    >
      {s}
    </span>
  )
}


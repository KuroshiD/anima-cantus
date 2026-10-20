import { addDaysIso } from "./dates";

export type RepertoireDeadline = "none" | "approaching" | "overdue";

export function classifyRepertoireDeadline(input: {
  status: string;
  filledCount: number;
  momentCount: number;
  windowEnd: string;
  today: string;
  leadDays: number;
}): RepertoireDeadline {
  if (input.status !== "EM_ANDAMENTO") return "none";
  if (input.filledCount >= input.momentCount) return "none";
  if (input.today < addDaysIso(input.windowEnd, -input.leadDays)) return "none";
  if (input.today > input.windowEnd) return "overdue";
  return "approaching";
}

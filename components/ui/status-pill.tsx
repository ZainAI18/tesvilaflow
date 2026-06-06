const tones: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  neutral: "bg-slate-100 text-slate-700",
  danger: "bg-red-50 text-red-700"
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: keyof typeof tones }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium ${tones[tone]}`}>{label}</span>;
}

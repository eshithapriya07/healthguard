export default function Spinner({ label }) {
  return (
    <div className="flex items-center gap-3 text-slate-500" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

import { Wrench } from "lucide-react";

export default function Spinner({
  size = 22,
  label,
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}) {
  const spinner = (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size * 2, height: size * 2 }}>
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600"
          style={{ animationDuration: "0.8s" }}
        />
        <Wrench size={size} className="text-blue-600" strokeWidth={2} />
      </div>
      {label && <p className="text-xs text-neutral-500">{label}</p>}
    </div>
  );

  if (!fullscreen) return spinner;

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      {spinner}
    </div>
  );
}

/** Small inline variant for buttons ("Saving…" style states). */
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`}
    />
  );
}

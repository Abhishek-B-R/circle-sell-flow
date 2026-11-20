import { ChevronDown } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/** Joins class names; later Tailwind classes win over conflicting earlier ones. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85 disabled:bg-ink/40",
  secondary: "bg-surface text-ink border border-line-2 hover:border-ink-3 disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-ink/5 hover:text-ink",
  danger: "text-danger hover:bg-danger-soft",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed",
          size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

const control =
  "w-full rounded-[10px] border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-canvas disabled:text-ink-3";
const controlBorder = (invalid?: boolean) => (invalid ? "border-danger focus:border-danger" : "border-line-2 focus:border-brand");

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, controlBorder(invalid), "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { invalid, className, ...props },
  ref,
) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, controlBorder(invalid), "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { invalid, className, ...props },
  ref,
) {
  // className sizes the wrapper, so callers can set widths without fighting w-full.
  return (
    <div className={cn("relative h-11 w-full", className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, controlBorder(invalid), "h-full appearance-none pr-9", !props.value && "text-ink-3")}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
});

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-brand" : "bg-line-2",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" | "danger"; className?: string }) {
  const tones = {
    neutral: "bg-ink/[0.06] text-ink-2",
    brand: "bg-brand-soft text-brand-ink",
    warn: "bg-warn-soft text-[#7a5a00]",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>{children}</div>;
}

/** Label, help text and error message around any input. */
export function FieldShell({
  id,
  label,
  required,
  help,
  error,
  children,
  aside,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string | null;
  error?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required ? (
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          ) : (
            <span className="font-normal text-ink-3"> (optional)</span>
          )}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-[13px] text-ink-3">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-2 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}

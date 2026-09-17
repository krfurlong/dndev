import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
} from 'react';
import { X, ChevronDown, Check, ExternalLink } from 'lucide-react';
export function Button({
  children,
  variant = 'secondary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  children: ReactNode;
}) {
  return (
    <button {...props} className={['button', variant, props.className].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
function useBufferedValue(value: string | number) {
  const [text, setText] = useState(String(value));
  const sent = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (sent.current === undefined || String(value) === sent.current) {
      setText(String(value));
      sent.current = undefined;
    }
  }, [value]);
  return {
    text,
    change: (next: string) => {
      sent.current = next;
      setText(next);
    },
    blur: () => {
      sent.current = undefined;
      setText(String(value));
    },
  };
}
export function Input({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  placeholder,
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
}) {
  const buffered = useBufferedValue(value);
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={buffered.text}
        onBlur={buffered.blur}
        onChange={(e) => {
          buffered.change(e.target.value);
          onChange(e.target.value);
        }}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </Field>
  );
}
export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const buffered = useBufferedValue(value);
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        value={buffered.text}
        onBlur={buffered.blur}
        onChange={(e) => {
          buffered.change(e.target.value);
          onChange(e.target.value);
        }}
      />
    </Field>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </Field>
  );
}
export function CheckBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
let modalCounter = 0;
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [id] = useState(() => ++modalCounter);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      queueMicrotask(() => opener?.focus());
    };
  }, []);
  return (
    <dialog
      className={'modal ' + (wide ? 'wide' : '')}
      ref={ref}
      aria-labelledby={'dialog-' + id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={'dialog-' + id}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'error' | 'success';
}) {
  return (
    <div className={'notice ' + tone} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  return /^https:\/\//.test(url) ? (
    <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={12} />
    </a>
  ) : (
    <span>{children}</span>
  );
}
export function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="dropdown">
      <summary className="button secondary">
        {label}
        <ChevronDown size={16} />
      </summary>
      <div
        className="dropdown-content"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button'))
            (e.currentTarget.parentElement as HTMLDetailsElement).open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={'pill ' + tone}>
      {tone === 'success' && <Check size={12} />} {children}
    </span>
  );
}
export const number = (value: string, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

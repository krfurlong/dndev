import { useEffect, useState } from 'react';
import { Check, Sun, Moon, Monitor } from 'lucide-react';
import { Modal, Button } from './common';
export type Style = 'modern' | 'subtle' | 'strong';
export type Mode = 'light' | 'dark' | 'system';
export function useAppearance() {
  const [style, setStyle] = useState<Style>(
    () => (localStorage.getItem('dndev.style') as Style) || 'modern',
  );
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem('dndev.mode') as Mode) || 'system',
  );
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.style = style;
      document.documentElement.dataset.mode =
        mode === 'system' ? (query.matches ? 'dark' : 'light') : mode;
    };
    apply();
    query.addEventListener('change', apply);
    localStorage.setItem('dndev.style', style);
    localStorage.setItem('dndev.mode', mode);
    return () => query.removeEventListener('change', apply);
  }, [style, mode]);
  return { style, setStyle, mode, setMode };
}
export function ThemeDialog({
  appearance,
  onClose,
}: {
  appearance: ReturnType<typeof useAppearance>;
  onClose: () => void;
}) {
  const { style, setStyle, mode, setMode } = appearance;
  return (
    <Modal title="Make it yours" onClose={onClose}>
      <p className="muted">A different atmosphere. The same familiar sheet.</p>
      <div className="theme-options">
        {(['modern', 'subtle', 'strong'] as Style[]).map((s, i) => (
          <button
            key={s}
            className={'theme-option ' + (style === s ? 'selected' : '')}
            onClick={() => setStyle(s)}
            aria-pressed={style === s}
          >
            <div className={'theme-preview ' + s}>
              <span />
              <span />
              <span />
            </div>
            <strong>{['Modern', 'Subtle Fantasy', 'Strong Fantasy'][i]}</strong>
            <small>
              {
                [
                  'Clean lines. Clear focus.',
                  'A little wonder at the table.',
                  'For a more epic chapter.',
                ][i]
              }
            </small>
            {style === s && <Check className="theme-check" size={16} />}
          </button>
        ))}
      </div>
      <div className="segmented" aria-label="Color mode">
        {(['light', 'dark', 'system'] as Mode[]).map((m, i) => (
          <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {i === 0 ? <Sun size={16} /> : i === 1 ? <Moon size={16} /> : <Monitor size={16} />}{' '}
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

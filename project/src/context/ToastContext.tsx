import { createContext, useCallback, useContext, useRef, useState } from 'react';

type Toast = { id: string; message: string; kind: 'error' | 'info' | 'success' };

const ToastContext = createContext<(message: string, kind?: Toast['kind']) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, kind: Toast['kind'] = 'error') => {
    const id = `t${++counter.current}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none w-full px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-sheet ${
              t.kind === 'error'
                ? 'bg-red-500/15 text-red-200 border border-red-500/30'
                : t.kind === 'success'
                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                : 'glass-strong text-neutral-100'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

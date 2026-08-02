import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Bell, CheckCircle2, AlertTriangle, X } from "lucide-react";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  type?: "info" | "success" | "warning" | "error";
};

type ToastContextType = {
  addToast: (title: string, description?: string, type?: ToastItem["type"]) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Global event listener system to allow triggering toasts from anywhere
type ToastEventListener = (title: string, description?: string, type?: ToastItem["type"]) => void;
const listeners = new Set<ToastEventListener>();
const lastToastTimes = new Map<string, number>();

export function triggerAnimatedToast(
  title: string,
  description?: string,
  type: ToastItem["type"] = "info",
) {
  listeners.forEach((listener) => listener(title, description, type));
}

export function AnimatedToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (title: string, description?: string, type: ToastItem["type"] = "info") => {
      const key = `${title}::${description ?? ""}`;
      const now = Date.now();
      const lastTime = lastToastTimes.get(key);

      // Deduplicate: Don't add if identical toast was added in the last 500ms
      if (lastTime && now - lastTime < 500) {
        return;
      }
      lastToastTimes.set(key, now);

      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, description, type }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleEvent: ToastEventListener = (title, description, type) => {
      addToast(title, description, type);
    };
    listeners.add(handleEvent);
    return () => {
      listeners.delete(handleEvent);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* High-level global container positioned at top-4 right-4 z-[9999] */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <AnimatedToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useAnimatedToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: triggerAnimatedToast,
      removeToast: () => {},
    };
  }
  return context;
}

export function AnimatedToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <AnimatedToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AnimatedToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Unmount and slide out after 2 seconds
    const timer = setTimeout(() => {
      setExiting(true);
      const dismissTimer = setTimeout(() => {
        onDismiss(toast.id);
      }, 300);
      return () => clearTimeout(dismissTimer);
    }, 2000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
      default:
        return <Bell className="h-5 w-5 text-primary shrink-0" />;
    }
  };

  const getProgressBarColor = () => {
    switch (toast.type) {
      case "warning":
        return "bg-amber-500";
      case "error":
        return "bg-destructive";
      case "success":
        return "bg-emerald-500";
      default:
        return "bg-primary";
    }
  };

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl transition-all duration-300 transform ${
        exiting
          ? "translate-x-full opacity-0"
          : "translate-x-0 opacity-100 animate-in slide-in-from-right duration-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {getIcon()}
          <div>
            <h4 className="font-semibold text-sm text-foreground tracking-tight">{toast.title}</h4>
            {toast.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            setExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2-second shrinking progress bar at absolute bottom */}
      <div className="absolute bottom-0 left-0 h-1.5 w-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full ${getProgressBarColor()} animate-[shrink_2s_linear]`}
        />
      </div>
    </div>
  );
}

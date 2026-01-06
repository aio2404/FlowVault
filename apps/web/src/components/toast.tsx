'use client';

import { useToastStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-slide-in',
            'bg-card text-card-foreground',
            toast.variant === 'success' && 'border-success/50 bg-success/10',
            toast.variant === 'destructive' && 'border-destructive/50 bg-destructive/10'
          )}
        >
          {toast.variant === 'success' && (
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          )}
          {toast.variant === 'destructive' && (
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          )}
          {!toast.variant && <Info className="h-5 w-5 text-primary shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{toast.title}</p>
            {toast.description && (
              <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}




import { useEffect } from 'react';
import { clsx } from 'clsx';

interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onClose: (id: string) => void;
}

export const Notification = ({ id, type, message, onClose }: NotificationProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const typeClasses = {
    success: 'bg-emerald-500/90 border-emerald-400/50',
    error: 'bg-red-500/90 border-red-400/50',
    warning: 'bg-amber-500/90 border-amber-400/50',
    info: 'bg-blue-500/90 border-blue-400/50',
  };

  const iconClasses = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle',
  };

  return (
    <div className={clsx(
      'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-lg text-white font-semibold shadow-lg',
      'transform transition-all duration-300 ease-out',
      'animate-in slide-in-from-right-full',
      typeClasses[type]
    )}>
      <i className={iconClasses[type]} />
      <span>{message}</span>
      <button
        onClick={() => onClose(id)}
        className="ml-2 text-white/80 hover:text-white"
      >
        <i className="fas fa-times text-sm" />
      </button>
    </div>
  );
};
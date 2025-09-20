import { useState, useCallback } from 'react';
import type { NotificationOptions } from '@/types';

interface Notification extends NotificationOptions {
  id: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (message: string, type: NotificationOptions['type'] = 'info', duration = 3000) => {
      const id = Date.now().toString();
      const notification: Notification = { id, message, type };
      
      setNotifications(prev => [...prev, notification]);
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    showNotification,
    removeNotification,
  };
};
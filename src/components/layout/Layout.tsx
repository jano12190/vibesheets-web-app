import { ReactNode } from 'react';
import { Header } from './Header';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification } from '@/components/ui/Notification';

interface LayoutProps {
  children: ReactNode;
  onCreateProject?: () => void;
}

export const Layout = ({ children, onCreateProject }: LayoutProps) => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="min-h-screen p-5 sm:p-10 lg:p-20">
      <Header onCreateProject={onCreateProject} />
      <main>{children}</main>
      
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            {...notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </div>
  );
};
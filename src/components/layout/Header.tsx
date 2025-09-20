import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onCreateProject?: () => void;
}

export const Header = ({ onCreateProject }: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isProjectsPage = location.pathname === '/projects';

  return (
    <header className="glass-card mb-8 p-5">
      <div className="flex items-center justify-between">
        <Link to="/" className="glass-card px-8 py-4 text-xl font-semibold">
          Vibesheets
        </Link>
        
        <div className="flex items-center gap-4">
          {isProjectsPage && (
            <>
              <span className="text-white/90 font-medium hidden sm:block">
                Projects
              </span>
              <Button onClick={onCreateProject} size="sm">
                <i className="fas fa-plus mr-2" />
                <span className="hidden sm:inline">Create New Project</span>
                <span className="sm:hidden">New</span>
              </Button>
            </>
          )}
          
          <div className="relative">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <i className="fas fa-bars text-xl" />
            </button>
            
            {isMobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="absolute top-12 right-0 z-20 w-64 glass-modal p-4 space-y-2">
                  <Link
                    to="/dashboard"
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white/10 transition-colors text-white"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="flex items-center gap-3">
                      <i className="fas fa-tachometer-alt w-5" />
                      Dashboard
                    </span>
                    <i className="fas fa-chevron-right text-sm opacity-70" />
                  </Link>
                  <Link
                    to="/projects"
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white/10 transition-colors text-white"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="flex items-center gap-3">
                      <i className="fas fa-project-diagram w-5" />
                      Projects
                    </span>
                    <i className="fas fa-chevron-right text-sm opacity-70" />
                  </Link>
                  <Link
                    to="/account"
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white/10 transition-colors text-white"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="flex items-center gap-3">
                      <i className="fas fa-user w-5" />
                      Account
                    </span>
                    <i className="fas fa-chevron-right text-sm opacity-70" />
                  </Link>
                  <button
                    onClick={() => {
                      console.log('Logout functionality to be implemented');
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white/10 transition-colors text-white w-full text-left"
                  >
                    <span className="flex items-center gap-3">
                      <i className="fas fa-sign-out-alt w-5" />
                      Logout
                    </span>
                    <i className="fas fa-chevron-right text-sm opacity-70" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useTransition,
  Suspense,
} from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { User, Settings, LogOut } from 'lucide-react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { getProfileUrlFromUsername } from '@/lib/utils/profile-url';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import type { User as AuthUser } from '@/lib/auth/utils';
import { logger } from '@/lib/utils/logger';

interface UnifiedLoginWidgetProps {
  compact?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

// Loading component for Suspense boundary
const LoginLoadingFallback = memo(() => <div className="text-sm text-gray-400">Loading...</div>);
LoginLoadingFallback.displayName = 'LoginLoadingFallback';

// Auth modal that uses the real LoginForm/RegisterForm components with full 2FA support
const AuthModal = memo<{
  showModal: boolean;
  modalType: 'login' | 'register' | 'forgot-password';
  onClose: () => void;
  onSetMode: (mode: 'login' | 'register' | 'forgot-password') => void;
  onAuthSuccess: (user: AuthUser) => void;
}>(({ showModal, modalType, onClose, onSetMode, onAuthSuccess }) => {
  if (!showModal) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md">
        {/* Close button - positioned inside the modal card */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xl text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          aria-label="Close dialog"
        >
          ×
        </button>

        {/* Render the appropriate form component */}
        {modalType === 'login' && (
          <LoginForm
            onLogin={onAuthSuccess}
            onSwitchToRegister={() => onSetMode('register')}
            onForgotPassword={() => onSetMode('forgot-password')}
          />
        )}
        {modalType === 'register' && (
          <RegisterForm onRegister={onAuthSuccess} onSwitchToLogin={() => onSetMode('login')} />
        )}
        {modalType === 'forgot-password' && (
          <ForgotPasswordForm onBackToLogin={() => onSetMode('login')} />
        )}
      </div>
    </div>
  );
});

AuthModal.displayName = 'AuthModal';

// Memoized user dropdown component
const UserDropdown = memo<{
  user: any;
  showDropdown: boolean;
  onToggle: () => void;
  onLogout: () => void;
  compact?: boolean;
}>(({ user, showDropdown, onToggle, onLogout }) => {
  const buttonClass =
    'header-action-btn flex h-8 items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors text-blue-400 hover:text-blue-300 border border-blue-600 hover:border-blue-500';

  const dropdownClass =
    'absolute right-0 mt-2 w-56 rounded-lg shadow-lg z-50 border border-gray-700';

  return (
    <div className="user-dropdown-container relative">
      <button onClick={onToggle} className={buttonClass}>
        <span>{user.display_name || user.username}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {showDropdown && (
        <div
          className={dropdownClass}
          style={{
            backgroundColor: 'rgb(17, 24, 39)',
            opacity: 1,
            isolation: 'isolate',
          }}
        >
          <div className="border-b border-gray-700 px-4 py-3">
            <p className="text-sm font-medium text-white">{user.display_name || user.username}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>

          <div className="py-1">
            <Link
              href={getProfileUrlFromUsername(user.username)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
              onClick={() => onToggle()}
            >
              <User size={18} className="flex-shrink-0" />
              <span>View Profile</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
              onClick={() => onToggle()}
            >
              <Settings size={18} className="flex-shrink-0" />
              <span>Settings</span>
            </Link>
          </div>

          <div className="border-t border-gray-700 py-1">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-gray-800 hover:text-red-300"
            >
              <LogOut size={18} className="flex-shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

UserDropdown.displayName = 'UserDropdown';

// Main component with React 19 optimizations
export const UnifiedLoginWidget = memo<UnifiedLoginWidgetProps>(
  ({ compact = false, variant = 'default', className = '' }) => {
    const { user, loading: checkingAuth, logout } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'login' | 'register' | 'forgot-password'>('login');
    const [showDropdown, setShowDropdown] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-dropdown-container')) {
          setShowDropdown(false);
        }
      };

      if (showDropdown) {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
      }
    }, [showDropdown]);

    const openModal = useCallback((type: 'login' | 'register') => {
      startTransition(() => {
        setModalType(type);
        setShowModal(true);
      });
    }, []);

    const closeModal = useCallback(() => {
      startTransition(() => {
        setShowModal(false);
        // Reset to login when closing
        setModalType('login');
      });
    }, []);

    const setMode = useCallback((mode: 'login' | 'register' | 'forgot-password') => {
      startTransition(() => {
        setModalType(mode);
      });
    }, []);

    const handleAuthSuccess = useCallback(
      async (_user: AuthUser) => {
        closeModal();
        // Wait a brief moment for session cookie to be fully established
        await new Promise(resolve => setTimeout(resolve, 100));
        // Use hard redirect to refresh server components with new auth state
        window.location.reload();
      },
      [closeModal]
    );

    const handleLogout = useCallback(async () => {
      try {
        await logout();
        setShowDropdown(false);
      } catch (error) {
        logger.error('Logout error:', error);
      }
    }, [logout]);

    const toggleDropdown = useCallback(() => {
      setShowDropdown(!showDropdown);
    }, [showDropdown]);

    // Memoize button classes based on variant
    const buttonClasses = useMemo(() => {
      const base = 'transition-colors font-medium';
      const variants = {
        default: compact
          ? 'px-2 py-1 text-xs border rounded'
          : 'px-3 py-1.5 text-sm border rounded',
        compact: 'px-2 py-1 text-xs border rounded',
        minimal: 'text-sm hover:underline',
      };
      return `${base} ${variants[variant]}`;
    }, [compact, variant]);

    // Don't render anything while checking auth
    if (checkingAuth) {
      return <LoginLoadingFallback />;
    }

    // Logged in state - show user dropdown
    if (user) {
      return (
        <Suspense fallback={<LoginLoadingFallback />}>
          <div className={className}>
            <UserDropdown
              user={user}
              showDropdown={showDropdown}
              onToggle={toggleDropdown}
              onLogout={handleLogout}
              compact={compact}
            />
          </div>
        </Suspense>
      );
    }

    // Not logged in - show login/register buttons
    const renderButtons = () => (
      <>
        <button
          onClick={() => openModal('login')}
          className={`${buttonClasses} ${variant === 'minimal' ? 'text-blue-400 hover:text-blue-300' : 'border-blue-600 text-blue-400 hover:border-blue-500 hover:text-blue-300'}`}
          disabled={isPending}
        >
          Login
        </button>
        {variant !== 'minimal' && variant !== 'compact' && !compact ? null : (
          <span className="text-xs text-gray-500">or</span>
        )}
        <button
          onClick={() => openModal('register')}
          className={`${buttonClasses} ${variant === 'minimal' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border-transparent bg-blue-600 text-white hover:bg-blue-700'}`}
          disabled={isPending}
        >
          Register
        </button>
      </>
    );

    if (variant === 'minimal') {
      return (
        <div className={`flex items-center space-x-3 ${className}`}>
          {renderButtons()}
          <Suspense fallback={<div />}>
            <AuthModal
              showModal={showModal}
              modalType={modalType}
              onClose={closeModal}
              onSetMode={setMode}
              onAuthSuccess={handleAuthSuccess}
            />
          </Suspense>
        </div>
      );
    }

    if (compact || variant === 'compact') {
      return (
        <div className={`flex items-center space-x-2 ${className}`}>
          <button
            onClick={() => openModal('login')}
            className={`${buttonClasses} border-blue-600 text-blue-400 hover:border-blue-500 hover:text-blue-300`}
            disabled={isPending}
          >
            Login
          </button>
          <span className="text-xs text-gray-500">or</span>
          <button
            onClick={() => openModal('register')}
            className={`${buttonClasses} border-transparent bg-blue-600 text-white hover:bg-blue-700`}
            disabled={isPending}
          >
            Register
          </button>

          <Suspense fallback={<div />}>
            <AuthModal
              showModal={showModal}
              modalType={modalType}
              onClose={closeModal}
              onSetMode={setMode}
              onAuthSuccess={handleAuthSuccess}
            />
          </Suspense>
        </div>
      );
    }

    // Default full-size variant
    return (
      <div className={className}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => openModal('login')}
            className={`${buttonClasses} border-blue-600 text-blue-400 hover:border-blue-500 hover:text-blue-300`}
            disabled={isPending}
          >
            Login
          </button>
          <button
            onClick={() => openModal('register')}
            className={`${buttonClasses} border-transparent bg-blue-600 text-white hover:bg-blue-700`}
            disabled={isPending}
          >
            Register
          </button>
        </div>

        <Suspense fallback={<div />}>
          <AuthModal
            showModal={showModal}
            modalType={modalType}
            onClose={closeModal}
            onSetMode={setMode}
            onAuthSuccess={handleAuthSuccess}
          />
        </Suspense>
      </div>
    );
  }
);

UnifiedLoginWidget.displayName = 'UnifiedLoginWidget';

// Legacy component exports for backward compatibility
export const LoginWidget = UnifiedLoginWidget;
export const UserLoginWidget = (props: UnifiedLoginWidgetProps) => (
  <UnifiedLoginWidget {...props} variant="compact" />
);

export default UnifiedLoginWidget;

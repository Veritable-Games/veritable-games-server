'use client';

import { useState } from 'react';
import { ChevronDown, Shield, Code, Users, Crown } from 'lucide-react';
import type { User } from '@/lib/users/types';
import { fetchWithCSRF } from '@/lib/utils/csrf';

type UserRole = User['role'];

interface RoleSelectorProps {
  userId: number;
  currentRole: UserRole;
  onRoleChange?: (userId: number, newRole: UserRole) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; color: string; bgColor: string; icon: typeof Shield }
> = {
  user: {
    label: 'User',
    color: 'text-gray-400',
    bgColor: 'bg-gray-700',
    icon: Users,
  },
  moderator: {
    label: 'Moderator',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    icon: Shield,
  },
  developer: {
    label: 'Developer',
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/30',
    icon: Code,
  },
  admin: {
    label: 'Admin',
    color: 'text-red-400',
    bgColor: 'bg-red-900/30',
    icon: Crown,
  },
};

const ROLE_ORDER: UserRole[] = ['user', 'moderator', 'developer', 'admin'];

export default function RoleSelector({
  userId,
  currentRole,
  onRoleChange,
  disabled = false,
  compact = false,
}: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConfig = ROLE_CONFIG[currentRole] || ROLE_CONFIG.user;
  const Icon = currentConfig.icon;

  const handleRoleSelect = async (newRole: UserRole) => {
    if (newRole === currentRole || disabled || isUpdating) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetchWithCSRF(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      onRoleChange?.(userId, newRole);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          }}
          disabled={disabled || isUpdating}
          className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-all ${currentConfig.bgColor} ${currentConfig.color} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:brightness-110'}`}
          title={`Role: ${currentConfig.label}${disabled ? '' : ' (click to change)'}`}
        >
          <Icon className="h-3 w-3" />
          <span>{currentConfig.label}</span>
          {!disabled && (
            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {isOpen && !disabled && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={e => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            {/* Dropdown */}
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl">
              {ROLE_ORDER.map(role => {
                const config = ROLE_CONFIG[role];
                const RoleIcon = config.icon;
                const isSelected = role === currentRole;

                return (
                  <button
                    key={role}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRoleSelect(role);
                    }}
                    disabled={isUpdating}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? `${config.bgColor} ${config.color}`
                        : 'text-gray-300 hover:bg-gray-700'
                    } ${isUpdating ? 'opacity-50' : ''}`}
                  >
                    <RoleIcon className={`h-4 w-4 ${config.color}`} />
                    <span>{config.label}</span>
                    {isSelected && <span className="ml-auto text-xs text-gray-500">current</span>}
                  </button>
                );
              })}
              {error && (
                <div className="border-t border-gray-700 px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Full-size variant
  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-400">Role</label>
      <button
        onClick={e => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled || isUpdating}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm transition-colors ${
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-gray-500'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${currentConfig.color}`} />
          <span className={currentConfig.color}>{currentConfig.label}</span>
        </div>
        {!disabled && (
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl">
            {ROLE_ORDER.map(role => {
              const config = ROLE_CONFIG[role];
              const RoleIcon = config.icon;
              const isSelected = role === currentRole;

              return (
                <button
                  key={role}
                  onClick={e => {
                    e.stopPropagation();
                    handleRoleSelect(role);
                  }}
                  disabled={isUpdating}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? `${config.bgColor} ${config.color}`
                      : 'text-gray-300 hover:bg-gray-700'
                  } ${isUpdating ? 'opacity-50' : ''}`}
                >
                  <RoleIcon className={`h-4 w-4 ${config.color}`} />
                  <div className="flex-1">
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-gray-500">
                      {role === 'user' && 'Basic community member'}
                      {role === 'moderator' && 'Forum/wiki moderation powers'}
                      {role === 'developer' && 'Workspace access + moderation'}
                      {role === 'admin' && 'Full system access'}
                    </div>
                  </div>
                  {isSelected && <span className="text-xs text-gray-500">current</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

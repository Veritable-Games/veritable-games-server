'use client';

import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import RoleSelector from '@/components/users/RoleSelector';
import BadgeGrantManager from './BadgeGrantManager';
import type { User } from '@/lib/users/types';

interface ProfileAdminPanelProps {
  userId: number;
  currentRole: User['role'];
  onRoleChange?: (userId: number, newRole: User['role']) => void;
  onBadgeChange?: () => void;
}

export default function ProfileAdminPanel({
  userId,
  currentRole,
  onRoleChange,
  onBadgeChange,
}: ProfileAdminPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-900/10">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-amber-900/20"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-400">Admin Controls</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-amber-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="border-t border-amber-600/30 px-4 py-4">
          <div className="space-y-6">
            {/* Role Selector Section */}
            <div>
              <RoleSelector userId={userId} currentRole={currentRole} onRoleChange={onRoleChange} />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700" />

            {/* Badge Grant Manager */}
            <BadgeGrantManager userId={userId} onBadgeChange={onBadgeChange} />
          </div>
        </div>
      )}
    </div>
  );
}

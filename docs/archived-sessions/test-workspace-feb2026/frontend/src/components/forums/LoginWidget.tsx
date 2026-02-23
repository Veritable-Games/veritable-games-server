'use client';

// This file is now a legacy wrapper for backward compatibility
import { UnifiedLoginWidget } from '@/components/auth/UnifiedLoginWidget';

interface LoginWidgetProps {
  compact?: boolean;
}

export function LoginWidget({ compact = false }: LoginWidgetProps) {
  return <UnifiedLoginWidget compact={compact} />;
}

export default LoginWidget;

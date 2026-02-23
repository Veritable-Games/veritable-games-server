/**
 * Button.tsx - Simple button component
 */

import React from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

// Simple button styling function
export function getButtonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  className = ''
) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500',
    outline:
      'bg-transparent border border-gray-600 hover:border-gray-500 hover:bg-gray-800/40 text-gray-300 hover:text-white focus:ring-gray-500',
    ghost: 'bg-transparent hover:bg-gray-800/60 text-gray-300 hover:text-white focus:ring-gray-500',
    link: 'bg-transparent text-blue-400 hover:text-blue-300 hover:underline focus:ring-blue-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  };

  // Enhanced size classes with minimum touch target sizes (44px)
  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-2 text-sm min-h-[44px] min-w-[44px]',
    md: 'px-4 py-2 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[48px]',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`.trim();
}

interface BaseButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps
  extends BaseButtonProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: never;
}

export interface LinkButtonProps
  extends BaseButtonProps, Omit<React.ComponentProps<typeof Link>, 'href'> {
  href: string;
}

const Button = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps | LinkButtonProps
>(({ variant, size, fullWidth, className, children, ...props }, ref) => {
  const classes = getButtonClasses(variant, size, fullWidth, className);

  // Link button
  if ('href' in props && props.href) {
    const { href, ...linkProps } = props as LinkButtonProps;
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        {...linkProps}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  // Regular button
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      {...(props as ButtonProps)}
      className={classes}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

// Semantic button variants
export const PrimaryButton: React.FC<Omit<ButtonProps | LinkButtonProps, 'variant'>> = (
  props: any
) => <Button variant="primary" {...props} />;

export const SecondaryButton: React.FC<Omit<ButtonProps | LinkButtonProps, 'variant'>> = (
  props: any
) => <Button variant="secondary" {...props} />;

export const DangerButton: React.FC<Omit<ButtonProps | LinkButtonProps, 'variant'>> = (
  props: any
) => <Button variant="danger" {...props} />;

export const LinkButton: React.FC<Omit<LinkButtonProps, 'variant'>> = (props: any) => (
  <Button variant="link" {...props} />
);

export const IconButton: React.FC<Omit<ButtonProps, 'variant'>> = (props: any) => (
  <Button variant="ghost" {...props} />
);

export const BackButton: React.FC<Omit<ButtonProps | LinkButtonProps, 'variant'>> = (
  props: any
) => <Button variant="secondary" {...props} />;

export const CancelButton: React.FC<Omit<ButtonProps | LinkButtonProps, 'variant'>> = (
  props: any
) => <Button variant="secondary" {...props} />;

export const CreateButton: React.FC<Omit<ButtonProps | LinkButtonProps, 'variant'>> = (
  props: any
) => <Button variant="primary" {...props} />;

export const SaveButton: React.FC<Omit<ButtonProps, 'variant'>> = (props: any) => (
  <Button variant="primary" {...props} />
);

export const SubmitButton: React.FC<Omit<ButtonProps, 'variant' | 'type'>> = (props: any) => (
  <Button variant="primary" type="submit" {...props} />
);

export const DraftButton: React.FC<Omit<ButtonProps, 'variant'>> = (props: any) => (
  <Button variant="secondary" {...props} />
);

export { Button };
export default Button;

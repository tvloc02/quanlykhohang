import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg';
};

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...rest
}: ButtonProps) {
  const variantMap: Record<string, string> = {
    primary: 'bg-cyan-600 text-white hover:bg-cyan-700',
    ghost: 'bg-transparent text-cyan-700 hover:bg-cyan-50',
    white: 'bg-white text-cyan-600 hover:bg-gray-100',
  };

  const sizeMap: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const classes = `inline-flex items-center justify-center rounded-xl font-medium transition ${variantMap[variant]} ${sizeMap[size]} ${className}`;

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}

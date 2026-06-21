import React from 'react';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md';
};

export default function IconButton({ children, className = '', size = 'sm', ...rest }: IconButtonProps) {
  const sizeMap: Record<string, string> = {
    sm: 'p-1',
    md: 'p-2',
  };

  const classes = `inline-flex items-center justify-center rounded-xl transition ${sizeMap[size]} ${className}`;

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}

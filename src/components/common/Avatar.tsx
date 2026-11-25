import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className = '' }) => {
  const [hasError, setHasError] = useState(false);

  const getInitials = (str: string) => {
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-base',
  };

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 border border-tan-200 ${className}`}
      />
    );
  }

  // Crisp fallback initials
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-olive-50 border border-tan-200 flex items-center justify-center font-semibold text-olive-900 shrink-0 select-none ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};

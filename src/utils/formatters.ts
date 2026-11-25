import React from 'react';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPriceRange = (min: number, max: number): string => {
  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
};

export const getRelativeDaysLabel = (dateStr: string): { label: string; isOverdue: boolean; isToday: boolean; isTomorrow: boolean } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return {
      label: `${abs} day${abs > 1 ? 's' : ''} overdue`,
      isOverdue: true,
      isToday: false,
      isTomorrow: false,
    };
  }
  if (diffDays === 0) {
    return { label: 'Due today', isOverdue: false, isToday: true, isTomorrow: false };
  }
  if (diffDays === 1) {
    return { label: 'Tomorrow', isOverdue: false, isToday: false, isTomorrow: true };
  }
  if (diffDays <= 7) {
    return { label: `In ${diffDays} days`, isOverdue: false, isToday: false, isTomorrow: false };
  }
  return { label: dateStr, isOverdue: false, isToday: false, isTomorrow: false };
};

export const formatTimeAgo = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 5) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatDate = (dateStrOrIso: string): string => {
  if (!dateStrOrIso) return 'Never';
  const date = new Date(dateStrOrIso);
  if (isNaN(date.getTime())) return dateStrOrIso;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const isoToDateInput = (dateStrOrIso: string): string => {
  if (!dateStrOrIso) return new Date().toISOString().split('T')[0];
  const date = new Date(dateStrOrIso);
  if (isNaN(date.getTime())) return dateStrOrIso.split('T')[0];
  return date.toISOString().split('T')[0];
};

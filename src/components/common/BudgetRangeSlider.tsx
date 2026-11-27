import React, { useRef, useState, useCallback, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';

interface BudgetRangeSliderProps {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  minLimit?: number;
  maxLimit?: number;
  step?: number;
  className?: string;
  showPresets?: boolean;
}

export const BUDGET_PRESETS = [
  { label: '500-650', min: 500000, max: 650000 },
  { label: '650-800', min: 650000, max: 800000 },
  { label: '800-950', min: 800000, max: 950000 },
  { label: '950-1150', min: 950000, max: 1150000 },
  { label: '400-600', min: 400000, max: 600000 },
  { label: '1.2M-2.0M', min: 1200000, max: 2000000 },
];

const MAX_SUPPORTED_PRICE = 100000000;

function formatWithCommas(val: number): string {
  return Math.max(0, Math.round(val)).toLocaleString('en-US');
}

function findCursorPosAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) {
        return i + 1;
      }
    }
  }
  return formatted.length;
}

export const BudgetRangeSlider: React.FC<BudgetRangeSliderProps> = ({
  min,
  max,
  onChange,
  minLimit = 0,
  maxLimit = 6000000,
  step = 25000,
  className = '',
  showPresets = true,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);
  const [focusedField, setFocusedField] = useState<'min' | 'max' | null>(null);
  const [minDraft, setMinDraft] = useState<string>(() => formatWithCommas(min));
  const [maxDraft, setMaxDraft] = useState<string>(() => formatWithCommas(max));

  useEffect(() => {
    if (focusedField !== 'min') {
      setMinDraft(formatWithCommas(min));
    }
  }, [min, focusedField]);

  useEffect(() => {
    if (focusedField !== 'max') {
      setMaxDraft(formatWithCommas(max));
    }
  }, [max, focusedField]);

  // Compute percentages for track styling
  const minPercent = Math.max(0, Math.min(100, ((min - minLimit) / (maxLimit - minLimit)) * 100));
  const maxPercent = Math.max(0, Math.min(100, ((max - minLimit) / (maxLimit - minLimit)) * 100));

  const getValueFromPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = clickX / rect.width;
      const rawValue = minLimit + percentage * (maxLimit - minLimit);
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(minLimit, Math.min(maxLimit, steppedValue));
    },
    [minLimit, maxLimit, step, min]
  );

  const handlePointerDown = (thumb: 'min' | 'max') => (e: React.PointerEvent) => {
    e.stopPropagation();
    setActiveThumb(thumb);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeThumb) return;
    const newVal = getValueFromPosition(e.clientX);

    if (activeThumb === 'min') {
      const clampedMin = Math.min(newVal, Math.min(maxLimit, max) - step);
      onChange(Math.max(minLimit, clampedMin), max);
    } else {
      const clampedMax = Math.max(newVal, Math.max(minLimit, min) + step);
      onChange(min, Math.min(maxLimit, clampedMax));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeThumb) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveThumb(null);
    }
  };

  // Clicking directly on the linear track
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const clickVal = getValueFromPosition(e.clientX);
    const distToMin = Math.abs(clickVal - min);
    const distToMax = Math.abs(clickVal - max);

    if (distToMin < distToMax) {
      const clampedMin = Math.min(clickVal, Math.min(maxLimit, max) - step);
      onChange(Math.max(minLimit, clampedMin), max);
    } else {
      const clampedMax = Math.max(clickVal, Math.max(minLimit, min) + step);
      onChange(min, Math.min(maxLimit, clampedMax));
    }
  };

  const handleLiveNumericInput = (
    field: 'min' | 'max',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value;
    const selectionStart = e.target.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, selectionStart).replace(/\D/g, '').length;
    const digitsOnly = raw.replace(/\D/g, '');

    if (!digitsOnly) {
      if (field === 'min') {
        setMinDraft('');
        onChange(0, max);
      } else {
        setMaxDraft('');
      }
      return;
    }

    const numericVal = Math.min(MAX_SUPPORTED_PRICE, Number(digitsOnly));
    const formatted = formatWithCommas(numericVal);

    if (field === 'min') {
      setMinDraft(formatted);
      onChange(numericVal, max);
      requestAnimationFrame(() => {
        if (minInputRef.current && document.activeElement === minInputRef.current) {
          const nextPos = findCursorPosAfterDigits(formatted, digitsBeforeCursor);
          minInputRef.current.setSelectionRange(nextPos, nextPos);
        }
      });
    } else {
      setMaxDraft(formatted);
      onChange(min, numericVal);
      requestAnimationFrame(() => {
        if (maxInputRef.current && document.activeElement === maxInputRef.current) {
          const nextPos = findCursorPosAfterDigits(formatted, digitsBeforeCursor);
          maxInputRef.current.setSelectionRange(nextPos, nextPos);
        }
      });
    }
  };

  const handleMinBlur = () => {
    setFocusedField(null);
    const digits = minDraft.replace(/\D/g, '');
    const resolvedMin = digits ? Math.min(MAX_SUPPORTED_PRICE, Number(digits)) : 0;
    const resolvedMax = resolvedMin > max ? resolvedMin : max;
    onChange(resolvedMin, resolvedMax);
    setMinDraft(formatWithCommas(resolvedMin));
  };

  const handleMaxBlur = () => {
    setFocusedField(null);
    const digits = maxDraft.replace(/\D/g, '');
    const resolvedMax = digits ? Math.min(MAX_SUPPORTED_PRICE, Number(digits)) : max;
    const resolvedMin = resolvedMax < min ? resolvedMax : min;
    onChange(resolvedMin, resolvedMax);
    setMaxDraft(formatWithCommas(resolvedMax));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Presets - Clean & Simple */}
      {showPresets && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-1.5">
            <span className="text-xs sm:text-[11px] font-bold text-olive-900 uppercase tracking-wider mr-0.5">
              Presets:
            </span>
            {BUDGET_PRESETS.map((preset) => {
              const isSelected = min === preset.min && max === preset.max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChange(preset.min, preset.max)}
                  className={`min-h-[40px] sm:min-h-0 px-3.5 py-2 sm:px-3 sm:py-1.5 rounded-lg text-sm sm:text-xs font-semibold transition-all border cursor-pointer select-none tabular-nums ${
                    isSelected
                      ? 'bg-olive-700 text-cream border-olive-800 shadow-2xs'
                      : 'bg-cream hover:bg-tan-100 text-olive-900 border-tan-300 hover:border-tan-400'
                  }`}
                >
                  ${preset.label}
                </button>
              );
            })}
          </div>
          <span className="text-sm sm:text-xs text-olive-900 font-bold tabular-nums">
            {formatCurrency(min)} – {formatCurrency(max)}
          </span>
        </div>
      )}

      {/* Simple Linear Track */}
      <div className="space-y-1.5 pt-0.5">
        <div className="relative py-3.5 sm:py-2.5 select-none touch-none">
          {/* Clickable Track Field */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="relative h-2.5 sm:h-2 bg-tan-200 rounded-full cursor-pointer"
          >
            {/* Active Highlighted Range Line */}
            <div
              className="absolute top-0 bottom-0 bg-olive-700 rounded-full"
              style={{
                left: `${Math.min(minPercent, maxPercent)}%`,
                width: `${Math.abs(maxPercent - minPercent)}%`,
              }}
            />

            {/* Minimum Budget Handle */}
            <div
              onPointerDown={handlePointerDown('min')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              tabIndex={0}
              role="slider"
              aria-label="Minimum budget"
              aria-valuenow={min}
              aria-valuemin={minLimit}
              aria-valuemax={max}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 sm:w-4.5 sm:h-4.5 rounded-full bg-olive-700 border-2 border-cream shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 focus:outline-none focus:ring-2 focus:ring-olive-600/40 ${
                activeThumb === 'min' ? 'scale-110 ring-2 ring-olive-600/40' : ''
              }`}
              style={{ left: `${minPercent}%` }}
            />

            {/* Maximum Budget Handle */}
            <div
              onPointerDown={handlePointerDown('max')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              tabIndex={0}
              role="slider"
              aria-label="Maximum budget"
              aria-valuenow={max}
              aria-valuemin={min}
              aria-valuemax={maxLimit}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 sm:w-4.5 sm:h-4.5 rounded-full bg-olive-700 border-2 border-cream shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 focus:outline-none focus:ring-2 focus:ring-olive-600/40 ${
                activeThumb === 'max' ? 'scale-110 ring-2 ring-olive-600/40' : ''
              }`}
              style={{ left: `${maxPercent}%` }}
            />
          </div>

          {/* Simple Linear Track Labels */}
          <div className="flex justify-between text-xs sm:text-[10px] text-tan-500 tabular-nums mt-2.5 sm:mt-2">
            <span>$0</span>
            <span>$1M</span>
            <span>$2M</span>
            <span>$3M</span>
            <span>$4M</span>
            <span>$5M</span>
            <span>$6M</span>
          </div>
        </div>
      </div>

      {/* Manual Min / Max Price Inputs with live comma formatting */}
      <div className="pt-2 border-t border-tan-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-medium text-tan-600 mb-1">
            Min Price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 text-sm sm:text-xs font-medium pointer-events-none">
              $
            </span>
            <input
              ref={minInputRef}
              type="text"
              inputMode="numeric"
              aria-label="Manual minimum price"
              value={minDraft}
              onFocus={() => setFocusedField('min')}
              onChange={(e) => handleLiveNumericInput('min', e)}
              onBlur={handleMinBlur}
              placeholder="0"
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-xl sm:rounded-lg pl-7 pr-3 py-2 sm:py-1.5 text-base sm:text-xs font-medium tabular-nums text-olive-900 focus:outline-none focus:border-olive-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-tan-600 mb-1">
            Max Price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 text-sm sm:text-xs font-medium pointer-events-none">
              $
            </span>
            <input
              ref={maxInputRef}
              type="text"
              inputMode="numeric"
              aria-label="Manual maximum price"
              value={maxDraft}
              onFocus={() => setFocusedField('max')}
              onChange={(e) => handleLiveNumericInput('max', e)}
              onBlur={handleMaxBlur}
              placeholder="6,000,000"
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-xl sm:rounded-lg pl-7 pr-3 py-2 sm:py-1.5 text-base sm:text-xs font-medium tabular-nums text-olive-900 focus:outline-none focus:border-olive-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

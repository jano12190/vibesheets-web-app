import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, children, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-semibold text-white/95">
            {label}
            {props.required && <span className="text-accent ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={clsx(
            'glass-input w-full px-4 py-3 text-sm',
            error && 'border-red-400 focus:border-red-400',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {hint && !error && (
          <p className="text-xs text-white/60 italic">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-red-300">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
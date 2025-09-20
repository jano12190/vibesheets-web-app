import { TextareaHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-semibold text-white/95">
            {label}
            {props.required && <span className="text-accent ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={clsx(
            'glass-input w-full px-4 py-3 text-sm resize-vertical min-h-[80px]',
            error && 'border-red-400 focus:border-red-400',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
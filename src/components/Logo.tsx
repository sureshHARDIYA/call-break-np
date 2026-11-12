import React, { useId } from 'react';
import { cn } from '../lib/utils.ts';

const SPADE_PATH =
  'M12 2C12 2 4 9 4 14a4 4 0 0 0 7 2.6C10.8 19 10 21 8.5 22h7c-1.5-1-2.3-3-2.5-5.4A4 4 0 0 0 20 14c0-5-8-12-8-12Z';

/** The mark: a spade with its tip snapped off along a diagonal "break". Keep in sync with public/favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const tipClip = `${id}-tip`;
  const baseClip = `${id}-base`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <defs>
        <clipPath id={tipClip}>
          <path d="M0 0h32v9.4L0 15.4z" />
        </clipPath>
        <clipPath id={baseClip}>
          <path d="M0 17.2 32 11.2V32H0z" />
        </clipPath>
      </defs>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <g fill="#fff">
        <g clipPath={`url(#${tipClip})`}>
          <path d={SPADE_PATH} transform="translate(5.3 3)" />
        </g>
        <g clipPath={`url(#${baseClip})`}>
          <path d={SPADE_PATH} transform="translate(4 4.6)" />
        </g>
      </g>
    </svg>
  );
}

const SIZE_STYLES = {
  sm: { mark: 'h-6 w-6 sm:h-7 sm:w-7', text: 'text-lg sm:text-xl' },
  md: { mark: 'h-8 w-8', text: 'text-2xl' },
} as const;

/** Mark plus "Call Break" wordmark. */
export function Logo({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZE_STYLES;
  className?: string;
}) {
  const styles = SIZE_STYLES[size];
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap shrink-0', className)}>
      <LogoMark className={styles.mark} />
      <span className={cn('font-display font-bold tracking-tight text-brand-ink', styles.text)}>
        Call Break
      </span>
    </span>
  );
}

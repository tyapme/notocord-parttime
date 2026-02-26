import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-[var(--ds-component-input-min-height)] w-full min-w-0 rounded-[var(--ds-component-input-corner-radius)] border px-3 py-2 text-base transition-[color,box-shadow,border-color,background-color] duration-[var(--ds-duration-base)] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'border-[var(--outline-variant)] bg-[var(--surface-container-highest)] focus-visible:border-[var(--primary)] focus-visible:ring-ring/35 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

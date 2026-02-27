import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "tap-target inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--ds-duration-fast)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/45 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'rounded-[var(--ds-component-button-corner-radius)] bg-primary text-primary-foreground border border-transparent shadow-[0_1px_2px_rgba(14,18,27,0.16)] hover:bg-primary/92',
        destructive:
          'rounded-[var(--ds-component-button-corner-radius)] bg-destructive text-white border border-transparent hover:bg-destructive/92 focus-visible:ring-destructive/24 dark:focus-visible:ring-destructive/40',
        outline:
          'rounded-[var(--ds-component-button-corner-radius)] border border-[var(--outline)] bg-transparent text-primary shadow-none hover:bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]',
        secondary:
          'rounded-[var(--ds-component-button-corner-radius)] bg-[var(--primary-container)] text-[var(--on-secondary-container)] border border-transparent shadow-none hover:bg-[color-mix(in_oklab,var(--primary-container)_92%,white_8%)]',
        ghost:
          'rounded-[var(--ds-component-button-corner-radius)] border border-transparent bg-transparent text-primary shadow-none hover:bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]',
        link: 'rounded-[var(--ds-component-button-corner-radius)] border border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[var(--ds-component-button-min-height)] px-4 has-[>svg]:px-3',
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5 text-xs',
        lg: 'h-12 px-6 has-[>svg]:px-4 text-base',
        icon: 'size-[var(--ds-component-button-min-height)]',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

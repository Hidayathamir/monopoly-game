import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses: Record<string, string> = {
  primary: 'bg-blue-primary text-white',
  success: 'bg-green-success text-white',
  secondary: 'bg-orange text-white',
  danger: 'bg-red-danger text-white',
  start: 'bg-gold text-bg-main',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2.5 py-1 text-base',
  md: 'px-3.5 py-1.5 text-base',
  lg: 'px-5 py-2.5 text-xl',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'rounded-lg border-none font-semibold w-full my-[3px] transition-transform duration-150',
        variantClasses[variant],
        sizeClasses[size],
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-px hover:opacity-90',
        className,
      ].join(' ')}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useSound } from '../audio/SoundContext'
import { SoundId, type SoundId as SoundIdType } from '../audio/soundEngine'

// eslint-disable-next-line react-refresh/only-export-components
export const ButtonVariant = {
  Primary: 'primary',
  Success: 'success',
  Secondary: 'secondary',
  Danger: 'danger',
  Start: 'start',
} as const
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant]

// eslint-disable-next-line react-refresh/only-export-components
export const ButtonSize = { Sm: 'sm', Md: 'md', Lg: 'lg' } as const
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  sound?: SoundIdType | null
  children?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  [ButtonVariant.Primary]: 'bg-blue-primary text-white',
  [ButtonVariant.Success]: 'bg-green-success text-white',
  [ButtonVariant.Secondary]: 'bg-orange text-white',
  [ButtonVariant.Danger]: 'bg-red-danger text-white',
  [ButtonVariant.Start]: 'bg-gold text-bg-main',
}

const sizeClasses: Record<ButtonSize, string> = {
  [ButtonSize.Sm]: 'px-2.5 py-1 text-base',
  [ButtonSize.Md]: 'px-3.5 py-1.5 text-base',
  [ButtonSize.Lg]: 'px-5 py-2.5 text-xl',
}

export default function Button({
  variant = ButtonVariant.Primary,
  size = ButtonSize.Md,
  className = '',
  disabled,
  children,
  sound,
  onClick,
  ...props
}: ButtonProps) {
  const play = useSound()
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (sound !== null) play(sound ?? SoundId.Click)
    onClick?.(e)
  }
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
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

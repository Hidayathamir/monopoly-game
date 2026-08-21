import { AvatarKind, type PlayerAvatar } from '../types/game'
import { PRESET_EMOJI } from '../data/avatars'

interface Props {
  avatar: PlayerAvatar
  className?: string
  title?: string
}

export default function Avatar({ avatar, className, title }: Props) {
  if (avatar.kind === AvatarKind.Custom) {
    return <img className={className} src={avatar.dataUrl} alt={title ?? 'avatar'} title={title} />
  }
  return (
    <span className={className} title={title} aria-label={title}>
      {PRESET_EMOJI[avatar.id] ?? '❓'}
    </span>
  )
}

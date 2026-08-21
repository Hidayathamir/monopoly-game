import { AvatarKind, type PlayerAvatar } from '../types/game';

export const PRESET_AVATARS = {
  Cat: 'cat',
  Dog: 'dog',
  Robot: 'robot',
  Alien: 'alien',
  Ghost: 'ghost',
  Penguin: 'penguin',
  Fox: 'fox',
  Dino: 'dino',
  Crab: 'crab',
  Octopus: 'octopus',
} as const;
export type PresetAvatarId = (typeof PRESET_AVATARS)[keyof typeof PRESET_AVATARS];

export const PRESET_EMOJI: Record<PresetAvatarId, string> = {
  [PRESET_AVATARS.Cat]: '🐱',
  [PRESET_AVATARS.Dog]: '🐶',
  [PRESET_AVATARS.Robot]: '🤖',
  [PRESET_AVATARS.Alien]: '👽',
  [PRESET_AVATARS.Ghost]: '👻',
  [PRESET_AVATARS.Penguin]: '🐧',
  [PRESET_AVATARS.Fox]: '🦊',
  [PRESET_AVATARS.Dino]: '🦖',
  [PRESET_AVATARS.Crab]: '🦀',
  [PRESET_AVATARS.Octopus]: '🐙',
};

export const DEFAULT_AVATAR: PlayerAvatar = { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat };

export const CUSTOM_AVATAR_MAX_DATA_URL_LENGTH = 100_000;
export const CUSTOM_AVATAR_MAX_DIMENSION = 96;

export function isPresetAvatar(value: unknown): value is { kind: typeof AvatarKind.Preset; id: PresetAvatarId } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.kind === AvatarKind.Preset && typeof v.id === 'string' && Object.hasOwn(PRESET_EMOJI, v.id);
}

export function isCustomAvatar(value: unknown): value is { kind: typeof AvatarKind.Custom; dataUrl: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== AvatarKind.Custom) return false;
  if (typeof v.dataUrl !== 'string') return false;
  if (v.dataUrl.length > CUSTOM_AVATAR_MAX_DATA_URL_LENGTH) return false;
  return v.dataUrl.startsWith('data:image/');
}

export function isValidAvatar(value: unknown): value is PlayerAvatar {
  return isPresetAvatar(value) || isCustomAvatar(value);
}

export function avatarEmoji(avatar: PlayerAvatar): string | null {
  if (avatar.kind !== AvatarKind.Preset) return null;
  return Object.hasOwn(PRESET_EMOJI, avatar.id) ? (PRESET_EMOJI[avatar.id] ?? null) : null;
}

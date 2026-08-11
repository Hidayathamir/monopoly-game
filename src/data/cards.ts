import { CardType, CardActionType, type Card } from '../types/game';

export const CHANCE_CARDS: Card[] = [
  { id: 1, description: 'Majulah ke MULAI. Kumpulkan Rp200K.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 0 } },
  { id: 2, description: 'Majulah ke Jakarta.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 37 } },
  { id: 3, description: 'Majulah ke Bali.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 39 } },
  { id: 4, description: 'Majulah ke Stasiun Gambir.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } },
  { id: 5, description: 'Bank membayar dividen. Dapatkan Rp50K.', type: CardType.Chance, effect: { action: CardActionType.Collect, amount: 50000 } },
  { id: 6, description: 'Pergilah ke Masuk Penjara. Langsung menuju Penjara tanpa melewati MULAI.', type: CardType.Chance, effect: { action: CardActionType.GoToJail } },
  { id: 7, description: 'Anda bebas dari Penjara. Simpan kartu ini sampai diperlukan.', type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } },
  { id: 8, description: 'Bayar perbaikan jalan: Rp25K per rumah, Rp100K per hotel.', type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25000, perHotel: 100000 } },
  { id: 9, description: 'Anda berulang tahun! Dapatkan Rp10K dari setiap pemain.', type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10000 } },
  { id: 10, description: 'Mundurlah 3 langkah.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } },
];

export const COMMUNITY_CARDS: Card[] = [
  { id: 101, description: 'Kesalahan bank! Dapatkan Rp200K.', type: CardType.Community, effect: { action: CardActionType.Collect, amount: 200000 } },
  { id: 102, description: 'Biaya rumah sakit: Bayar Rp100K.', type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100000 } },
  { id: 103, description: 'Biaya sekolah: Bayar Rp50K.', type: CardType.Community, effect: { action: CardActionType.Pay, amount: 50000 } },
  { id: 104, description: 'Anda bebas dari Penjara. Simpan kartu ini sampai diperlukan.', type: CardType.Community, effect: { action: CardActionType.GetOutOfJailFree } },
  { id: 105, description: 'Pergilah ke Masuk Penjara. Langsung menuju Penjara tanpa melewati MULAI.', type: CardType.Community, effect: { action: CardActionType.GoToJail } },
  { id: 106, description: 'Dapatkan warisan sebesar Rp100K.', type: CardType.Community, effect: { action: CardActionType.Collect, amount: 100000 } },
  { id: 107, description: 'Asuransi jiwa jatuh tempo: Dapatkan Rp100K.', type: CardType.Community, effect: { action: CardActionType.Collect, amount: 100000 } },
  { id: 108, description: 'Kontes kecantikan: Dapatkan hadiah Rp50K.', type: CardType.Community, effect: { action: CardActionType.Collect, amount: 50000 } },
  { id: 109, description: 'Bayar premi asuransi Rp50K.', type: CardType.Community, effect: { action: CardActionType.Pay, amount: 50000 } },
  { id: 110, description: 'Bayar denda parkir Rp25K.', type: CardType.Community, effect: { action: CardActionType.Pay, amount: 25000 } },
];

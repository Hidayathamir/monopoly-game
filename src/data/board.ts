import { SpaceType, type Space } from '../types/game';

export function createInitialBoard(): Space[] {
  return [
    { id: 0, name: 'MULAI', type: SpaceType.Go, owner: null, houses: 0, mortgaged: false },
    { id: 1, name: 'Cirebon', type: SpaceType.Property, price: 60000, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000], houseCost: 50000, color: '#8B4513', owner: null, houses: 0, mortgaged: false },
    { id: 2, name: 'Dana Umum', type: SpaceType.Community, owner: null, houses: 0, mortgaged: false },
    { id: 3, name: 'Tegal', type: SpaceType.Property, price: 60000, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000], houseCost: 50000, color: '#8B4513', owner: null, houses: 0, mortgaged: false },
    { id: 4, name: 'Pajak Penghasilan', type: SpaceType.Tax, price: 200000, owner: null, houses: 0, mortgaged: false },
    { id: 5, name: 'Stasiun Gambir', type: SpaceType.Railroad, price: 200000, rent: [25000, 50000, 100000, 200000], owner: null, houses: 0, mortgaged: false },
    { id: 6, name: 'Pekalongan', type: SpaceType.Property, price: 100000, rent: [6000, 30000, 90000, 270000, 400000, 550000, 700000, 600000], houseCost: 50000, color: '#87CEEB', owner: null, houses: 0, mortgaged: false },
    { id: 7, name: 'Kesempatan', type: SpaceType.Chance, owner: null, houses: 0, mortgaged: false },
    { id: 8, name: 'Semarang', type: SpaceType.Property, price: 100000, rent: [6000, 30000, 90000, 270000, 400000, 550000, 700000, 600000], houseCost: 50000, color: '#87CEEB', owner: null, houses: 0, mortgaged: false },
    { id: 9, name: 'Surakarta', type: SpaceType.Property, price: 120000, rent: [8000, 40000, 100000, 300000, 450000, 600000, 750000, 600000], houseCost: 50000, color: '#87CEEB', owner: null, houses: 0, mortgaged: false },
    { id: 10, name: 'Penjara', type: SpaceType.Jail, owner: null, houses: 0, mortgaged: false },
    { id: 11, name: 'Malang', type: SpaceType.Property, price: 140000, rent: [10000, 50000, 150000, 450000, 625000, 750000, 875000, 900000], houseCost: 100000, color: '#FF69B4', owner: null, houses: 0, mortgaged: false },
    { id: 12, name: 'PLN (Listrik)', type: SpaceType.Utility, price: 150000, rent: [0], owner: null, houses: 0, mortgaged: false },
    { id: 13, name: 'Surabaya', type: SpaceType.Property, price: 140000, rent: [10000, 50000, 150000, 450000, 625000, 750000, 875000, 900000], houseCost: 100000, color: '#FF69B4', owner: null, houses: 0, mortgaged: false },
    { id: 14, name: 'Denpasar', type: SpaceType.Property, price: 160000, rent: [12000, 60000, 180000, 500000, 700000, 900000, 1000000, 900000], houseCost: 100000, color: '#FF69B4', owner: null, houses: 0, mortgaged: false },
    { id: 15, name: 'Stasiun Pasar Senen', type: SpaceType.Railroad, price: 200000, rent: [25000, 50000, 100000, 200000], owner: null, houses: 0, mortgaged: false },
    { id: 16, name: 'Yogyakarta', type: SpaceType.Property, price: 180000, rent: [14000, 70000, 200000, 550000, 750000, 950000, 1100000, 1000000], houseCost: 100000, color: '#FFA500', owner: null, houses: 0, mortgaged: false },
    { id: 17, name: 'Dana Umum', type: SpaceType.Community, owner: null, houses: 0, mortgaged: false },
    { id: 18, name: 'Bandung', type: SpaceType.Property, price: 180000, rent: [14000, 70000, 200000, 550000, 750000, 950000, 1100000, 1000000], houseCost: 100000, color: '#FFA500', owner: null, houses: 0, mortgaged: false },
    { id: 19, name: 'Medan', type: SpaceType.Property, price: 200000, rent: [16000, 80000, 220000, 600000, 800000, 1000000, 1200000, 1000000], houseCost: 100000, color: '#FFA500', owner: null, houses: 0, mortgaged: false },
    { id: 20, name: 'Parkir Gratis', type: SpaceType.FreeParking, owner: null, houses: 0, mortgaged: false },
    { id: 21, name: 'Palembang', type: SpaceType.Property, price: 220000, rent: [18000, 90000, 250000, 700000, 875000, 1050000, 1250000, 1100000], houseCost: 150000, color: '#FF0000', owner: null, houses: 0, mortgaged: false },
    { id: 22, name: 'Kesempatan', type: SpaceType.Chance, owner: null, houses: 0, mortgaged: false },
    { id: 23, name: 'Makassar', type: SpaceType.Property, price: 220000, rent: [18000, 90000, 250000, 700000, 875000, 1050000, 1250000, 1100000], houseCost: 150000, color: '#FF0000', owner: null, houses: 0, mortgaged: false },
    { id: 24, name: 'Balikpapan', type: SpaceType.Property, price: 240000, rent: [20000, 100000, 300000, 750000, 925000, 1100000, 1300000, 1100000], houseCost: 150000, color: '#FF0000', owner: null, houses: 0, mortgaged: false },
    { id: 25, name: 'Stasiun Tanjung Priok', type: SpaceType.Railroad, price: 200000, rent: [25000, 50000, 100000, 200000], owner: null, houses: 0, mortgaged: false },
    { id: 26, name: 'Manado', type: SpaceType.Property, price: 260000, rent: [22000, 110000, 330000, 800000, 975000, 1150000, 1350000, 1200000], houseCost: 150000, color: '#FFFF00', owner: null, houses: 0, mortgaged: false },
    { id: 27, name: 'Pontianak', type: SpaceType.Property, price: 260000, rent: [22000, 110000, 330000, 800000, 975000, 1150000, 1350000, 1200000], houseCost: 150000, color: '#FFFF00', owner: null, houses: 0, mortgaged: false },
    { id: 28, name: 'PDAM (Air)', type: SpaceType.Utility, price: 150000, rent: [0], owner: null, houses: 0, mortgaged: false },
    { id: 29, name: 'Banjarmasin', type: SpaceType.Property, price: 280000, rent: [24000, 120000, 360000, 850000, 1025000, 1200000, 1400000, 1200000], houseCost: 150000, color: '#FFFF00', owner: null, houses: 0, mortgaged: false },
    { id: 30, name: 'Masuk Penjara', type: SpaceType.GoToJail, owner: null, houses: 0, mortgaged: false },
    { id: 31, name: 'Batam', type: SpaceType.Property, price: 300000, rent: [26000, 130000, 390000, 900000, 1100000, 1275000, 1450000, 1300000], houseCost: 200000, color: '#008000', owner: null, houses: 0, mortgaged: false },
    { id: 32, name: 'Padang', type: SpaceType.Property, price: 300000, rent: [26000, 130000, 390000, 900000, 1100000, 1275000, 1450000, 1300000], houseCost: 200000, color: '#008000', owner: null, houses: 0, mortgaged: false },
    { id: 33, name: 'Dana Umum', type: SpaceType.Community, owner: null, houses: 0, mortgaged: false },
    { id: 34, name: 'Bogor', type: SpaceType.Property, price: 320000, rent: [28000, 150000, 450000, 1000000, 1200000, 1400000, 1600000, 1300000], houseCost: 200000, color: '#008000', owner: null, houses: 0, mortgaged: false },
    { id: 35, name: 'Stasiun Soekarno-Hatta', type: SpaceType.Railroad, price: 200000, rent: [25000, 50000, 100000, 200000], owner: null, houses: 0, mortgaged: false },
    { id: 36, name: 'Kesempatan', type: SpaceType.Chance, owner: null, houses: 0, mortgaged: false },
    { id: 37, name: 'Jakarta', type: SpaceType.Property, price: 350000, rent: [35000, 175000, 500000, 1100000, 1300000, 1500000, 1700000, 2000000], houseCost: 200000, color: '#00008B', owner: null, houses: 0, mortgaged: false },
    { id: 38, name: 'Pajak Mewah', type: SpaceType.Tax, price: 100000, owner: null, houses: 0, mortgaged: false },
    { id: 39, name: 'Bali', type: SpaceType.Property, price: 400000, rent: [50000, 200000, 600000, 1400000, 1700000, 2000000, 2200000, 2000000], houseCost: 200000, color: '#00008B', owner: null, houses: 0, mortgaged: false },
  ];
}

export const GO_SALARY = 200000;
export const JAIL_FINE = 50000;
export const JAIL_SPACE = 10;
export const STARTING_MONEY = 1500000;
export const MAX_JAIL_TURNS = 3;

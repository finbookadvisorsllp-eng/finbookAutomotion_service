import { formatINR } from '../../../data/mockData';

export const fmt = (v) => formatINR(Number(v || 0));

// Tally-style balance: magnitude + Dr/Cr suffix (debit balance = Dr, OD = Cr).
export const bal = (v) => {
  const n = Number(v || 0);
  if (!n) return `${formatINR(0)}`;
  return `${formatINR(Math.abs(n))} ${n < 0 ? 'Cr' : 'Dr'}`;
};

// Show a money cell or a dash when zero (keeps registers clean like Tally).
export const moneyOrDash = (v) => (Number(v) ? formatINR(Number(v)) : '-');

/**
 * Helper to convert numbers to Vietnamese words for accounting and warehouse vouchers.
 * E.g. 30000000 -> "Ba mươi triệu đồng chẵn./."
 */

const UNITS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(n: number, showZeroHundred = false): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;

  const parts: string[] = [];

  if (hundreds > 0 || showZeroHundred) {
    parts.push(UNITS[hundreds] + ' trăm');
  }

  if (tens === 0 && ones > 0) {
    if (hundreds > 0 || showZeroHundred) parts.push('lẻ');
    parts.push(UNITS[ones]);
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 1) parts.push('một');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(UNITS[ones]);
  } else if (tens > 1) {
    parts.push(UNITS[tens] + ' mươi');
    if (ones === 1) parts.push('mốt');
    else if (ones === 4) parts.push('tư');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(UNITS[ones]);
  }

  return parts.join(' ');
}

export function numberToWordsVietnamese(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  const num = Math.round(Number(amount));
  if (isNaN(num)) return '';
  if (num === 0) return 'Không đồng chẵn./.';

  const isNegative = num < 0;
  let absNum = Math.abs(num);

  const groups: number[] = [];
  while (absNum > 0) {
    groups.push(absNum % 1000);
    absNum = Math.floor(absNum / 1000);
  }

  const resultWords: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const val = groups[i];
    if (val === 0) continue;
    const isFirstGroup = i === groups.length - 1;
    const groupText = readThreeDigits(val, !isFirstGroup);
    if (groupText) {
      resultWords.push(groupText);
      const scale = SCALES[i] || '';
      if (scale) resultWords.push(scale);
    }
  }

  let finalStr = resultWords.join(' ').replace(/\s+/g, ' ').trim();
  if (!finalStr) return 'Không đồng chẵn./.';

  // Capitalize first letter
  finalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1);

  return (isNegative ? 'Âm ' : '') + `${finalStr} đồng chẵn./.`;
}

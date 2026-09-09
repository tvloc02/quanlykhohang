/**
 * Tiện ích xử lý ngày tháng theo múi giờ Việt Nam (GMT+7: Asia/Ho_Chi_Minh),
 * đảm bảo hiển thị và lưu trữ chính xác, tránh lệch múi giờ (lệch 7 tiếng)
 * và tránh lỗi đảo ngày/tháng.
 */

/**
 * Trích xuất các thành phần ngày giờ theo chuẩn múi giờ Việt Nam (GMT+7).
 */
export function getVietnamDateParts(d: Date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function getLocalDateString(d: Date = new Date()): string {
  const parts = getVietnamDateParts(d);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getInitialReportDates(daysBack = 14): { firstDay: string; today: string } {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - daysBack);
  return {
    firstDay: getLocalDateString(past),
    today: getLocalDateString(now),
  };
}

export function getInitialMonthDates(): { firstDay: string; today: string } {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    firstDay: getLocalDateString(firstDayOfMonth),
    today: getLocalDateString(now),
  };
}

export function parseAnyDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;

  // 1. ISO strings with timezone (ends with Z or +/-offset)
  if (str.includes('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. DD/MM/YYYY [HH:mm[:ss]]
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    const hours = dmyMatch[4] !== undefined ? String(dmyMatch[4]).padStart(2, '0') : '00';
    const minutes = dmyMatch[5] !== undefined ? String(dmyMatch[5]).padStart(2, '0') : '00';
    const seconds = dmyMatch[6] !== undefined ? String(dmyMatch[6]).padStart(2, '0') : '00';
    const d = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`);
    if (!isNaN(d.getTime())) return d;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));
  }

  // 3. YYYY-MM-DD [T| ] [HH:mm[:ss]] (without Z or offset -> local time GMT+7)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(ymdMatch[2]).padStart(2, '0');
    const day = String(ymdMatch[3]).padStart(2, '0');
    const hours = ymdMatch[4] !== undefined ? String(ymdMatch[4]).padStart(2, '0') : '00';
    const minutes = ymdMatch[5] !== undefined ? String(ymdMatch[5]).padStart(2, '0') : '00';
    const seconds = ymdMatch[6] !== undefined ? String(ymdMatch[6]).padStart(2, '0') : '00';
    const d = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`);
    if (!isNaN(d.getTime())) return d;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseAnyDateToLocalString(val: any): string {
  if (!val) return '';
  const d = parseAnyDate(val);
  if (d && !isNaN(d.getTime())) {
    return getLocalDateString(d);
  }
  return '';
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseAnyDate(dateStr);
  if (!d) return dateStr;
  const parts = getVietnamDateParts(d);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatFullDateTimeDisplay(val: any): string {
  if (!val) return '-';
  const d = parseAnyDate(val);
  if (!d) return String(val);
  const parts = getVietnamDateParts(d);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function toDatetimeLocalValue(val: any): string {
  const d = parseAnyDate(val) || new Date();
  const parts = getVietnamDateParts(d);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

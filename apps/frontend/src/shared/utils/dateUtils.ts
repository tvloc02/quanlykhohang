/**
 * Tiện ích xử lý ngày tháng theo giờ địa phương (local timezone - GMT+7),
 * tránh lỗi lệch ngày do toISOString() gây ra trong múi giờ Việt Nam.
 */

export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export function parseAnyDateToLocalString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.slice(0, 10);
    }
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return getLocalDateString(d);
  }
  return '';
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = parseAnyDateToLocalString(dateStr);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

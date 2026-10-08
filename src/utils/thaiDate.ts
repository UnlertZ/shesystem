/**
 * Thai Date & Time Helper Utilities
 * Timezone: Asia/Bangkok (UTC+7)
 */

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/**
 * Returns current Date in Thai Time (UTC+7)
 */
export function getNowThai(): Date {
  return new Date();
}

/**
 * Format date string into Thai readable format: e.g. "08 ต.ค. 2569" or "8 ตุลาคม 2569"
 */
export function formatThaiDate(dateStr?: string | Date | null, includeTime = false, shortMonth = false): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';

  const day = d.getDate();
  const month = shortMonth ? THAI_MONTHS_SHORT[d.getMonth()] : THAI_MONTHS[d.getMonth()];
  const yearBE = d.getFullYear() + 543;

  if (includeTime) {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${yearBE} ${hours}:${mins} น.`;
  }

  return `${day} ${month} ${yearBE}`;
}

/**
 * Calculate equipment age: (Latest Inspection Date - In Service Date)
 * If no latest inspection date, calculates up to current date.
 */
export function calculateEquipmentAge(inServiceDateStr?: string, latestInspectionDateStr?: string): {
  years: number;
  months: number;
  days: number;
  formatted: string;
} {
  if (!inServiceDateStr) {
    return { years: 0, months: 0, days: 0, formatted: 'ไม่ระบุวันเริ่มใช้งาน' };
  }

  const startDate = new Date(inServiceDateStr);
  if (isNaN(startDate.getTime())) {
    return { years: 0, months: 0, days: 0, formatted: 'ไม่ระบุ' };
  }

  const endDate = latestInspectionDateStr ? new Date(latestInspectionDateStr) : new Date();
  if (isNaN(endDate.getTime()) || endDate < startDate) {
    return { years: 0, months: 0, days: 0, formatted: '0 วัน' };
  }

  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    months -= 1;
    // Days in previous month
    const prevMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonthDate.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) {
    return { years: 0, months: 0, days: 0, formatted: '0 วัน' };
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ปี`);
  if (months > 0) parts.push(`${months} เดือน`);
  if (days > 0 && years === 0) parts.push(`${days} วัน`);

  return {
    years,
    months,
    days,
    formatted: parts.length > 0 ? parts.join(' ') : 'ใช้งานไม่ถึง 1 เดือน'
  };
}

/**
 * Calculate lowest vacant number for sequence (EX-001, EX-002, etc.)
 * When items are deleted, the next addition fills the smallest missing number.
 */
export function findLowestVacantNumber(existingSequences: number[]): number {
  if (!existingSequences || existingSequences.length === 0) {
    return 1;
  }
  const set = new Set(existingSequences);
  let candidate = 1;
  while (set.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Format code with 3-digit padding (e.g. EX-001, FHC-005)
 */
export function formatEquipmentCode(type: string, seq: number): string {
  return `${type}-${String(seq).padStart(3, '0')}`;
}

/**
 * Check if a date record is older than 3 years from Jan 1 of current year
 */
export function isOlderThan3Years(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const currentYear = new Date().getFullYear();
  const cutoffDate = new Date(currentYear - 3, 0, 1); // Jan 1st, 3 years ago
  return d < cutoffDate;
}

import { Equipment, InspectionRecord, EquipmentPhotoArchiveItem } from '../types';
import { THAI_MONTHS } from './thaiDate';

export interface ArchivedPhotoDetail {
  id: string;
  url: string;
  date: string;
  yearBE: number;
  monthIdx: number;
  monthName: string;
  inspector?: string;
  isAbnormal?: boolean;
  description?: string;
  isCurrent?: boolean;
  label: string;
}

export interface MonthPhotoGroup {
  monthIdx: number;
  monthName: string;
  photos: ArchivedPhotoDetail[];
}

export interface YearPhotoGroup {
  yearBE: number;
  months: MonthPhotoGroup[];
  totalPhotos: number;
}

/**
 * Compiles and groups all historical photos for an equipment by Year (พ.ศ.) and Month
 * Sources:
 * 1. Current equipment photo (equipment.inspection_sheet_photo)
 * 2. Equipment photo_history archive (past tank photos archived when replaced)
 * 3. Inspection records for this equipment (inspection_photo)
 */
export function getEquipmentPhotoArchives(
  equipment: Equipment,
  inspections: InspectionRecord[] = []
): YearPhotoGroup[] {
  const photoMap = new Map<string, ArchivedPhotoDetail>();

  // 1. Current primary equipment photo
  if (equipment.inspection_sheet_photo) {
    const curDate = equipment.latest_inspection_date || equipment.updated_at || equipment.created_at || new Date().toISOString();
    const d = new Date(curDate);
    const validD = isNaN(d.getTime()) ? new Date() : d;
    const yearBE = validD.getFullYear() + 543;
    const monthIdx = validD.getMonth();

    photoMap.set(`current_${equipment.inspection_sheet_photo}`, {
      id: `cur_${equipment.id}`,
      url: equipment.inspection_sheet_photo,
      date: curDate,
      yearBE,
      monthIdx,
      monthName: THAI_MONTHS[monthIdx],
      inspector: equipment.latest_inspector || equipment.responsible_person,
      isCurrent: true,
      label: 'รูปถังปัจจุบัน (อัปเดตล่าสุด)'
    });
  }

  // 2. Archived previous tank photos from equipment.photo_history
  if (equipment.photo_history && Array.isArray(equipment.photo_history)) {
    equipment.photo_history.forEach(item => {
      if (!item.photo_url) return;
      const key = `arch_${item.photo_url}_${item.year_be}_${item.month_idx}`;
      if (!photoMap.has(key)) {
        photoMap.set(key, {
          id: item.id || `arch_${Date.now()}_${Math.random()}`,
          url: item.photo_url,
          date: item.date,
          yearBE: item.year_be,
          monthIdx: item.month_idx,
          monthName: item.month_name || THAI_MONTHS[item.month_idx],
          inspector: item.inspector_name,
          isAbnormal: item.is_abnormal,
          description: item.note,
          isCurrent: false,
          label: item.note || `รูปถังประจำเดือน ${item.month_name || THAI_MONTHS[item.month_idx]} ${item.year_be}`
        });
      }
    });
  }

  // 3. Historical inspection photos from inspections list
  const equipInspections = inspections.filter(
    r => r.equipment_id === equipment.id || (r.equipment_code && r.equipment_code === equipment.code)
  );

  equipInspections.forEach(insp => {
    if (!insp.inspection_photo) return;
    const d = new Date(insp.inspection_date);
    const validD = isNaN(d.getTime()) ? new Date() : d;
    const yearBE = validD.getFullYear() + 543;
    const monthIdx = validD.getMonth();

    const key = `insp_${insp.inspection_photo}_${yearBE}_${monthIdx}`;
    // If not already in map as current photo or archive
    if (!photoMap.has(key)) {
      photoMap.set(key, {
        id: insp.id,
        url: insp.inspection_photo,
        date: insp.inspection_date,
        yearBE,
        monthIdx,
        monthName: THAI_MONTHS[monthIdx],
        inspector: insp.inspector_name,
        isAbnormal: insp.is_abnormal,
        description: insp.abnormal_description,
        isCurrent: insp.inspection_photo === equipment.inspection_sheet_photo,
        label: insp.is_abnormal ? 'รูปตรวจเช็ค (พบข้อบกพร่อง)' : 'รูปตรวจเช็คประจำเดือน'
      });
    }
  });

  // Group by Year and Month
  const allPhotos = Array.from(photoMap.values());
  const yearMap = new Map<number, Map<number, ArchivedPhotoDetail[]>>();

  allPhotos.forEach(p => {
    if (!yearMap.has(p.yearBE)) {
      yearMap.set(p.yearBE, new Map());
    }
    const monthMap = yearMap.get(p.yearBE)!;
    if (!monthMap.has(p.monthIdx)) {
      monthMap.set(p.monthIdx, []);
    }
    monthMap.get(p.monthIdx)!.push(p);
  });

  // Format into YearPhotoGroup sorted descending
  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

  return sortedYears.map(yearBE => {
    const monthMap = yearMap.get(yearBE)!;
    const sortedMonthIdxs = Array.from(monthMap.keys()).sort((a, b) => b - a);

    let yearTotal = 0;
    const months: MonthPhotoGroup[] = sortedMonthIdxs.map(monthIdx => {
      const photos = monthMap.get(monthIdx)!.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      yearTotal += photos.length;
      return {
        monthIdx,
        monthName: THAI_MONTHS[monthIdx],
        photos
      };
    });

    return {
      yearBE,
      months,
      totalPhotos: yearTotal
    };
  });
}

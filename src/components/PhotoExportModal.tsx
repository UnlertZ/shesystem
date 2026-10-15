import React, { useState, useMemo } from 'react';
import { Equipment, InspectionRecord, EquipmentType } from '../types';
import { formatThaiDate, getNowThai, THAI_MONTHS } from '../utils/thaiDate';
import { resolveImageProxyUrl, fetchImageAsBlob, createFallbackImageBlob, getCandidateUrls } from '../utils/imageFetcher';
import JSZip from 'jszip';
import {
  X,
  Download,
  Images,
  CheckSquare,
  Square,
  Filter,
  Calendar,
  Flame,
  ShieldCheck,
  Droplets,
  Layers,
  Search,
  AlertTriangle,
  CheckCircle2,
  Camera,
  MapPin,
  Eye,
  RefreshCw,
  FileText,
  Check,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react';

interface PhotoExportModalProps {
  equipmentList: Equipment[];
  inspections: InspectionRecord[];
  initialMonth?: number; // 0-11
  initialYear?: number;  // e.g. 2569
  initialType?: string;  // 'ALL' | 'EX' | 'FHC' | 'FH' | 'HD'
  onClose: () => void;
}

export interface PreparedExportPhoto {
  type: 'sheet' | 'location' | 'defect';
  label: string;
  url: string;
  date?: string;
}

export interface PreparedExportItem extends Equipment {
  availablePhotos: PreparedExportPhoto[];
  primaryThumb: string;
  hasInspectionInPeriod: boolean;
  periodInspection?: InspectionRecord;
}

export const PhotoExportModal: React.FC<PhotoExportModalProps> = ({
  equipmentList,
  inspections,
  initialMonth,
  initialYear,
  initialType,
  onClose
}) => {
  const now = getNowThai();
  const currentYearBE = now.getFullYear() + 543;
  const availableYears = [currentYearBE, currentYearBE - 1, currentYearBE - 2];

  // 1. Period filters (เลือกเดือน และ ปี) - ค่าเริ่มต้นเป็น 'ALL' (ทุกเดือน) เพื่อให้เห็นรูปทั้งหมดทันที
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || currentYearBE);
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');

  // 2. Equipment type filter (เลือกประเภทของอุปกรณ์)
  const [selectedType, setSelectedType] = useState<string>(initialType || 'ALL');

  // 3. Photo categories selection (เลือกประเภทรูปภาพที่ต้องการ)
  const [includeSheet, setIncludeSheet] = useState<boolean>(true);
  const [includeLocation, setIncludeLocation] = useState<boolean>(true);
  const [includeDefect, setIncludeDefect] = useState<boolean>(true);

  // 4. Status filter & Search
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WITH_PHOTOS' | 'DEFECT_ONLY' | 'INSPECTED_ONLY'>('WITH_PHOTOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 5. Individual selection checkboxes (เลือกได้ว่าจะเอาอะไรบ้าง)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 6. Modal preview for a single photo
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // 7. Loading / Progress state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; stage: string } | null>(null);

  // Candidate fallback error handler for <img> elements
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, originalUrl: string) => {
    const img = e.currentTarget;
    const tried = parseInt(img.getAttribute('data-tried') || '0', 10);
    const candidates = getCandidateUrls(originalUrl);
    if (tried < candidates.length) {
      img.setAttribute('data-tried', String(tried + 1));
      img.src = candidates[tried];
    } else {
      img.style.display = 'none';
    }
  };

  // Check if a date string belongs to target year & month
  const isDateInSelectedPeriod = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const yBE = d.getFullYear() + 543;
    if (yBE !== selectedYear) return false;
    if (selectedMonth !== 'ALL' && d.getMonth() !== selectedMonth) return false;
    return true;
  };

  // Compile items with their photos in the selected period (comprehensive gathering)
  const preparedItems: PreparedExportItem[] = useMemo(() => {
    return equipmentList.map(item => {
      // Find matching inspection records for this equipment
      const itemInspections = inspections.filter(r =>
        (r.equipment_id && r.equipment_id === item.id) ||
        (r.equipment_code && r.equipment_code.trim().toLowerCase() === item.code.trim().toLowerCase())
      );

      // Filter inspections matching the selected period
      const periodInspections = itemInspections.filter(r => isDateInSelectedPeriod(r.inspection_date));
      const hasInspectionInPeriod = periodInspections.length > 0 || isDateInSelectedPeriod(item.latest_inspection_date);
      const periodInspection = periodInspections[0];

      // Track photo URLs already added to avoid duplicates
      const seenUrls = new Set<string>();
      const availablePhotos: PreparedExportPhoto[] = [];

      const addPhoto = (type: 'sheet' | 'location' | 'defect', label: string, rawUrl?: string | null, date?: string) => {
        if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) return;
        const resolved = resolveImageProxyUrl(rawUrl.trim());
        if (!resolved || seenUrls.has(resolved)) return;
        seenUrls.add(resolved);
        availablePhotos.push({
          type,
          label,
          url: resolved,
          date
        });
      };

      // 1. Add inspection photos from period inspections
      periodInspections.forEach(insp => {
        const d = new Date(insp.inspection_date);
        const validD = isNaN(d.getTime()) ? new Date() : d;
        const mName = THAI_MONTHS[validD.getMonth()];
        const yBE = validD.getFullYear() + 543;

        if (insp.inspection_photo) {
          if (insp.is_abnormal) {
            if (includeDefect) {
              addPhoto('defect', `รูปข้อบกพร่อง (${mName} ${yBE})`, insp.inspection_photo, insp.inspection_date);
            }
            if (includeSheet) {
              addPhoto('sheet', `รูปตรวจเช็ค (${mName} ${yBE})`, insp.inspection_photo, insp.inspection_date);
            }
          } else if (includeSheet) {
            addPhoto('sheet', `รูปตรวจเช็คประจำเดือน ${mName} ${yBE}`, insp.inspection_photo, insp.inspection_date);
          }
        }

        if (insp.location_photo && includeLocation) {
          addPhoto('location', `รูปสถานที่ (${mName} ${yBE})`, insp.location_photo, insp.inspection_date);
        }
      });

      // 2. Add historical tank photos from item.photo_history
      if (includeSheet && item.photo_history && Array.isArray(item.photo_history)) {
        item.photo_history.forEach(h => {
          if (!h.photo_url) return;
          const matchesPeriod = h.year_be === selectedYear && (selectedMonth === 'ALL' || h.month_idx === selectedMonth);
          if (matchesPeriod) {
            const mName = h.month_name || THAI_MONTHS[h.month_idx] || '';
            const lbl = h.note || `รูปถังประจำเดือน ${mName} ${h.year_be}`;
            addPhoto('sheet', lbl, h.photo_url, h.date);
          }
        });
      }

      // 3. Add primary tank photo (equipment.inspection_sheet_photo)
      if (includeSheet && item.inspection_sheet_photo) {
        // Include if no inspection photo was found in period, or if viewing ALL months
        const hasSheetAlready = availablePhotos.some(p => p.type === 'sheet');
        if (!hasSheetAlready || selectedMonth === 'ALL' || isDateInSelectedPeriod(item.latest_inspection_date)) {
          addPhoto('sheet', 'รูปถังปัจจุบัน (อัปเดตล่าสุด)', item.inspection_sheet_photo, item.latest_inspection_date || item.updated_at);
        }
      }

      // 4. Add location photo (equipment.location_photo)
      if (includeLocation && item.location_photo) {
        addPhoto('location', 'รูปสถานที่ติดตั้ง', item.location_photo);
      }

      // 5. Add defect photo (equipment.defect_photo)
      if (includeDefect && item.defect_photo) {
        addPhoto('defect', 'รูปข้อบกพร่อง / ปัญหา', item.defect_photo);
      }

      // Primary thumbnail URL for card preview
      const primaryThumb = availablePhotos[0]?.url || resolveImageProxyUrl(item.inspection_sheet_photo) || resolveImageProxyUrl(item.location_photo) || '';

      return {
        ...item,
        availablePhotos,
        primaryThumb,
        hasInspectionInPeriod,
        periodInspection
      };
    });
  }, [equipmentList, inspections, selectedYear, selectedMonth, includeSheet, includeLocation, includeDefect]);

  // Filter items according to UI controls
  const filteredItems = useMemo(() => {
    return preparedItems.filter(item => {
      // Type filter
      if (selectedType !== 'ALL' && item.type !== selectedType) return false;

      // Status filter
      if (filterStatus === 'WITH_PHOTOS' && item.availablePhotos.length === 0) return false;
      if (filterStatus === 'DEFECT_ONLY' && item.defect_status !== 'DEFECT' && item.ready_status === 'READY') return false;
      if (filterStatus === 'INSPECTED_ONLY' && item.inspection_status !== 'INSPECTED') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = item.code.toLowerCase().includes(q);
        const locMatch = item.location.toLowerCase().includes(q);
        if (!codeMatch && !locMatch) return false;
      }

      return true;
    });
  }, [preparedItems, selectedType, filterStatus, searchQuery]);

  // Initialize selected IDs whenever filteredItems change
  React.useEffect(() => {
    const idsWithPhotos = filteredItems.filter(item => item.availablePhotos.length > 0).map(item => item.id);
    setSelectedIds(new Set(idsWithPhotos));
  }, [filteredItems]);

  // Selection handlers
  const handleToggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    const allIds = filteredItems.map(item => item.id);
    setSelectedIds(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSelectOnlyWithPhotos = () => {
    const idsWithPhotos = filteredItems.filter(item => item.availablePhotos.length > 0).map(item => item.id);
    setSelectedIds(new Set(idsWithPhotos));
  };

  const handleSelectOnlyDefects = () => {
    const defectIds = filteredItems.filter(item => item.defect_status === 'DEFECT' || item.availablePhotos.some(p => p.type === 'defect')).map(item => item.id);
    setSelectedIds(new Set(defectIds));
  };

  // Selected items calculation
  const selectedItems = useMemo(() => {
    return filteredItems.filter(item => selectedIds.has(item.id));
  }, [filteredItems, selectedIds]);

  const totalSelectedPhotos = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.availablePhotos.length, 0);
  }, [selectedItems]);

  // Download ZIP organized strictly by equipment code (รหัสอุปกรณ์)
  const handleDownloadZip = async () => {
    if (totalSelectedPhotos === 0) {
      alert('กรุณาเลือกอุปกรณ์ที่มีรูปภาพอย่างน้อย 1 รายการ');
      return;
    }

    setIsExporting(true);
    setExportProgress({ current: 0, total: totalSelectedPhotos, stage: 'กำลังเตรียมรายการรูปภาพ...' });

    try {
      const zip = new JSZip();
      const periodLabel = selectedMonth === 'ALL'
        ? `ทั้งปี_${selectedYear}`
        : `${THAI_MONTHS[selectedMonth]}_${selectedYear}`;

      const rootFolderName = `SHE_Photos_${periodLabel}_${selectedType === 'ALL' ? 'ทุกประเภท' : selectedType}`;

      // Group export items STRICTLY by equipment code (รหัสอุปกรณ์)
      const exportList: {
        equipCode: string;
        folderName: string;
        filename: string;
        url: string;
        photoLabel: string;
      }[] = [];

      selectedItems.forEach(item => {
        // Folder name is the equipment code (e.g. "EX-001", "EX-002", "FHC-001")
        const equipFolderName = item.code.trim().replace(/[\\/:*?"<>|]/g, '_');

        // Track counts to give unique filenames when multiple photos exist
        let photoIndex = 1;

        item.availablePhotos.forEach(photo => {
          let suffix = 'รูปตรวจเช็ค';
          if (photo.type === 'location') suffix = 'สถานที่ติดตั้ง';
          if (photo.type === 'defect') suffix = 'จุดที่พบปัญหา';

          let filename = `${item.code}_${suffix}`;

          // Append date/month if available to distinguish multiple photos
          if (photo.date) {
            try {
              const d = new Date(photo.date);
              if (!isNaN(d.getTime())) {
                const mName = THAI_MONTHS[d.getMonth()];
                const yBE = d.getFullYear() + 543;
                filename = `${item.code}_${suffix}_${mName}_${yBE}`;
              }
            } catch (_) {}
          } else {
            filename = `${item.code}_${suffix}_${photoIndex}`;
          }

          // Sanitize filename for Windows OS filesystem safety
          const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
          let finalFilename = safeName;
          let counter = 2;
          while (exportList.some(e => e.folderName === equipFolderName && e.filename === finalFilename)) {
            finalFilename = `${safeName}_${counter}`;
            counter++;
          }

          exportList.push({
            equipCode: item.code,
            folderName: equipFolderName,
            filename: finalFilename,
            url: photo.url,
            photoLabel: photo.label
          });
          photoIndex++;
        });
      });

      let completedCount = 0;
      let successCount = 0;
      let fallbackCount = 0;
      const failedList: { code: string; label: string; url: string; error?: string }[] = [];

      for (let i = 0; i < exportList.length; i++) {
        const item = exportList[i];
        setExportProgress({
          current: i + 1,
          total: exportList.length,
          stage: `กำลังดาวน์โหลด (${i + 1}/${exportList.length}): [${item.equipCode}] ${item.photoLabel}`
        });

        // Target folder inside ZIP is organized directly by equipment code at the root of the ZIP
        const targetFolder = zip.folder(item.folderName) || zip;

        try {
          const blob = await fetchImageAsBlob(item.url);
          if (blob && blob.size > 100 && !blob.type.includes('html')) {
            let ext = 'jpg';
            if (blob.type.includes('png')) ext = 'png';
            else if (blob.type.includes('webp')) ext = 'webp';
            else if (blob.type.includes('svg')) ext = 'svg';

            targetFolder.file(`${item.filename}.${ext}`, blob);
            successCount++;
          } else {
            console.warn(`[PhotoExport] Could not load image for [${item.equipCode}]: ${item.url}`);
            // Generate clear fallback card image so the folder is NEVER empty
            const fallbackBlob = createFallbackImageBlob(item.equipCode, item.photoLabel, item.url);
            if (fallbackBlob) {
              targetFolder.file(`${item.filename}.jpg`, fallbackBlob);
              fallbackCount++;
            }
            failedList.push({ code: item.equipCode, label: item.photoLabel, url: item.url, error: 'ไม่พบไฟล์ภาพบนเซิร์ฟเวอร์ (สร้างการ์ดแจ้งเตือนแทน)' });
          }
        } catch (fetchErr: any) {
          console.warn(`[PhotoExport] Error for [${item.equipCode}]:`, fetchErr);
          const fallbackBlob = createFallbackImageBlob(item.equipCode, item.photoLabel, item.url);
          if (fallbackBlob) {
            targetFolder.file(`${item.filename}.jpg`, fallbackBlob);
            fallbackCount++;
          }
          failedList.push({ code: item.equipCode, label: item.photoLabel, url: item.url, error: fetchErr?.message });
        }
        completedCount++;
      }

      // Add a detailed text manifest directly at the root of the ZIP
      zip.file(
        'manifest.txt',
        `============================================================\n` +
        `ระบบจัดการความปลอดภัยและอุปกรณ์ดับเพลิง (SHE Safety Management)\n` +
        `รายงานการส่งออกรูปภาพอุปกรณ์ดับเพลิง (.ZIP) - แยกตามรหัสอุปกรณ์\n` +
        `============================================================\n\n` +
        `รอบข้อมูล: ${periodLabel.replace('_', ' ')}\n` +
        `ประเภทอุปกรณ์ที่เลือก: ${selectedType === 'ALL' ? 'ทุกประเภท' : selectedType}\n` +
        `วันที่ส่งออก: ${formatThaiDate(now, true)}\n` +
        `จำนวนอุปกรณ์ที่ส่งออก: ${selectedItems.length} รายการ\n` +
        `จำนวนรูปภาพทั้งหมดที่ต้องดาวน์โหลด: ${exportList.length} รูป\n` +
        `ดาวน์โหลดรูปจริงสำเร็จ: ${successCount} รูป\n` +
        `รูปที่สร้างการ์ดแจ้งเตือนแทน: ${fallbackCount} รูป\n\n` +
        `โครงสร้างโฟลเดอร์ใน ZIP:\n` +
        `- รูปภาพทั้งหมดถูกจัดเก็บแยกโฟลเดอร์ตามรหัสอุปกรณ์ทันทีที่เปิด ZIP (เช่น ${selectedItems[0]?.code || 'EX-001'}/)\n` +
        `- ภายในแต่ละโฟลเดอร์รหัสอุปกรณ์ ประกอบด้วย รูปตรวจเช็ค, รูปสถานที่ติดตั้ง และรูปข้อบกพร่อง\n\n` +
        `หมวดหมู่รูปภาพที่เลือก:\n` +
        `- รูปตรวจเช็ค/ใบตรวจ: ${includeSheet ? 'ใช่' : 'ไม่ใช่'}\n` +
        `- รูปสถานที่ติดตั้ง: ${includeLocation ? 'ใช่' : 'ไม่ใช่'}\n` +
        `- รูปข้อบกพร่อง/ปัญหา: ${includeDefect ? 'ใช่' : 'ไม่ใช่'}\n\n` +
        `------------------------------------------------------------\n` +
        `รายชื่ออุปกรณ์และรูปภาพที่ส่งออก:\n` +
        selectedItems.map((item, idx) => {
          const photosDesc = item.availablePhotos.map(p => p.label).join(', ') || 'ไม่มีรูปภาพ';
          return `${idx + 1}. [${item.code}] โฟลเดอร์: ${item.code}/ (${item.type} - ${item.location}) -> ${photosDesc}`;
        }).join('\n') +
        (failedList.length > 0 ? (
          `\n\n------------------------------------------------------------\n` +
          `รายการรูปภาพที่ไม่สามารถดาวน์โหลดรูปจริงได้ (${failedList.length} รูป - มีการ์ดแจ้งเตือนในโฟลเดอร์แทน):\n` +
          failedList.map(f => `- [${f.code}] ${f.label} (${f.url})`).join('\n')
        ) : '')
      );

      setExportProgress({
        current: exportList.length,
        total: exportList.length,
        stage: `กำลังบีบอัดและสร้างไฟล์ ZIP... (สำเร็จ ${successCount} รูปจริง${fallbackCount > 0 ? `, ${fallbackCount} การ์ดแจ้งเตือน` : ''})`
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const downloadUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${rootFolderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 10000);

      if (failedList.length === 0) {
        alert(`ส่งออกไฟล์ ZIP สำเร็จเรียบร้อยแล้ว (${successCount} รูป) แยกโฟลเดอร์ตามรหัสอุปกรณ์เรียบร้อย`);
      } else if (successCount > 0) {
        alert(`ส่งออกไฟล์ ZIP สำเร็จแล้ว (${successCount} รูปจริง, ${fallbackCount} การ์ดแจ้งเตือน) มีบางรูปไม่สามารถโหลดต้นฉบับได้ (ดูรายละเอียดใน manifest.txt)`);
      } else {
        alert(`ส่งออกไฟล์ ZIP สำเร็จแล้ว (${fallbackCount} รูป) หมายเหตุ: ไม่พบรูปจริงบนเซิร์ฟเวอร์ ระบบได้สร้างการ์ดแจ้งเตือนแยกใส่ในแต่ละโฟลเดอร์รหัสอุปกรณ์ให้เรียบร้อย`);
      }
    } catch (err: any) {
      console.error('ZIP generation failed:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP: ' + (err?.message || ''));
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-purple-800 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-400/30">
              <Images className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">ส่งออกรูปภาพการตรวจสอบอุปกรณ์ (Export Photos)</h2>
              <p className="text-xs text-purple-200">
                เลือกเดือน ปี ประเภทอุปกรณ์ และรายการรูปภาพ — ระบบจะจัดแบ่งโฟลเดอร์ตามรหัสอุปกรณ์ (.ZIP) ให้อัตโนมัติ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-4">
          {/* Row 1: Period (Month / Year) & Equipment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Year Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>ปี พ.ศ.</span>
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>ปี พ.ศ. {y}</option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>เลือกเดือน</span>
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                <option value="ALL">ทุกเดือน (ตลอดทั้งปี พ.ศ. {selectedYear})</option>
                {THAI_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
            </div>

            {/* Equipment Type Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-purple-600" />
                <span>ประเภทอุปกรณ์</span>
              </label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                <option value="ALL">ทั้งหมด (EX, FHC, FH, HD)</option>
                <option value="EX">ถังดับเพลิง (EX)</option>
                <option value="FHC">ตู้ดับเพลิง (FHC)</option>
                <option value="FH">ตู้สายฉีด (FH)</option>
                <option value="HD">หัวรับน้ำ (HD)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Photo Categories to Include */}
          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-xs font-bold text-slate-600">รูปที่ต้องการส่งออก:</span>

              <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeSheet}
                  onChange={e => setIncludeSheet(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span>รูปตรวจเช็ค / ใบตรวจ</span>
              </label>

              <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeLocation}
                  onChange={e => setIncludeLocation(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>รูปสถานที่ติดตั้ง</span>
              </label>

              <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeDefect}
                  onChange={e => setIncludeDefect(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span>รูปข้อบกพร่อง / ปัญหา</span>
              </label>
            </div>

            {/* Status Quick Filter */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-500 font-medium">แสดง:</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <option value="WITH_PHOTOS">เฉพาะที่มีรูปภาพ</option>
                <option value="ALL">อุปกรณ์ทั้งหมด</option>
                <option value="DEFECT_ONLY">เฉพาะที่พบข้อบกพร่อง</option>
                <option value="INSPECTED_ONLY">เฉพาะที่ตรวจแล้ว</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selection Toolbar & Search */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick Selection Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
              <span>เลือกทั้งหมด ({filteredItems.length})</span>
            </button>

            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>ล้างการเลือก</span>
            </button>

            <button
              onClick={handleSelectOnlyDefects}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>เลือกเฉพาะที่มีปัญหา</span>
            </button>
          </div>

          {/* Search Box & Selection Counter */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัส หรือ สถานที่..."
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs w-44 sm:w-56 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="text-xs bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1 rounded-xl font-bold whitespace-nowrap">
              เลือกแล้ว: <span className="text-purple-600">{selectedItems.length}</span> รหัส ({totalSelectedPhotos} รูป)
            </div>
          </div>
        </div>

        {/* Equipment Items Checklist Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2 bg-white rounded-2xl border border-slate-200">
              <Images className="w-10 h-10 mx-auto text-slate-300" />
              <div className="font-bold text-slate-600 text-sm">ไม่พบรายการอุปกรณ์ตามเงื่อนไขที่เลือก</div>
              <div className="text-xs text-slate-400">
                ลองเลือกเดือนเป็น &quot;ทุกเดือน&quot; หรือเปลี่ยนประเภทอุปกรณ์เป็น &quot;ทั้งหมด&quot;
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                const hasPhotos = item.availablePhotos.length > 0;
                const isDefect = item.defect_status === 'DEFECT' || item.ready_status === 'NOT_READY';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    className={`p-3 rounded-2xl border transition cursor-pointer select-none relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-white border-purple-500 shadow-md ring-2 ring-purple-500/20'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 opacity-90'
                    }`}
                  >
                    {/* Header with Checkbox and Info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by div click
                          className="w-4 h-4 mt-1 rounded text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                        />

                        {/* Thumbnail image */}
                        {item.primaryThumb ? (
                          <div
                            className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative group shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto({ url: item.primaryThumb, title: `${item.code} - ${item.location}` });
                            }}
                            title="คลิกเพื่อดูรูปขนาดใหญ่"
                          >
                            <img
                              src={item.primaryThumb}
                              alt={item.code}
                              className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs text-slate-900">{item.code}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {item.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={item.location}>
                            {item.location}
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isDefect
                          ? 'bg-red-100 text-red-700'
                          : item.defect_status === 'RESOLVED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isDefect ? 'พบปัญหา' : (item.defect_status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ปกติ')}
                      </span>
                    </div>

                    {/* Photos Preview Section */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      {/* Photo badges */}
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        {item.availablePhotos.map((p, idx) => (
                          <button
                            key={`${p.url}_${idx}`}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setPreviewPhoto({ url: p.url, title: `[${item.code}] ${p.label}` });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-0.5 border cursor-pointer transition ${
                              p.type === 'defect'
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : p.type === 'location'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            }`}
                            title={`คลิกเพื่อดูรูป: ${p.label}`}
                          >
                            {p.type === 'defect' ? (
                              <AlertTriangle className="w-2.5 h-2.5" />
                            ) : p.type === 'location' ? (
                              <MapPin className="w-2.5 h-2.5" />
                            ) : (
                              <Camera className="w-2.5 h-2.5" />
                            )}
                            <span className="truncate max-w-[80px]">
                              {p.type === 'defect' ? 'ปัญหา' : p.type === 'location' ? 'สถานที่' : 'ตรวจเช็ค'}
                            </span>
                          </button>
                        ))}

                        {!hasPhotos && (
                          <span className="text-[10px] text-slate-400">ไม่มีรูปภาพ</span>
                        )}
                      </div>

                      {/* Photo count indicator */}
                      <div className="text-[10px] font-bold text-slate-500 whitespace-nowrap ml-2">
                        {item.availablePhotos.length > 0 ? (
                          <span className="text-purple-600 font-extrabold">{item.availablePhotos.length} รูป</span>
                        ) : (
                          <span className="text-slate-400">0 รูป</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center space-x-1">
            <FolderOpen className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              โฟลเดอร์ใน ZIP จะถูกจัดหมวดหมู่แยกตามรหัสอุปกรณ์ เช่น <code className="bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">EX-001/</code>, <code className="bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">EX-002/</code>, <code className="bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">FHC-001/</code>
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isExporting || totalSelectedPhotos === 0}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังสร้าง ZIP...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลด ZIP ({totalSelectedPhotos} รูป)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Overlay during download */}
        {isExporting && exportProgress && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">กำลังเตรียมและดาวน์โหลดรูปภาพ</h3>
                <p className="text-xs text-slate-500 mt-1">{exportProgress.stage}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%`
                  }}
                />
              </div>

              <div className="text-xs font-bold text-purple-700">
                {exportProgress.current} / {exportProgress.total} รูปภาพ
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewPhoto && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setPreviewPhoto(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between text-xs font-bold">
                <span className="truncate pr-2">{previewPhoto.title}</span>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1 hover:bg-slate-700 rounded-full transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 bg-slate-950 flex items-center justify-center max-h-[70vh]">
                <img
                  src={previewPhoto.url}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain rounded-lg"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.alt = 'ไม่สามารถโหลดรูปภาพได้';
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

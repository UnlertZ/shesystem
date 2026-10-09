import React, { useState, useMemo } from 'react';
import { Equipment, InspectionRecord } from '../types';
import { formatThaiDate, getNowThai, calculateEquipmentAge, THAI_MONTHS } from '../utils/thaiDate';
import * as XLSX from 'xlsx';
import {
  X,
  Download,
  FileSpreadsheet,
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
  Columns3,
  FileText,
  ListChecks,
  Check
} from 'lucide-react';

interface ExcelExportModalProps {
  equipmentList: Equipment[];
  inspections: InspectionRecord[];
  initialMonth?: number; // 0-11
  initialYear?: number;  // e.g. 2569
  initialType?: string;  // 'ALL' | 'EX' | 'FHC' | 'FH' | 'HD'
  onClose: () => void;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
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

  // 1. Period filters (เลือกเดือน และ ปี)
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || currentYearBE);
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(
    initialMonth !== undefined ? initialMonth : now.getMonth()
  );

  // 2. Equipment type filter (เลือกประเภทของอุปกรณ์)
  const [selectedType, setSelectedType] = useState<string>(initialType || 'ALL');

  // 3. Worksheet options (เลือกชีทที่ต้องการเอา)
  const [includeSummarySheet, setIncludeSummarySheet] = useState<boolean>(true);
  const [includeEquipmentSheet, setIncludeEquipmentSheet] = useState<boolean>(true);
  const [includeCategorizedSheets, setIncludeCategorizedSheets] = useState<boolean>(true);
  const [includeDefectSheet, setIncludeDefectSheet] = useState<boolean>(true);
  const [includeInspectionSheet, setIncludeInspectionSheet] = useState<boolean>(true);

  // 4. Column options (เลือกข้อมูลที่ต้องการใส่ในตาราง)
  const [includeAge, setIncludeAge] = useState<boolean>(true);
  const [includeInspector, setIncludeInspector] = useState<boolean>(true);
  const [includeDefectNotes, setIncludeDefectNotes] = useState<boolean>(true);

  // 5. Status filter & Search
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'INSPECTED_ONLY' | 'DEFECT_ONLY' | 'RESOLVED_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 6. Selected individual equipment IDs (เลือกได้ว่าจะเอาอะไรบ้าง)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Check if date belongs to target year & month
  const isDateInSelectedPeriod = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const yBE = d.getFullYear() + 543;
    if (yBE !== selectedYear) return false;
    if (selectedMonth !== 'ALL' && d.getMonth() !== selectedMonth) return false;
    return true;
  };

  // Prepare items with period inspection context
  const preparedItems = useMemo(() => {
    return equipmentList.map(item => {
      const itemInspections = inspections.filter(r => r.equipment_id === item.id || r.equipment_code === item.code);
      const periodInspection = itemInspections.find(r => isDateInSelectedPeriod(r.inspection_date)) || itemInspections[0];

      const hasInspectionInPeriod = itemInspections.some(r => isDateInSelectedPeriod(r.inspection_date)) ||
        isDateInSelectedPeriod(item.latest_inspection_date);

      return {
        ...item,
        hasInspectionInPeriod,
        periodInspection
      };
    });
  }, [equipmentList, inspections, selectedYear, selectedMonth]);

  // Filter items according to controls
  const filteredItems = useMemo(() => {
    return preparedItems.filter(item => {
      // Type filter
      if (selectedType !== 'ALL' && item.type !== selectedType) return false;

      // Status filter
      if (filterStatus === 'INSPECTED_ONLY' && item.inspection_status !== 'INSPECTED') return false;
      if (filterStatus === 'DEFECT_ONLY' && item.defect_status !== 'DEFECT' && item.ready_status === 'READY') return false;
      if (filterStatus === 'RESOLVED_ONLY' && item.defect_status !== 'RESOLVED') return false;

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

  // Initialize selected IDs whenever filtered items change
  React.useEffect(() => {
    const allIds = filteredItems.map(item => item.id);
    setSelectedIds(new Set(allIds));
  }, [filteredItems.length, selectedType, selectedMonth, selectedYear]);

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

  const handleSelectDefectsOnly = () => {
    const defectIds = filteredItems
      .filter(item => item.defect_status === 'DEFECT' || item.ready_status === 'NOT_READY')
      .map(item => item.id);
    setSelectedIds(new Set(defectIds));
  };

  const handleSelectInspectedOnly = () => {
    const inspectedIds = filteredItems
      .filter(item => item.inspection_status === 'INSPECTED')
      .map(item => item.id);
    setSelectedIds(new Set(inspectedIds));
  };

  // Selected items array
  const selectedItems = useMemo(() => {
    return filteredItems.filter(item => selectedIds.has(item.id));
  }, [filteredItems, selectedIds]);

  // Helper to auto-fit column widths
  const applyAutoFit = (ws: XLSX.WorkSheet, data: any[]) => {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    ws['!cols'] = keys.map(key => {
      let maxLen = key.length;
      data.forEach(row => {
        const val = row[key];
        const str = val !== null && val !== undefined ? String(val) : '';
        if (str.length > maxLen) maxLen = str.length;
      });
      return { wch: Math.min(50, Math.max(12, maxLen + 3)) };
    });
  };

  // Execute Excel Export
  const handleExportExcel = () => {
    if (selectedItems.length === 0) {
      alert('กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการเพื่อส่งออก');
      return;
    }

    const wb = XLSX.utils.book_new();
    const periodLabel = selectedMonth === 'ALL'
      ? `ทั้งปี พ.ศ. ${selectedYear}`
      : `เดือน ${THAI_MONTHS[selectedMonth]} ${selectedYear}`;

    // 1. Sheet 1: สรุปภาพรวมเชิงสถิติ (Executive Summary)
    if (includeSummarySheet) {
      const totalCount = selectedItems.length;
      const inspectedCount = selectedItems.filter(e => e.inspection_status === 'INSPECTED').length;
      const readyCount = selectedItems.filter(e => e.ready_status === 'READY').length;
      const defectCount = selectedItems.filter(e => e.defect_status === 'DEFECT').length;
      const resolvedCount = selectedItems.filter(e => e.defect_status === 'RESOLVED').length;
      const pendingCount = selectedItems.filter(e => e.inspection_status === 'PENDING').length;
      const rate = totalCount > 0 ? Math.round((inspectedCount / totalCount) * 100) : 0;

      // 4 Categories Breakdown
      const typeSummaryRows = [
        { type: 'EX', name: 'ถังดับเพลิง (EX)', unit: 'ถัง' },
        { type: 'FHC', name: 'ตู้ดับเพลิง (FHC)', unit: 'ตู้' },
        { type: 'FH', name: 'ตู้สายฉีดดับเพลิง (FH)', unit: 'สาย' },
        { type: 'HD', name: 'หัวรับน้ำดับเพลิง (HD)', unit: 'จุด' }
      ].map((cat, idx) => {
        const catList = selectedItems.filter(e => e.type === cat.type);
        const catTotal = catList.length;
        const catInspected = catList.filter(e => e.inspection_status === 'INSPECTED').length;
        const catNormal = catList.filter(e => e.inspection_status === 'INSPECTED' && e.defect_status !== 'DEFECT').length;
        const catDefects = catList.filter(e => e.defect_status === 'DEFECT').length;
        const catResolved = catList.filter(e => e.defect_status === 'RESOLVED').length;
        const catPending = catList.filter(e => e.inspection_status === 'PENDING').length;
        const catRate = catTotal > 0 ? Math.round((catInspected / catTotal) * 100) : 0;

        return {
          'ลำดับ': idx + 1,
          'ประเภทอุปกรณ์': cat.name,
          'หน่วยนับ': cat.unit,
          'จำนวนทั้งหมด': catTotal,
          'ตรวจแล้ว': catInspected,
          'สภาพปกติ': catNormal,
          'พบข้อบกพร่อง': catDefects,
          'แก้ไขแล้ว': catResolved,
          'ยังไม่ตรวจ': catPending,
          'ร้อยละการตรวจ': `${catRate}%`
        };
      });

      // Overview Header block
      const overviewData = [
        { 'หัวข้อ': 'ระบบ', 'รายละเอียด': 'ระบบจัดการความปลอดภัยและอุปกรณ์ดับเพลิง (SHE Safety Management)' },
        { 'หัวข้อ': 'รอบรายงาน', 'รายละเอียด': periodLabel },
        { 'หัวข้อ': 'วันที่ออกรายงาน', 'รายละเอียด': formatThaiDate(now, true) },
        { 'หัวข้อ': 'อุปกรณ์ทั้งหมดที่เลือก', 'รายละเอียด': `${totalCount} รายการ` },
        { 'หัวข้อ': 'ตรวจเสร็จสิ้น', 'รายละเอียด': `${inspectedCount} รายการ (${rate}%)` },
        { 'หัวข้อ': 'สภาพพร้อมใช้งาน', 'รายละเอียด': `${readyCount} รายการ` },
        { 'หัวข้อ': 'พบข้อบกพร่อง', 'รายละเอียด': `${defectCount} รายการ` },
        { 'หัวข้อ': 'แก้ไขแล้ว', 'รายละเอียด': `${resolvedCount} รายการ` },
        { 'หัวข้อ': 'ยังไม่ได้ตรวจ', 'รายละเอียด': `${pendingCount} รายการ` }
      ];

      const wsSummary = XLSX.utils.json_to_sheet(overviewData);
      applyAutoFit(wsSummary, overviewData);

      // Append type summary table starting at row 12
      XLSX.utils.sheet_add_json(wsSummary, typeSummaryRows, { origin: 'A12' });
      XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวม');
    }

    // 2. Sheet 2: รายการอุปกรณ์ทั้งหมดที่เลือก (Equipment Master List)
    if (includeEquipmentSheet) {
      const masterRows = selectedItems.map((e, idx) => {
        const age = calculateEquipmentAge(e.in_service_date, e.latest_inspection_date);
        const row: any = {
          'ลำดับ': idx + 1,
          'รหัสอุปกรณ์': e.code,
          'ประเภท': e.type,
          'รายละเอียด/รุ่น': e.category || '-',
          'ขนาด/น้ำหนัก': e.weight || '-',
          'สถานที่ติดตั้ง': e.location,
          'สถานะการตรวจ': e.inspection_status === 'INSPECTED' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
          'สถานะความพร้อม': e.ready_status === 'READY' ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน',
          'สภาพอุปกรณ์': e.defect_status === 'DEFECT' ? 'พบปัญหา' : (e.defect_status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ปกติ')
        };

        if (includeAge) {
          row['วันที่เริ่มใช้งาน'] = e.in_service_date || '-';
          row['อายุอุปกรณ์'] = age.formatted;
        }

        if (includeDefectNotes) {
          row['ข้อบกพร่อง/ปัญหา'] = e.defect_notes || '-';
        }

        if (includeInspector) {
          row['ผู้ตรวจเช็คล่าสุด'] = e.latest_inspector || '-';
          row['วันที่ตรวจล่าสุด'] = e.latest_inspection_date ? formatThaiDate(e.latest_inspection_date, true) : '-';
          row['ผู้รับผิดชอบ'] = e.responsible_person || '-';
        }

        return row;
      });

      const wsMaster = XLSX.utils.json_to_sheet(masterRows);
      applyAutoFit(wsMaster, masterRows);
      XLSX.utils.book_append_sheet(wb, wsMaster, 'รายการอุปกรณ์');
    }

    // 3. Sheet 3: แยกชีทตามประเภทอุปกรณ์ (ถัง EX, ตู้ FHC, สาย FH, หัวรับน้ำ HD)
    if (includeCategorizedSheets) {
      const categories = [
        { type: 'EX', sheetName: 'ถังดับเพลิง EX' },
        { type: 'FHC', sheetName: 'ตู้ดับเพลิง FHC' },
        { type: 'FH', sheetName: 'ตู้สายฉีด FH' },
        { type: 'HD', sheetName: 'หัวรับน้ำ HD' }
      ];

      categories.forEach(cat => {
        const catItems = selectedItems.filter(e => e.type === cat.type);
        if (catItems.length > 0) {
          const catRows = catItems.map((e, idx) => {
            const age = calculateEquipmentAge(e.in_service_date, e.latest_inspection_date);
            const row: any = {
              'ลำดับ': idx + 1,
              'รหัสอุปกรณ์': e.code,
              'ประเภท/รุ่น': e.category || e.type,
              'ขนาด/น้ำหนัก': e.weight || '-',
              'สถานที่ติดตั้ง': e.location,
              'สถานะตรวจ': e.inspection_status === 'INSPECTED' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
              'ความพร้อม': e.ready_status === 'READY' ? 'พร้อมใช้' : 'ไม่พร้อมใช้',
              'สภาพ': e.defect_status === 'DEFECT' ? 'พบข้อบกพร่อง' : (e.defect_status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ปกติ')
            };

            if (includeAge) {
              row['อายุอุปกรณ์'] = age.formatted;
            }

            if (includeDefectNotes) {
              row['หมายเหตุปัญหา'] = e.defect_notes || '-';
            }

            if (includeInspector) {
              row['ผู้ตรวจล่าสุด'] = e.latest_inspector || '-';
              row['วันที่ตรวจ'] = e.latest_inspection_date ? formatThaiDate(e.latest_inspection_date, true) : '-';
            }

            return row;
          });

          const wsCat = XLSX.utils.json_to_sheet(catRows);
          applyAutoFit(wsCat, catRows);
          XLSX.utils.book_append_sheet(wb, wsCat, cat.sheetName);
        }
      });
    }

    // 4. Sheet 4: รายการปัญหาและข้อบกพร่อง (Defect Items List)
    if (includeDefectSheet) {
      const defectList = selectedItems.filter(
        e => e.defect_status === 'DEFECT' || e.defect_status === 'RESOLVED' || (e.defect_notes && e.defect_notes.trim().length > 0)
      );

      if (defectList.length > 0) {
        const defectRows = defectList.map((e, idx) => ({
          'ลำดับ': idx + 1,
          'รหัสอุปกรณ์': e.code,
          'ประเภท': e.type,
          'สถานที่ติดตั้ง': e.location,
          'รายละเอียดข้อบกพร่อง/ปัญหา': e.defect_notes || 'พบความผิดปกติระหว่างการตรวจเช็ค',
          'สถานะการแก้ไข': e.defect_status === 'RESOLVED' ? 'ได้รับการแก้ไขแล้ว' : 'รอการแก้ไข',
          'ผู้ตรวจเช็ค': e.latest_inspector || e.responsible_person || '-',
          'วันที่ตรวจ': e.latest_inspection_date ? formatThaiDate(e.latest_inspection_date, true) : '-',
          'ผู้รับผิดชอบ': e.responsible_person || '-'
        }));

        const wsDefects = XLSX.utils.json_to_sheet(defectRows);
        applyAutoFit(wsDefects, defectRows);
        XLSX.utils.book_append_sheet(wb, wsDefects, 'รายการข้อบกพร่อง');
      }
    }

    // 5. Sheet 5: ประวัติการตรวจเช็ค (Inspection History)
    if (includeInspectionSheet) {
      // Find inspection records associated with selected items
      const selectedCodes = new Set(selectedItems.map(e => e.code));
      const selectedIdsSet = new Set(selectedItems.map(e => e.id));

      const relevantInspections = inspections.filter(i => {
        const matchesEquip = selectedIdsSet.has(i.equipment_id) || (i.equipment_code && selectedCodes.has(i.equipment_code));
        if (!matchesEquip) return false;
        if (selectedMonth !== 'ALL') {
          return isDateInSelectedPeriod(i.inspection_date);
        }
        return true;
      });

      if (relevantInspections.length > 0) {
        const inspRows = relevantInspections.map((i, idx) => ({
          'ลำดับ': idx + 1,
          'รหัสบันทึก': i.id,
          'รหัสอุปกรณ์': i.equipment_code || i.equipment_id,
          'ประเภทอุปกรณ์': i.equipment_type || '-',
          'วันที่ตรวจ': formatThaiDate(i.inspection_date, true),
          'ผู้ตรวจเช็ค': i.inspector_name,
          'ผลการตรวจ': i.ready_status === 'READY' ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน',
          'พบสิ่งผิดปกติ': i.is_abnormal ? 'พบสิ่งผิดปกติ' : 'ปกติ',
          'คำอธิบายความผิดปกติ': i.abnormal_description || '-',
          'สถานะการแก้ไข': i.defect_resolved ? 'แก้ไขเรียบร้อยแล้ว' : (i.is_abnormal ? 'รอแก้ไข' : '-')
        }));

        const wsInsp = XLSX.utils.json_to_sheet(inspRows);
        applyAutoFit(wsInsp, inspRows);
        XLSX.utils.book_append_sheet(wb, wsInsp, 'ประวัติการตรวจ');
      }
    }

    const filePeriod = selectedMonth === 'ALL'
      ? `ทั้งปี_${selectedYear}`
      : `${THAI_MONTHS[selectedMonth]}_${selectedYear}`;

    XLSX.writeFile(wb, `SHE_Safety_Report_${filePeriod}_${selectedType}.xlsx`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">ส่งออกรายงาน Excel (.xlsx)</h2>
              <p className="text-xs text-emerald-200">
                เลือกเดือน ปี ประเภทอุปกรณ์ ชีทงานที่ต้องการ และรายการอุปกรณ์ที่ต้องการบันทึก
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition"
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
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>ปี พ.ศ.</span>
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>ปี พ.ศ. {y}</option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>เลือกเดือน</span>
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span>ประเภทอุปกรณ์</span>
              </label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">ทั้งหมด (EX, FHC, FH, HD)</option>
                <option value="EX">ถังดับเพลิง (EX)</option>
                <option value="FHC">ตู้ดับเพลิง (FHC)</option>
                <option value="FH">ตู้สายฉีด (FH)</option>
                <option value="HD">หัวรับน้ำ (HD)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Worksheet Options & Column Options */}
          <div className="pt-2 border-t border-slate-200/80 space-y-2">
            {/* Sheet Options */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>ชีทงานที่ต้องการ:</span>
              </span>

              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeSummarySheet}
                  onChange={e => setIncludeSummarySheet(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>สรุปภาพรวม (Summary)</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeEquipmentSheet}
                  onChange={e => setIncludeEquipmentSheet(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>รายการอุปกรณ์หลัก</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeCategorizedSheets}
                  onChange={e => setIncludeCategorizedSheets(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>แยกชีทตามประเภท (EX, FHC, FH, HD)</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeDefectSheet}
                  onChange={e => setIncludeDefectSheet(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>รายการข้อบกพร่อง</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeInspectionSheet}
                  onChange={e => setIncludeInspectionSheet(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>ประวัติการตรวจเช็ค</span>
              </label>
            </div>

            {/* Column preferences */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                <Columns3 className="w-3.5 h-3.5 text-blue-600" />
                <span>คอลัมน์ข้อมูลเพิ่มเติม:</span>
              </span>

              <label className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAge}
                  onChange={e => setIncludeAge(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>วันเริ่มใช้งาน & อายุอุปกรณ์</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInspector}
                  onChange={e => setIncludeInspector(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>ผู้ตรวจเช็คล่าสุด & วันที่ตรวจ</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDefectNotes}
                  onChange={e => setIncludeDefectNotes(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>คำอธิบายข้อบกพร่อง</span>
              </label>
            </div>
          </div>
        </div>

        {/* Selection Toolbar & Search */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick Selection Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1 transition"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>เลือกทั้งหมด ({filteredItems.length})</span>
            </button>

            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1 transition"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>ล้างการเลือก</span>
            </button>

            <button
              onClick={handleSelectDefectsOnly}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-semibold flex items-center space-x-1 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>เลือกเฉพาะที่มีปัญหา</span>
            </button>

            <button
              onClick={handleSelectInspectedOnly}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold flex items-center space-x-1 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>เลือกเฉพาะที่ตรวจแล้ว</span>
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
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs w-44 sm:w-56 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl font-bold whitespace-nowrap">
              เลือกแล้ว: <span className="text-emerald-700">{selectedItems.length}</span> รายการ
            </div>
          </div>
        </div>

        {/* Equipment Items Table / Checklist */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2 bg-white rounded-2xl border border-slate-200">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
              <div className="font-bold text-slate-600 text-sm">ไม่พบรายการอุปกรณ์ตามเงื่อนไขที่เลือก</div>
              <div className="text-xs text-slate-400">
                ลองปรับเปลี่ยนตัวเลือกเดือน หรือ เลือกประเภทอุปกรณ์เป็น &quot;ทั้งหมด&quot;
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                        onChange={e => {
                          if (e.target.checked) handleSelectAll();
                          else handleDeselectAll();
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">รหัสอุปกรณ์</th>
                    <th className="py-2.5 px-3">ประเภท</th>
                    <th className="py-2.5 px-3">สถานที่ติดตั้ง</th>
                    <th className="py-2.5 px-3 text-center">สถานะการตรวจ</th>
                    <th className="py-2.5 px-3 text-center">ความพร้อม</th>
                    <th className="py-2.5 px-3 text-center">สภาพอุปกรณ์</th>
                    <th className="py-2.5 px-3">ผู้ตรวจล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredItems.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    const isDefect = item.defect_status === 'DEFECT' || item.ready_status === 'NOT_READY';

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`cursor-pointer transition select-none ${
                          isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50 opacity-80'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleItem(item.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {item.code}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {item.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                          {item.location}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.inspection_status === 'INSPECTED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.inspection_status === 'INSPECTED' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.ready_status === 'READY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.ready_status === 'READY' ? 'พร้อมใช้' : 'ไม่พร้อมใช้'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDefect
                              ? 'bg-red-100 text-red-800'
                              : item.defect_status === 'RESOLVED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isDefect ? 'พบปัญหา' : (item.defect_status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ปกติ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          <div>{item.latest_inspector || item.responsible_person || '-'}</div>
                          {item.latest_inspection_date && (
                            <div className="text-[10px] text-slate-400">
                              {formatThaiDate(item.latest_inspection_date, false, true)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            ไฟล์ Excel จะประกอบด้วยชีทงานตามที่ติ๊กเลือก และมีตารางสรุป KPI รวม 4 ประเภทอุปกรณ์ (EX, FHC, FH, HD) ให้อัตโนมัติ
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              ยกเลิก
            </button>

            <button
              onClick={handleExportExcel}
              disabled={selectedItems.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด Excel ({selectedItems.length} รายการ)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

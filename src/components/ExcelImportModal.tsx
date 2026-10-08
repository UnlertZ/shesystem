import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Equipment, EquipmentType, User } from '../types';
import { storageService } from '../services/storage';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  AlertTriangle,
  Flame,
  Check
} from 'lucide-react';

interface ExcelImportModalProps {
  currentUser: User | null;
  defaultType: EquipmentType;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedEquipmentRow {
  index: number;
  type: EquipmentType;
  category: string;
  weight: string;
  location: string;
  in_service_date: string;
  responsible_person: string;
  isValid: boolean;
  error?: string;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  currentUser,
  defaultType,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedEquipmentRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ประเภทอุปกรณ์ (EX/FHC/FH/HD)': 'EX',
        'ชนิดของอุปกรณ์': 'ผงเคมีแห้ง (Dry Chemical)',
        'น้ำหนักหรือขนาด': '10 lbs',
        'สถานที่ติดตั้ง': 'อาคาร A ชั้น 1 ประตูหนีไฟทิศเหนือ',
        'วันที่เริ่มใช้งาน (ปปปป-ดด-วว)': '2024-01-15',
        'ผู้รับผิดชอบ': 'somchai'
      },
      {
        'ประเภทอุปกรณ์ (EX/FHC/FH/HD)': 'EX',
        'ชนิดของอุปกรณ์': 'ก๊าซคาร์บอนไดออกไซด์ (CO2)',
        'น้ำหนักหรือขนาด': '15 lbs',
        'สถานที่ติดตั้ง': 'ห้องเซิร์ฟเวอร์ ชั้น 2',
        'วันที่เริ่มใช้งาน (ปปปป-ดด-วว)': '2024-03-01',
        'ผู้รับผิดชอบ': 'supervisor1'
      },
      {
        'ประเภทอุปกรณ์ (EX/FHC/FH/HD)': 'FHC',
        'ชนิดของอุปกรณ์': 'ตู้ดับเพลิงเดี่ยว กระจกเซฟตี้',
        'น้ำหนักหรือขนาด': '1.5 นิ้ว x 30 ม.',
        'สถานที่ติดตั้ง': 'โถงทางเดินกลาง อาคาร B',
        'วันที่เริ่มใช้งาน (ปปปป-ดด-วว)': '2023-11-20',
        'ผู้รับผิดชอบ': 'admin'
      },
      {
        'ประเภทอุปกรณ์ (EX/FHC/FH/HD)': 'FH',
        'ชนิดของอุปกรณ์': 'สายส่งน้ำผ้าใบสังเคราะห์',
        'น้ำหนักหรือขนาด': '2.5 นิ้ว x 30 ม.',
        'สถานที่ติดตั้ง': 'ลานจอดรถคลังสินค้า 1',
        'วันที่เริ่มใช้งาน (ปปปป-ดด-วว)': '2023-08-10',
        'ผู้รับผิดชอบ': 'staff1'
      },
      {
        'ประเภทอุปกรณ์ (EX/FHC/FH/HD)': 'HD',
        'ชนิดของอุปกรณ์': 'หัวรับน้ำแบบสวมเร็วทองเหลือง',
        'น้ำหนักหรือขนาด': '2.5 นิ้ว 2 ทาง',
        'สถานที่ติดตั้ง': 'กำแพงด้านหน้าโรงงาน',
        'วันที่เริ่มใช้งาน (ปปปป-ดด-วว)': '2022-05-01',
        'ผู้รับผิดชอบ': 'opadmin'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    ws['!cols'] = [
      { wch: 28 },
      { wch: 30 },
      { wch: 20 },
      { wch: 35 },
      { wch: 28 },
      { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'แบบฟอร์มนำเข้าอุปกรณ์');
    XLSX.writeFile(wb, 'SHE_Equipment_Import_Template.xlsx');
  };

  // Helper to normalize type
  const normalizeType = (val?: any): EquipmentType => {
    if (!val) return defaultType;
    const str = String(val).toUpperCase().trim();
    if (str.includes('FHC') || str.includes('ตู้ดับเพลิง')) return 'FHC';
    if (str.includes('FH') || str.includes('สายฉีด')) return 'FH';
    if (str.includes('HD') || str.includes('หัวรับน้ำ')) return 'HD';
    return 'EX';
  };

  // Helper to normalize dates (Excel serial or string)
  const normalizeDate = (val?: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    return str;
  };

  // Parse Uploaded Excel File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setStatusMessage('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          setIsProcessing(false);
          setStatusMessage('ไฟล์ไม่มีข้อมูล กรุณาตรวจสอบเนื้อหาในไฟล์');
          return;
        }

        const rows: ParsedEquipmentRow[] = jsonData.map((row, idx) => {
          // Normalize column lookups with flexible header matches
          const rawType = row['ประเภทอุปกรณ์ (EX/FHC/FH/HD)'] || row['ประเภทอุปกรณ์'] || row['Type'] || row['type'];
          const rawCategory = row['ชนิดของอุปกรณ์'] || row['ชนิด'] || row['ประเภท'] || row['Category'] || row['category'];
          const rawWeight = row['น้ำหนักหรือขนาด'] || row['น้ำหนัก'] || row['ขนาด'] || row['Weight'] || row['weight'];
          const rawLocation = row['สถานที่ติดตั้ง'] || row['สถานที่'] || row['Location'] || row['location'];
          const rawDate = row['วันที่เริ่มใช้งาน (ปปปป-ดด-วว)'] || row['วันที่เริ่มใช้งาน'] || row['Date'] || row['in_service_date'];
          const rawResponsible = row['ผู้รับผิดชอบ'] || row['Responsible'] || row['responsible_person'];

          const type = normalizeType(rawType);
          const location = String(rawLocation || '').trim();
          const category = String(rawCategory || '').trim();
          const weight = String(rawWeight || '').trim();
          const in_service_date = normalizeDate(rawDate);
          const responsible_person = String(rawResponsible || currentUser?.username || 'แอดมิน').trim();

          const isValid = location.length > 0;
          return {
            index: idx + 1,
            type,
            category,
            weight,
            location,
            in_service_date,
            responsible_person,
            isValid,
            error: !isValid ? 'ต้องระบุสถานที่ติดตั้ง' : undefined
          };
        });

        setParsedRows(rows);
        setIsProcessing(false);
      } catch (err: any) {
        setIsProcessing(false);
        setStatusMessage('ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ Excel (.xlsx, .xls) หรือ CSV ที่ถูกต้อง');
      }
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setStatusMessage('เกิดข้อผิดพลาดในการอ่านไฟล์');
    };

    reader.readAsBinaryString(selectedFile);
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('ไม่มีรายการที่ผ่านการตรวจสอบ กรุณาตรวจสอบข้อมูลในไฟล์');
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToAdd = validRows.map(row => ({
        type: row.type,
        category: row.category,
        weight: row.weight,
        location: row.location,
        in_service_date: row.in_service_date,
        responsible_person: row.responsible_person,
        ready_status: 'READY' as const,
        inspection_status: 'PENDING' as const,
        defect_status: 'NORMAL' as const
      }));

      // Add to storage and Cloudflare D1
      storageService.bulkAddEquipment(itemsToAdd);

      setIsProcessing(false);
      setImportStatus('SUCCESS');
      setStatusMessage(`นำเข้าข้อมูลอุปกรณ์สำเร็จทั้งหมด ${validRows.length} รายการ เรียบร้อยแล้ว`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setIsProcessing(false);
      setImportStatus('ERROR');
      setStatusMessage(err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-slate-800">นำเข้าอุปกรณ์จากไฟล์ Excel</h3>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                  สิทธิ์เฉพาะ P4
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                อัปโหลดรายการอุปกรณ์ดับเพลิงทีละหลายรายการเข้าระบบและฐานข้อมูล Cloudflare D1
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          {/* Step 1: Download Template */}
          <div className="p-4 bg-linear-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>ขั้นตอนที่ 1: ดาวน์โหลดแม่แบบไฟล์ Excel</span>
              </div>
              <p className="text-xs text-slate-600">
                ใช้ไฟล์ต้นแบบเพื่อกรอกข้อมูลให้ตรงตามโครงสร้างที่ระบบรองรับ (EX, FHC, FH, HD)
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs transition flex items-center space-x-1.5 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดไฟล์แม่แบบ</span>
            </button>
          </div>

          {/* Step 2: Upload Dropzone */}
          <div className="space-y-2">
            <div className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
              <Upload className="w-4 h-4 text-slate-600" />
              <span>ขั้นตอนที่ 2: เลือกไฟล์ Excel ที่กรอกข้อมูลแล้ว (.xlsx, .xls)</span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50 hover:bg-emerald-50/30 transition cursor-pointer text-center space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto" />
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {file ? file.name : 'คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  รองรับไฟล์ .xlsx, .xls, .csv ขนาดไม่เกิน 10MB
                </p>
              </div>
            </div>
          </div>

          {/* Status Banners */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border flex items-center space-x-2 ${
              importStatus === 'SUCCESS'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {importStatus === 'SUCCESS' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Step 3: Preview Data Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                  <span>ตัวอย่างข้อมูลที่ตรวจพบ ({parsedRows.length} รายการ)</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    สมบูรณ์ {validCount}
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                      ผิดพลาด {invalidCount}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParsedRows([]);
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-400 hover:text-red-600 text-xs underline"
                >
                  ล้างรายการ
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">ประเภท</th>
                      <th className="py-2.5 px-3">ชนิด/ประเภท</th>
                      <th className="py-2.5 px-3">น้ำหนัก/ขนาด</th>
                      <th className="py-2.5 px-3">สถานที่ติดตั้ง</th>
                      <th className="py-2.5 px-3">วันที่เริ่มใช้</th>
                      <th className="py-2.5 px-3">ผู้รับผิดชอบ</th>
                      <th className="py-2.5 px-3 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {parsedRows.map((row) => (
                      <tr key={row.index} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                        <td className="py-2 px-3 text-slate-400">{row.index}</td>
                        <td className="py-2 px-3 font-bold text-red-700">{row.type}</td>
                        <td className="py-2 px-3">{row.category || '-'}</td>
                        <td className="py-2 px-3">{row.weight || '-'}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{row.location}</td>
                        <td className="py-2 px-3 text-slate-500">{row.in_service_date || '-'}</td>
                        <td className="py-2 px-3">{row.responsible_person}</td>
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <span className="text-emerald-600 font-bold">✓ พร้อม</span>
                          ) : (
                            <span className="text-red-600 font-bold" title={row.error}>
                              ✕ {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            disabled={isProcessing || validCount === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 transition flex items-center space-x-1.5"
          >
            {isProcessing ? (
              <span>กำลังประมวลผล...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>ยืนยันนำเข้าข้อมูล ({validCount} รายการ)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

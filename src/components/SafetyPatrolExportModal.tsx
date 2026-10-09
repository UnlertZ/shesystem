import React, { useRef, useState } from 'react';
import { SafetyPatrolRound, SafetyFinding, User } from '../types';
import { SheLogo } from './SheLogo';
import { formatThaiDate, getNowThai } from '../utils/thaiDate';
import { exportSafetyPatrolToExcel, exportSafetyPatrolPhotos, getFindingStatusText, getSubtypeText } from '../utils/safetyExport';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  Images,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  AlertCircle,
  FileText,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

interface SafetyPatrolExportModalProps {
  currentUser?: User | null;
  patrols: SafetyPatrolRound[];
  findings: SafetyFinding[];
  initialPatrolId?: string;
  onClose: () => void;
}

export const SafetyPatrolExportModal: React.FC<SafetyPatrolExportModalProps> = ({
  currentUser,
  patrols,
  findings,
  initialPatrolId,
  onClose
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedPatrolId, setSelectedPatrolId] = useState<string>(initialPatrolId || (patrols[0]?.id || 'ALL'));
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'RECOMMEND' | 'COMMEND' | 'BEFORE_AFTER'>('ALL');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const now = getNowThai();

  // Selected Patrol Object
  const currentPatrol = patrols.find(p => p.id === selectedPatrolId);

  // Filter findings based on selected Patrol
  const patrolFindings = selectedPatrolId === 'ALL'
    ? findings
    : findings.filter(f => f.patrol_id === selectedPatrolId);

  // Filter by category
  const filteredFindings = patrolFindings.filter(f => {
    if (selectedCategory === 'RECOMMEND') return f.category === 'RECOMMEND';
    if (selectedCategory === 'COMMEND') return f.category === 'COMMEND';
    if (selectedCategory === 'BEFORE_AFTER') return f.category === 'RECOMMEND' && (f.status === 'APPROVED' || f.status === 'PENDING_REVIEW' || !!f.after_photo_url);
    return true;
  });

  const recommendFindings = patrolFindings.filter(f => f.category === 'RECOMMEND');
  const commendFindings = patrolFindings.filter(f => f.category === 'COMMEND');
  const approvedCount = recommendFindings.filter(f => f.status === 'APPROVED').length;
  const pendingCount = recommendFindings.filter(f => f.status === 'PENDING_ACTION' || f.status === 'PENDING_REVIEW' || f.status === 'REJECTED').length;

  // Fallback placeholder data URL if an image cannot be downloaded/converted
  const createPlaceholderDataUrl = (title: string): string => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 225;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 400, 225);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, 384, 209);
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title || 'รูปภาพประกอบ', 200, 115);
      }
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (_) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" fill="%23f8fafc"><rect width="100%" height="100%"/><text x="50%" y="50%" fill="%2364748b" font-size="14" text-anchor="middle">Photo</text></svg>';
    }
  };

  // Helper to convert images to Base64 to guarantee Same-Origin canvas rendering (prevents tainted canvas)
  const urlToBase64 = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Could not convert image to base64, using fallback:', url, e);
      return '';
    }
  };

  // Handlers
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExportingPDF(true);

    const element = reportRef.current;
    const imgElements = Array.from(element.querySelectorAll('img'));
    const originalAttrs: { img: HTMLImageElement; src: string; crossOrigin: string | null }[] = [];

    try {
      // 1. Convert all report images to base64 data URLs in parallel (guaranteed no cross-origin taint)
      await Promise.all(
        imgElements.map(async (img) => {
          originalAttrs.push({ img, src: img.src, crossOrigin: img.crossOrigin });
          img.crossOrigin = 'anonymous';
          if (img.src && !img.src.startsWith('data:')) {
            const b64 = await urlToBase64(img.src);
            if (b64 && b64.startsWith('data:')) {
              img.src = b64;
              if (!img.complete) {
                await new Promise((r) => {
                  img.onload = r;
                  img.onerror = r;
                });
              }
            } else {
              // Replace with local data URL placeholder so canvas is never tainted
              img.src = createPlaceholderDataUrl(img.alt || 'รูปภาพประกอบ');
            }
          }
        })
      );

      // 2. Render to canvas with fixed standard A4 capture width (800px)
      // This prevents the page from squishing on the left or having huge blank margins
      const captureWidth = 800;
      let detectedBlocks: { top: number; bottom: number }[] = [];

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: captureWidth,
        windowWidth: captureWidth,
        onclone: (clonedDoc) => {
          const clonedReport = clonedDoc.getElementById('printable-patrol-report') as HTMLElement;
          if (clonedReport) {
            clonedReport.style.width = `${captureWidth}px`;
            clonedReport.style.maxWidth = `${captureWidth}px`;
            clonedReport.style.minWidth = `${captureWidth}px`;
            clonedReport.style.boxSizing = 'border-box';
            clonedReport.style.margin = '0 auto';
            clonedReport.style.borderRadius = '0px';
            clonedReport.style.boxShadow = 'none';
            clonedReport.style.border = 'none';

            // Measure blocks in clonedDoc under exact 800px layout
            const reportRect = clonedReport.getBoundingClientRect();
            const blocks = Array.from(
              clonedReport.querySelectorAll(
                '.break-inside-avoid, [data-break-avoid], table'
              )
            );
            detectedBlocks = blocks
              .map((b) => {
                const r = b.getBoundingClientRect();
                return {
                  top: r.top - reportRect.top,
                  bottom: r.bottom - reportRect.top
                };
              })
              .filter((b) => b.bottom - b.top > 20);
          }
        }
      });

      // 3. Smart Slice Algorithm: Slices canvas ONLY between blocks (never cutting cards or photos)
      const scaleFactor = canvas.width / captureWidth;
      // Standard A4 aspect ratio height in canvas pixels:
      const maxPageCanvasHeight = Math.floor(canvas.width * (297 / 210));

      const pageBreakPoints: number[] = [0];
      let currentY = 0;

      while (currentY < canvas.height - 20) {
        const targetY = currentY + maxPageCanvasHeight;
        if (targetY >= canvas.height) {
          pageBreakPoints.push(canvas.height);
          break;
        }

        let bestCutY = targetY;
        // Check if any block crosses targetY
        const crossingBlock = detectedBlocks.find(
          (b) => (b.top * scaleFactor) < targetY && (b.bottom * scaleFactor) > targetY
        );

        if (crossingBlock) {
          const blockTopCanvas = crossingBlock.top * scaleFactor;
          // If the block starts reasonably down the page, cut just above it
          if (blockTopCanvas > currentY + (maxPageCanvasHeight * 0.25)) {
            bestCutY = blockTopCanvas - (8 * scaleFactor);
          } else {
            bestCutY = targetY;
          }
        }

        // Safety guarantee: Ensure forward progress
        if (bestCutY <= currentY + (maxPageCanvasHeight * 0.1)) {
          bestCutY = targetY;
        }

        pageBreakPoints.push(bestCutY);
        currentY = bestCutY;
      }

      // 4. Build jsPDF document with sliced pages
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfPageWidth = 210;

      for (let i = 0; i < pageBreakPoints.length - 1; i++) {
        const startY = pageBreakPoints[i];
        const endY = pageBreakPoints[i + 1];
        const sliceHeight = endY - startY;
        if (sliceHeight <= 0) continue;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pctx = pageCanvas.getContext('2d');
        if (pctx) {
          pctx.fillStyle = '#ffffff';
          pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pctx.drawImage(
            canvas,
            0,
            startY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const renderedHeightMm = (sliceHeight * pdfPageWidth) / canvas.width;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidth, renderedHeightMm);
      }

      const dateSuffix = currentPatrol?.patrol_date ? currentPatrol.patrol_date.replace(/[\/\\:]/g, '_') : 'All';
      pdf.save(`SHE_Safety_Patrol_Report_${dateSuffix}.pdf`);
    } catch (err: any) {
      console.error('PDF export error:', err);
      const msg = err?.message || String(err);
      alert(`ไม่สามารถประมวลผล PDF ได้: ${msg}\nกำลังเปิดคำสั่งพิมพ์ผ่านเบราว์เซอร์เพื่อบันทึกเป็น PDF แทน`);
      window.print();
    } finally {
      // 3. Restore original image attributes
      for (const item of originalAttrs) {
        item.img.src = item.src;
        if (item.crossOrigin) {
          item.img.crossOrigin = item.crossOrigin;
        } else {
          item.img.removeAttribute('crossorigin');
        }
      }
      setIsExportingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportSafetyPatrolToExcel(patrols, findings, selectedPatrolId);
  };

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      await exportSafetyPatrolPhotos(patrols, findings, selectedPatrolId);
    } catch (err) {
      console.error('ZIP export error:', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ');
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* ============================================================== */}
        {/* Modal Top Control Bar (Hidden on print)                         */}
        {/* ============================================================== */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 print:hidden">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-bold">
                Export รายงานการเดินตรวจความปลอดภัย คปอ.
              </h2>
              <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                เฉพาะแอดมิน (Admin Only)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              เลือกรอบเดินตรวจที่ต้องการเพื่อดูตัวอย่าง และส่งออกรายงานเป็น PDF, Excel (.xlsx) หรือดาวน์โหลดรูปภาพ (.zip)
            </p>
          </div>

          <button
            onClick={onClose}
            className="self-end md:self-auto p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Action Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          {/* Select Patrol Round Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>เลือกรอบเดินตรวจ:</span>
              </span>
              <select
                value={selectedPatrolId}
                onChange={(e) => setSelectedPatrolId(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none max-w-xs sm:max-w-md truncate"
              >
                <option value="ALL">🌐 ทุกรอบเดินตรวจทั้งหมด ({patrols.length} รอบ - {findings.length} รายการ)</option>
                {patrols.map(p => {
                  const pCount = findings.filter(f => f.patrol_id === p.id).length;
                  return (
                    <option key={p.id} value={p.id}>
                      📅 {p.patrol_date} | {p.title} ({p.time_range}) - {pCount} รายการ
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filter Category */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 font-medium">หมวดหมู่:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">ทั้งหมด ({patrolFindings.length})</option>
                <option value="RECOMMEND">เฉพาะข้อแนะนำ/จุดเสี่ยง ({recommendFindings.length})</option>
                <option value="COMMEND">เฉพาะเรื่องที่ชมเชย ({commendFindings.length})</option>
                <option value="BEFORE_AFTER">เฉพาะงาน Before & After ({recommendFindings.filter(f => f.after_photo_url || f.status === 'APPROVED').length})</option>
              </select>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Download PDF */}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
              title="บันทึกรายงานเป็นไฟล์ PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPDF ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
              title="พิมพ์รายงานผ่านเครื่องพิมพ์หรือ Save to PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์รายงาน (Print)</span>
            </button>

            {/* Excel */}
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
              title="ส่งออกข้อมูลเป็น Excel (.xlsx) ครบทุกฟิลด์"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            {/* ZIP Photos */}
            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
              title="ดาวน์โหลดรูปภาพทั้งหมดในรอบตรวจนี้เป็นไฟล์ .zip"
            >
              <Images className="w-3.5 h-3.5" />
              <span>{isExportingZip ? 'กำลังบีบอัด...' : 'รูปภาพ (.zip)'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Printable & Exportable Report Canvas                           */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100">
          <div
            ref={reportRef}
            id="printable-patrol-report"
            className="bg-white mx-auto max-w-4xl p-6 sm:p-10 rounded-2xl shadow-md border border-slate-200 text-slate-800 space-y-6 print:p-0 print:border-none print:shadow-none"
            style={{ minHeight: '297mm' }}
          >
            {/* Report Header */}
            <div className="border-b-2 border-emerald-600 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 break-inside-avoid">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <SheLogo size="sm" showSubtext={false} />
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                    SHE SAFETY MANAGEMENT SYSTEM
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 pt-1">
                  รายงานผลการเดินสำรวจความปลอดภัย (Safety Walk & Patrol Report)
                </h1>
                <p className="text-xs text-slate-500">
                  คณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน (คปอ.)
                </p>
              </div>

              <div className="text-left sm:text-right text-[11px] text-slate-500 space-y-0.5 shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
                <div>วันที่ออกรายงาน: <strong className="text-slate-700">{formatThaiDate(now, true)}</strong></div>
                <div>ผู้ออกรายงาน: <strong className="text-slate-700">{currentUser?.full_name || currentUser?.username || 'แอดมินระบบ'}</strong></div>
                <div>สิทธิ์ผู้ใช้งาน: <strong className="text-emerald-700 font-bold">{currentUser?.role || 'Admin'}</strong></div>
              </div>
            </div>

            {/* Selected Patrol Round Information Box */}
            <div
              className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-wrap gap-3 text-xs break-inside-avoid"
              style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}
            >
              <div className="space-y-1.5" style={{ flex: '1 1 45%', minWidth: '240px' }}>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-slate-700">หัวข้อรอบตรวจ:</span>
                  <span className="text-slate-900 font-semibold">{currentPatrol?.title || 'ทุกรอบการเดินตรวจรวม'}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600">วันที่เดินตรวจ:</span>
                  <strong className="text-slate-800">{currentPatrol?.patrol_date || 'ทุกช่วงวันที่'}</strong>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600">ช่วงเวลาเดินตรวจ:</span>
                  <strong className="text-slate-800">{currentPatrol?.time_range || '-'}</strong>
                </div>
              </div>

              <div className="space-y-1.5" style={{ flex: '1 1 45%', minWidth: '240px' }}>
                <div className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600">พื้นที่/โซนที่เดินตรวจ:</span>
                  <strong className="text-slate-800">{currentPatrol?.location || 'ทั่วทั้งโรงงานและสำนักงาน'}</strong>
                </div>
                <div className="flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600">ผู้สร้างรายการ:</span>
                  <strong className="text-slate-800">{currentPatrol?.created_by_name || '-'}</strong>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-600">สถานะรอบตรวจ:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    currentPatrol?.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {currentPatrol?.status === 'OPEN' ? 'เปิดรับข้อมูล' : 'ปิดรอบตรวจแล้ว'}
                  </span>
                </div>
              </div>

              {currentPatrol?.description && (
                <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-600" style={{ width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                  <span className="font-semibold text-slate-700">วัตถุประสงค์/บันทึกเพิ่มเติม:</span> {currentPatrol.description}
                </div>
              )}
            </div>

            {/* Statistics Summary Cards */}
            <div
              className="flex flex-row gap-3 text-xs break-inside-avoid"
              style={{ display: 'flex', flexDirection: 'row', gap: '12px', width: '100%', boxSizing: 'border-box' }}
            >
              <div
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center"
                style={{ flex: '1 1 0%', width: '23.5%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}
              >
                <div className="text-slate-400 font-medium text-[11px]">รายการตรวจพบทั้งหมด</div>
                <div className="text-2xl font-extrabold text-slate-800 mt-1">{patrolFindings.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">ในรอบที่เลือก</div>
              </div>

              <div
                className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-center"
                style={{ flex: '1 1 0%', width: '23.5%', boxSizing: 'border-box', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px', textAlign: 'center' }}
              >
                <div className="text-amber-800 font-medium text-[11px] flex items-center justify-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>ข้อเสนอแนะ/จุดเสี่ยง</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-700 mt-1">{recommendFindings.length}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">จุดที่ต้องติดตาม</div>
              </div>

              <div
                className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-center"
                style={{ flex: '1 1 0%', width: '23.5%', boxSizing: 'border-box', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}
              >
                <div className="text-emerald-800 font-medium text-[11px] flex items-center justify-center space-x-1">
                  <ThumbsUp className="w-3 h-3 text-emerald-600" />
                  <span>เรื่องที่ชมเชย</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">{commendFindings.length}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">แบบอย่างที่ดี</div>
              </div>

              <div
                className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-center"
                style={{ flex: '1 1 0%', width: '23.5%', boxSizing: 'border-box', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px', textAlign: 'center' }}
              >
                <div className="text-blue-800 font-medium text-[11px] flex items-center justify-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  <span>แก้ไขสำเร็จ (ผ่าน)</span>
                </div>
                <div className="text-2xl font-extrabold text-blue-700 mt-1">{approvedCount}</div>
                <div className="text-[10px] text-blue-600 mt-0.5">
                  {recommendFindings.length > 0 ? `${Math.round((approvedCount / recommendFindings.length) * 100)}% สำเร็จ` : '100%'}
                </div>
              </div>
            </div>

            {/* Findings Content Section */}
            {filteredFindings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                ไม่พบรายการตรวจพบในเงื่อนไขที่เลือก
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Recommendations & Hazards */}
                {(selectedCategory === 'ALL' || selectedCategory === 'RECOMMEND' || selectedCategory === 'BEFORE_AFTER') && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                      <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                      <h3 className="font-bold text-sm text-slate-800">
                        1. รายการข้อเสนอแนะและจุดเสี่ยง (Recommendations & Hazards / Near Misses)
                      </h3>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        {recommendFindings.length} รายการ
                      </span>
                    </div>

                    <div className="space-y-4">
                      {recommendFindings.map((finding, idx) => (
                        <div
                          key={finding.id}
                          className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-3 break-inside-avoid"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2">
                              <span className="bg-slate-800 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-xs text-slate-800">
                                จุดที่พบ: {finding.location}
                              </span>
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                                {getSubtypeText(finding.sub_type)}
                              </span>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border">
                              {getFindingStatusText(finding.status)}
                            </span>
                          </div>

                          {/* Photos: Side-by-side Before & After if available */}
                          <div
                            className="flex flex-row gap-3"
                            style={{ display: 'flex', flexDirection: 'row', gap: '12px', width: '100%', boxSizing: 'border-box' }}
                          >
                            {/* Before Photo */}
                            <div className="space-y-1" style={{ flex: '1 1 0%', width: '48%', boxSizing: 'border-box' }}>
                              <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                                <span className="text-red-700">📷 รูปถ่ายก่อนแก้ไข (Before)</span>
                                <span className="text-[10px] text-slate-400">บันทึกโดย: {finding.reporter_name}</span>
                              </div>
                              <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                <img
                                  src={finding.photo_url}
                                  alt="Before"
                                  crossOrigin="anonymous"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>

                            {/* After Photo or Pending */}
                            <div className="space-y-1" style={{ flex: '1 1 0%', width: '48%', boxSizing: 'border-box' }}>
                              <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                                <span className="text-emerald-700">📸 รูปถ่ายหลังแก้ไข (After)</span>
                                {finding.resolved_by_name && (
                                  <span className="text-[10px] text-slate-400">แก้ไขโดย: {finding.resolved_by_name}</span>
                                )}
                              </div>
                              {finding.after_photo_url ? (
                                <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-emerald-300">
                                  <img
                                    src={finding.after_photo_url}
                                    alt="After"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="aspect-video rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                                  <Clock className="w-6 h-6 mb-1 text-slate-300" />
                                  <span>ยังไม่มีการส่งรูปหลังแก้ไข</span>
                                  <span className="text-[10px] text-slate-400">อยู่ระหว่างดำเนินการ</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Details & Actions */}
                          <div
                            className="flex flex-row gap-3 text-xs pt-1"
                            style={{ display: 'flex', flexDirection: 'row', gap: '12px', width: '100%', boxSizing: 'border-box' }}
                          >
                            <div
                              className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 space-y-1"
                              style={{ flex: '1 1 0%', width: '48%', boxSizing: 'border-box' }}
                            >
                              <div className="font-bold text-amber-900">รายละเอียดอันตราย / ความเสี่ยง:</div>
                              <p className="text-slate-700 text-[11px] leading-relaxed">{finding.description}</p>

                              {finding.recommendation && (
                                <div className="pt-1.5 border-t border-amber-200/50">
                                  <span className="font-bold text-amber-900">มาตรการป้องกัน/แก้ไขที่แนะนำ:</span>
                                  <p className="text-slate-700 text-[11px] mt-0.5">{finding.recommendation}</p>
                                </div>
                              )}
                            </div>

                            <div
                              className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1"
                              style={{ flex: '1 1 0%', width: '48%', boxSizing: 'border-box' }}
                            >
                              <div className="font-bold text-slate-800">การดำเนินการแก้ไขจริง (Action Taken):</div>
                              <p className="text-slate-700 text-[11px] leading-relaxed">
                                {finding.action_taken || 'ยังไม่มีการบันทึกการแก้ไข'}
                              </p>

                              {finding.reviewed_by_name && (
                                <div className="pt-1.5 border-t border-slate-200 text-[10px]">
                                  <span className="font-bold text-slate-700">ตรวจโดยแอดมิน:</span> {finding.reviewed_by_name} ({finding.status === 'APPROVED' ? 'ผ่าน' : 'ไม่ผ่าน'})
                                  {finding.review_notes && <p className="text-red-600 mt-0.5">เหตุผล: {finding.review_notes}</p>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Commendations */}
                {(selectedCategory === 'ALL' || selectedCategory === 'COMMEND') && commendFindings.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                      <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                        <ThumbsUp className="w-4 h-4" />
                      </span>
                      <h3 className="font-bold text-sm text-slate-800">
                        2. รายการเรื่องที่ชมเชย (Commendations & Best Practices)
                      </h3>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {commendFindings.length} รายการ
                      </span>
                    </div>

                    <div
                      className="flex flex-row flex-wrap gap-4"
                      style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '16px', width: '100%', boxSizing: 'border-box' }}
                    >
                      {commendFindings.map((finding, idx) => (
                        <div
                          key={finding.id}
                          className="border border-emerald-200 bg-emerald-50/20 rounded-2xl p-4 space-y-3 break-inside-avoid"
                          style={{ flex: '1 1 45%', width: '48%', boxSizing: 'border-box' }}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">จุดที่พบ: {finding.location}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              ชมเชย
                            </span>
                          </div>

                          <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                            <img
                              src={finding.photo_url}
                              alt="Commendation"
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="text-xs space-y-1">
                            <div className="font-semibold text-slate-700">รายละเอียดการชมเชย:</div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">{finding.description}</p>
                          </div>

                          <div className="pt-2 border-t border-emerald-100 text-[10px] text-slate-400">
                            รายงานโดย: <strong className="text-slate-600">{finding.reporter_name}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Official Signature Section */}
            <div
              className="pt-8 border-t-2 border-slate-200 flex flex-row justify-between gap-6 text-center text-xs break-inside-avoid"
              style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: '24px', width: '100%', boxSizing: 'border-box' }}
            >
              <div className="space-y-8" style={{ flex: '1 1 0%', width: '31%', boxSizing: 'border-box' }}>
                <div className="text-slate-600 font-medium">ลงชื่อผู้จัดทำรายงาน</div>
                <div className="border-b border-dashed border-slate-400 mx-6" />
                <div className="text-slate-500 text-[11px]">
                  (......................................................)<br />
                  เลขานุการ คปอ. / ผู้สำรวจ
                </div>
              </div>

              <div className="space-y-8" style={{ flex: '1 1 0%', width: '31%', boxSizing: 'border-box' }}>
                <div className="text-slate-600 font-medium">ลงชื่อเจ้าหน้าที่ความปลอดภัย (จป.)</div>
                <div className="border-b border-dashed border-slate-400 mx-6" />
                <div className="text-slate-500 text-[11px]">
                  (......................................................)<br />
                  จป.วิชาชีพ / ผู้ควบคุมงาน
                </div>
              </div>

              <div className="space-y-8" style={{ flex: '1 1 0%', width: '31%', boxSizing: 'border-box' }}>
                <div className="text-slate-600 font-medium">ลงชื่อประธานคณะกรรมการ คปอ.</div>
                <div className="border-b border-dashed border-slate-400 mx-6" />
                <div className="text-slate-500 text-[11px]">
                  (......................................................)<br />
                  ประธาน คปอ. / ผู้จัดการโรงงาน
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-slate-100 text-[10px] text-slate-400 break-inside-avoid">
              เอกสารนี้สร้างขึ้นโดยอัตโนมัติผ่านระบบ SHE SYSTEM สำหรับคณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน (คปอ.)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

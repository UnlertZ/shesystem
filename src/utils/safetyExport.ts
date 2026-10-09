import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { SafetyPatrolRound, SafetyFinding } from '../types';
import { formatThaiDate, getNowThai } from './thaiDate';

export const getFindingStatusText = (status: SafetyFinding['status']): string => {
  switch (status) {
    case 'PENDING_ACTION':
      return 'รอดำเนินการแก้ไข';
    case 'PENDING_REVIEW':
      return 'ส่งผลแก้ไขแล้ว (รอแอดมินตรวจ)';
    case 'APPROVED':
      return 'ผ่าน (แก้ไขสำเร็จ)';
    case 'REJECTED':
      return 'ไม่ผ่าน (ส่งกลับไปแก้ใหม่)';
    case 'COMMENDED':
      return 'เรื่องที่ชมเชย';
    default:
      return status || '-';
  }
};

export const getSubtypeText = (subType?: string): string => {
  switch (subType) {
    case 'NEAR_MISS':
      return 'เกือบเกิดอุบัติเหตุ (Near Miss)';
    case 'ACCIDENT':
      return 'เกิดอุบัติเหตุ (Accident)';
    case 'UNSAFE_CONDITION':
      return 'สภาพที่ไม่ปลอดภัย (Unsafe Condition)';
    case 'UNSAFE_ACT':
      return 'การกระทำที่ไม่ปลอดภัย (Unsafe Act)';
    default:
      return subType || '-';
  }
};

/**
 * Export Safety Patrol Findings and Round Info to Excel (.xlsx)
 */
export function exportSafetyPatrolToExcel(
  allPatrols: SafetyPatrolRound[],
  allFindings: SafetyFinding[],
  selectedPatrolId?: string
) {
  const wb = XLSX.utils.book_new();

  // Filter patrols according to selected ID (or all)
  const targetPatrols = selectedPatrolId && selectedPatrolId !== 'ALL'
    ? allPatrols.filter(p => p.id === selectedPatrolId)
    : allPatrols;

  const targetPatrolIds = new Set(targetPatrols.map(p => p.id));
  const targetFindings = allFindings.filter(f => targetPatrolIds.has(f.patrol_id));

  const patrolMap = new Map(allPatrols.map(p => [p.id, p]));

  // Sheet 1: Patrol Rounds Summary (สรุปรายการเดินตรวจ คปอ.)
  const patrolSummaryData = targetPatrols.map((p, idx) => {
    const pFindings = targetFindings.filter(f => f.patrol_id === p.id);
    const recommendCount = pFindings.filter(f => f.category === 'RECOMMEND').length;
    const commendCount = pFindings.filter(f => f.category === 'COMMEND').length;
    const approvedCount = pFindings.filter(f => f.status === 'APPROVED').length;
    const pendingActionCount = pFindings.filter(f => f.status === 'PENDING_ACTION').length;
    const pendingReviewCount = pFindings.filter(f => f.status === 'PENDING_REVIEW').length;
    const rejectedCount = pFindings.filter(f => f.status === 'REJECTED').length;

    return {
      'ลำดับ': idx + 1,
      'รหัสรอบเดินตรวจ': p.id,
      'วันที่เดินตรวจ': p.patrol_date,
      'ช่วงเวลา': p.time_range,
      'หัวข้อการเดินตรวจ': p.title,
      'พื้นที่/โซนที่เดินตรวจ': p.location || 'ทั่วทั้งโรงงาน',
      'สถานะรอบตรวจ': p.status === 'OPEN' ? 'เปิดรับข้อมูล (Active)' : 'ปิดรอบตรวจแล้ว (Closed)',
      'ผู้สร้างรอบตรวจ': p.created_by_name,
      'จำนวนข้อแนะนำ/จุดเสี่ยง': recommendCount,
      'จำนวนเรื่องที่ชมเชย': commendCount,
      'รวมรายการตรวจพบ': pFindings.length,
      'รอดำเนินการแก้ไข': pendingActionCount,
      'รอแอดมินตรวจสอบ': pendingReviewCount,
      'แก้ไขสำเร็จ (ผ่าน)': approvedCount,
      'ส่งกลับไปแก้ใหม่': rejectedCount,
      'อัตราการแก้ไขเสร็จสิ้น': recommendCount > 0 ? `${Math.round((approvedCount / recommendCount) * 100)}%` : '100%',
      'คำอธิบายเพิ่มเติม': p.description || '-'
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(patrolSummaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปรอบเดินตรวจ');

  // Sheet 2: Recommendations / Hazards (ข้อเสนอแนะและจุดเสี่ยง)
  const recommendFindings = targetFindings.filter(f => f.category === 'RECOMMEND');
  const recommendData = recommendFindings.map((f, idx) => {
    const p = patrolMap.get(f.patrol_id);
    return {
      'ลำดับ': idx + 1,
      'รหัสรายการ': f.id,
      'วันที่เดินตรวจ': p?.patrol_date || '-',
      'ช่วงเวลา': p?.time_range || '-',
      'รอบตรวจ': p?.title || '-',
      'จุดที่พบ': f.location,
      'ประเภทย่อย': getSubtypeText(f.sub_type),
      'รายละเอียดอันตราย/ข้อสังเกต': f.description,
      'มาตรการป้องกัน/แก้ไข': f.recommendation || '-',
      'สถานะการติดตาม': getFindingStatusText(f.status),
      'ผู้ตรวจพบ (คปอ.)': f.reporter_name,
      'วันเวลาที่บันทึก': formatThaiDate(f.created_at, true),
      'รูปภาพก่อนแก้ (URL/Base64)': f.photo_url ? (f.photo_url.startsWith('data:') ? '[แนบเป็นรูปถ่ายในระบบ]' : f.photo_url) : '-',
      'รายละเอียดการแก้ไข (Action Taken)': f.action_taken || '-',
      'ผู้ส่งงานแก้ไข': f.resolved_by_name || '-',
      'วันเวลาที่ส่งแก้ไข': f.resolved_at ? formatThaiDate(f.resolved_at, true) : '-',
      'รูปภาพหลังแก้ (URL/Base64)': f.after_photo_url ? (f.after_photo_url.startsWith('data:') ? '[แนบเป็นรูปถ่ายในระบบ]' : f.after_photo_url) : '-',
      'ผลการตรวจโดยแอดมิน': f.status === 'APPROVED' ? 'ผ่าน (อนุมัติ)' : (f.status === 'REJECTED' ? 'ไม่ผ่าน (ส่งกลับไปแก้ใหม่)' : 'รอตรวจ/ยังไม่ส่ง'),
      'ผู้ตรวจอนุมัติ (แอดมิน)': f.reviewed_by_name || '-',
      'วันเวลาที่ตรวจอนุมัติ': f.reviewed_at ? formatThaiDate(f.reviewed_at, true) : '-',
      'หมายเหตุ/เหตุผลจากแอดมิน': f.review_notes || '-'
    };
  });

  const wsRecommend = XLSX.utils.json_to_sheet(recommendData);
  XLSX.utils.book_append_sheet(wb, wsRecommend, 'ข้อเสนอแนะและจุดเสี่ยง');

  // Sheet 3: Commendations (เรื่องที่ชมเชย)
  const commendFindings = targetFindings.filter(f => f.category === 'COMMEND');
  const commendData = commendFindings.map((f, idx) => {
    const p = patrolMap.get(f.patrol_id);
    return {
      'ลำดับ': idx + 1,
      'รหัสรายการ': f.id,
      'วันที่เดินตรวจ': p?.patrol_date || '-',
      'ช่วงเวลา': p?.time_range || '-',
      'รอบตรวจ': p?.title || '-',
      'จุดที่พบ': f.location,
      'รายละเอียดการชมเชย/แบบอย่างที่ดี': f.description,
      'ผู้รายงาน (คปอ.)': f.reporter_name,
      'วันเวลาที่บันทึก': formatThaiDate(f.created_at, true),
      'รูปภาพชมเชย (URL/Base64)': f.photo_url ? (f.photo_url.startsWith('data:') ? '[แนบเป็นรูปถ่ายในระบบ]' : f.photo_url) : '-'
    };
  });

  const wsCommend = XLSX.utils.json_to_sheet(commendData);
  XLSX.utils.book_append_sheet(wb, wsCommend, 'เรื่องที่ชมเชย');

  // Sheet 4: Before & After Tracking (ติดตามแก้ไขปัญหา Before-After)
  const beforeAfterData = recommendFindings.map((f, idx) => {
    const p = patrolMap.get(f.patrol_id);
    return {
      'ลำดับ': idx + 1,
      'วันที่เดินตรวจ': p?.patrol_date || '-',
      'จุดที่พบ': f.location,
      'ประเภทย่อย': getSubtypeText(f.sub_type),
      'ปัญหา/ความเสี่ยง (Before)': f.description,
      'มาตรการป้องกันที่แนะนำ': f.recommendation || '-',
      'สถานะการแก้ไข': getFindingStatusText(f.status),
      'การปฏิบัติการแก้ไขจริง (After)': f.action_taken || 'ยังไม่มีการส่งผลแก้ไข',
      'ผู้ดำเนินการแก้ไข': f.resolved_by_name || '-',
      'วันเวลาที่แก้ไข': f.resolved_at ? formatThaiDate(f.resolved_at, true) : '-',
      'ผลการตรวจเช็ค': f.status === 'APPROVED' ? 'ผ่าน (เรียบร้อย)' : (f.status === 'REJECTED' ? 'ไม่ผ่าน (ส่งกลับไปแก้ใหม่)' : 'รอแอดมินตรวจสอบ'),
      'ผู้ตรวจเช็ค (แอดมิน)': f.reviewed_by_name || '-',
      'ข้อคิดเห็นจากแอดมิน': f.review_notes || '-'
    };
  });

  const wsBeforeAfter = XLSX.utils.json_to_sheet(beforeAfterData);
  XLSX.utils.book_append_sheet(wb, wsBeforeAfter, 'ติดตาม Before-After');

  // Generate filename
  let filename = 'SHE_Safety_Patrol_Report_All.xlsx';
  if (targetPatrols.length === 1) {
    const single = targetPatrols[0];
    const safeDate = single.patrol_date.replace(/[^0-9a-zA-Z-]/g, '_');
    filename = `SHE_Safety_Patrol_${safeDate}.xlsx`;
  }

  XLSX.writeFile(wb, filename);
}

/**
 * Export all photos in selected patrol(s) to a ZIP file
 */
export async function exportSafetyPatrolPhotos(
  allPatrols: SafetyPatrolRound[],
  allFindings: SafetyFinding[],
  selectedPatrolId?: string
) {
  const zip = new JSZip();
  const folder = zip.folder('SHE_Safety_Patrol_Photos');

  const targetPatrols = selectedPatrolId && selectedPatrolId !== 'ALL'
    ? allPatrols.filter(p => p.id === selectedPatrolId)
    : allPatrols;

  const targetPatrolIds = new Set(targetPatrols.map(p => p.id));
  const targetFindings = allFindings.filter(f => targetPatrolIds.has(f.patrol_id));
  const patrolMap = new Map(allPatrols.map(p => [p.id, p]));

  let count = 0;
  const readmeLines: string[] = ['รายการรูปภาพการเดินตรวจความปลอดภัย คปอ.:\n'];

  for (const item of targetFindings) {
    const patrol = patrolMap.get(item.patrol_id);
    const dateStr = patrol?.patrol_date ? patrol.patrol_date.replace(/[\/\\:]/g, '-') : 'date';
    const locStr = item.location ? item.location.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 20) : 'loc';
    const categoryStr = item.category === 'RECOMMEND' ? 'recommend' : 'commend';

    // 1. Finding Photo (Before photo)
    if (item.photo_url) {
      if (item.photo_url.startsWith('data:image')) {
        const base64Data = item.photo_url.split(',')[1];
        const ext = item.photo_url.includes('image/png') ? 'png' : 'jpg';
        folder?.file(`${dateStr}_${locStr}_${categoryStr}_before_${item.id.substring(0, 6)}.${ext}`, base64Data, { base64: true });
        count++;
      } else {
        // Try to fetch remote URL as blob
        try {
          const resp = await fetch(item.photo_url);
          if (resp.ok) {
            const blob = await resp.blob();
            folder?.file(`${dateStr}_${locStr}_${categoryStr}_before_${item.id.substring(0, 6)}.jpg`, blob);
            count++;
          } else {
            readmeLines.push(`- ก่อนแก้ไข (${item.location}): ${item.photo_url}`);
          }
        } catch (_) {
          readmeLines.push(`- ก่อนแก้ไข (${item.location}): ${item.photo_url}`);
        }
      }
    }

    // 2. After Photo (Resolution photo)
    if (item.after_photo_url) {
      if (item.after_photo_url.startsWith('data:image')) {
        const base64Data = item.after_photo_url.split(',')[1];
        const ext = item.after_photo_url.includes('image/png') ? 'png' : 'jpg';
        folder?.file(`${dateStr}_${locStr}_after_${item.id.substring(0, 6)}.${ext}`, base64Data, { base64: true });
        count++;
      } else {
        try {
          const resp = await fetch(item.after_photo_url);
          if (resp.ok) {
            const blob = await resp.blob();
            folder?.file(`${dateStr}_${locStr}_after_${item.id.substring(0, 6)}.jpg`, blob);
            count++;
          } else {
            readmeLines.push(`- หลังแก้ไข (${item.location}): ${item.after_photo_url}`);
          }
        } catch (_) {
          readmeLines.push(`- หลังแก้ไข (${item.location}): ${item.after_photo_url}`);
        }
      }
    }
  }

  if (readmeLines.length > 1) {
    folder?.file('photo_links.txt', readmeLines.join('\n'));
  }

  const zipContent = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(zipContent);
  const a = document.createElement('a');
  a.href = url;

  let zipName = 'SHE_Safety_Patrol_Photos_All.zip';
  if (targetPatrols.length === 1) {
    const single = targetPatrols[0];
    const safeDate = single.patrol_date.replace(/[^0-9a-zA-Z-]/g, '_');
    zipName = `SHE_Photos_Patrol_${safeDate}.zip`;
  }

  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

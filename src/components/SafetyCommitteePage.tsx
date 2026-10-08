import React from 'react';
import { Calendar, Users, ShieldCheck, FileText, CheckCircle2, Sparkles, Clock } from 'lucide-react';

export const SafetyCommitteePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Coming Soon Hero Card */}
      <div className="bg-linear-to-br from-slate-900 via-slate-800 to-red-950 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Clock className="w-3.5 h-3.5" />
            <span>Coming Soon - เร็วๆ นี้</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Safety Committee (คปอ.)
          </h1>

          <p className="mt-3 text-slate-300 text-sm leading-relaxed">
            ระบบบริหารจัดการงานคณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน (คปอ.)
            หน้านี้ถูกจัดเตรียมโครงสร้างไว้ล่วงหน้าเพื่อรองรับการขยายฟีเจอร์ในอนาคต
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center space-x-2 border border-white/10">
              <Users className="w-4 h-4 text-amber-400" />
              <span>รายชื่อคณะกรรมการ คปอ.</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center space-x-2 border border-white/10">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>ตารางนัดหมายประชุมประจำเดือน</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center space-x-2 border border-white/10">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>รายงานการตรวจประเมิน Safety Patrol</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
            01
          </div>
          <h3 className="font-bold text-sm text-slate-800">ระบบบันทึกรายงานการประชุม คปอ.</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            จัดเก็บวาระการประชุม มติที่ประชุม และติดตามผลการดำเนินงานด้านความปลอดภัยย้อนหลัง
          </p>
          <span className="inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
            รอการพัฒนา
          </span>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
            02
          </div>
          <h3 className="font-bold text-sm text-slate-800">Safety Walk & Patrol</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            แผนการเดินตรวจพื้นที่โรงงานและสำนักงาน พร้อมแบบฟอร์มบันทึกจุดเสี่ยงอันตราย (Near Miss)
          </p>
          <span className="inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
            รอการพัฒนา
          </span>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            03
          </div>
          <h3 className="font-bold text-sm text-slate-800">SHE Training & Activity Tracker</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            การอบรมดับเพลิงขั้นต้น การซ้อมอพยพหนีไฟประจำปี และบันทึกชั่วโมงการทำงานปลอดภัย (Man-Hours)
          </p>
          <span className="inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
            รอการพัฒนา
          </span>
        </div>
      </div>
    </div>
  );
};

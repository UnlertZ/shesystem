import React, { useState } from 'react';
import { UserPlus, ShieldAlert, ArrowLeft, CheckCircle2, AlertCircle, Building2, Lock, User as UserIcon } from 'lucide-react';
import { storageService } from '../services/storage';
import { DepartmentItem, PositionItem, UserRole } from '../types';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [departments] = useState<DepartmentItem[]>(() => storageService.getDepartments());
  const [positions] = useState<PositionItem[]>(() => storageService.getPositions());

  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    () => departments[0]?.name || 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)'
  );
  const [selectedPosition, setSelectedPosition] = useState<string>(
    () => positions[0]?.name || 'พนักงาน'
  );

  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    // Check if username already exists
    const users = storageService.getUsers();
    if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
      setErrorMsg('ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      return;
    }

    try {
      await storageService.registerUser({
        username: username.trim(),
        password: password.trim(),
        department: selectedDepartment,
        position: selectedPosition
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-red-600 to-amber-500"></div>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-red-100">
              <UserPlus className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">สมัครสมาชิก SHE System</h2>
            <p className="text-xs text-slate-500 mt-1">ระบบตรวจสอบความปลอดภัยและอุปกรณ์ดับเพลิง</p>
          </div>

          {isSuccess ? (
            <div className="text-center space-y-4 py-4 animate-in fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">ลงทะเบียนเรียบร้อยแล้ว</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed px-4">
                  เมื่อสมัครสมาชิกแล้ว <span className="font-semibold text-red-600">ต้องรอแอดมินอนุมัติ</span> ก่อนจึงจะสามารถเข้าสู่ระบบและใช้งานได้
                </p>
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-red-200"
                >
                  กลับสู่หน้าเข้าสู่ระบบ
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="เช่น user01, somchai"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  แผนก (Department)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {departments.map((dep) => (
                      <option key={dep.id} value={dep.name}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ระดับ / ตำแหน่ง (Position)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.name}>
                        {pos.name} ({pos.default_role})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  * เมื่อสมัครสมาชิกแล้ว ต้องรอแอดมินหรือผู้จัดการระบบอนุมัติก่อนเริ่มใช้งาน
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กำหนดรหัสผ่าน"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ยืนยันรหัสผ่าน (Confirm Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-red-200 transition"
                >
                  ลงทะเบียนสมัครสมาชิก
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  กลับสู่หน้าเข้าสู่ระบบ
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ShieldAlert, User, Lock, Eye, EyeOff, UserCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { storageService } from '../services/storage';
import { User as UserType } from '../types';
import { SheLogo } from './SheLogo';

interface LoginPageProps {
  onLoginSuccess: (user: UserType) => void;
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const result = storageService.verifyLogin(username, password);

      if (result.error || !result.user) {
        setErrorMsg(result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setIsLoading(false);
        return;
      }

      storageService.setCurrentUser(result.user);
      onLoginSuccess(result.user);
      setIsLoading(false);
    }, 300);
  };

  const handleGuestLogin = () => {
    const guestUser: UserType = {
      id: 'guest_' + Date.now(),
      username: 'ผู้เยี่ยมชม (Guest)',
      department: 'แผนกทั่วไป',
      position: 'ผู้เยี่ยมชม (Guest)',
      role: 'GUEST',
      status: 'approved',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      created_at: new Date().toISOString()
    };
    storageService.setCurrentUser(guestUser);
    onLoginSuccess(guestUser);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;

    storageService.requestPasswordReset(forgotUsername.trim());
    setForgotSubmitted(true);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card Container */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10 relative overflow-hidden">
          {/* Subtle top decoration */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-red-600 via-orange-500 to-amber-500"></div>

          {/* Header & Logo */}
          <div className="flex flex-col items-center justify-center text-center mb-8">
            <div className="mb-4">
              <SheLogo size="lg" showSubtext={false} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">SHE SAFETY SYSTEM</h1>
            <p className="text-slate-500 text-xs mt-1">ระบบตรวจสอบความปลอดภัยและอุปกรณ์ดับเพลิง</p>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  รหัสผ่าน (Password)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotSubmitted(false);
                    setForgotUsername(username);
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-red-600/25 transition disabled:opacity-50"
            >
              {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>

            {/* Visitor / Guest Button */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-400">หรือ</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition flex items-center justify-center space-x-2 border border-slate-200"
            >
              <UserCheck className="w-4 h-4 text-slate-500" />
              <span>กดเพื่อเข้าเยี่ยมชม (Guest Mode)</span>
            </button>
          </form>

          {/* Footer Link to Register */}
          <div className="mt-8 text-center text-xs text-slate-500">
            ยังไม่มีบัญชีผู้ใช้งาน?{' '}
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-red-600 font-semibold hover:underline"
            >
              สมัครสมาชิกใหม่
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 text-center">ขอรีเซ็ทรหัสผ่าน</h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-4">
              ระบบจะส่งการแจ้งเตือนไปยังแอดมิน เพื่อให้แอดมินทำการรีเซ็ทรหัสผ่านเป็น "0000" ให้แก่คุณ
            </p>

            {forgotSubmitted ? (
              <div className="text-center space-y-4">
                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-200">
                  ส่งคำขอรีเซ็ทรหัสผ่านไปยังแอดมินเรียบร้อยแล้ว กรุณารอแอดมินดำเนินการ
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้งานที่ต้องการรีเซ็ท
                  </label>
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้ของคุณ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                  >
                    ส่งแจ้งเตือนแอดมิน
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

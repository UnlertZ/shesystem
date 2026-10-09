import React, { useState } from 'react';
import { User, AppNotification } from '../types';
import { Bell, User as UserIcon, LogOut, CheckCircle2, AlertTriangle, Flame, Users, LayoutDashboard, Calendar, ShieldCheck, Trash2 } from 'lucide-react';
import { formatThaiDate } from '../utils/thaiDate';
import { SheLogo } from './SheLogo';
import { storageService } from '../services/storage';

interface NavbarProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onClearNotifications?: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  notifications,
  onMarkNotificationRead,
  onClearNotifications,
  onLogout
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter(n => !n.is_read);

  const getRoleBadge = (role?: string) => {
    const r = (role || '').toUpperCase();
    if (r === 'P4' || r.includes('P4') || r.includes('SUPER')) {
      return (
        <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs whitespace-nowrap shrink-0 inline-flex items-center">
          P4 ผู้จัดการระบบ
        </span>
      );
    }
    if (r === 'P3' || r.includes('P3') || r === 'ADMIN' || r === 'แอดมิน') {
      return (
        <span className="bg-[#A04830] text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs whitespace-nowrap shrink-0 inline-flex items-center">
          P3 แอดมิน
        </span>
      );
    }
    if (r === 'P2' || r.includes('P2')) {
      return (
        <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs whitespace-nowrap shrink-0 inline-flex items-center">
          P2 หัวหน้า/ผจก
        </span>
      );
    }
    if (r === 'P1' || r.includes('P1')) {
      return (
        <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs whitespace-nowrap shrink-0 inline-flex items-center">
          P1 พนักงาน
        </span>
      );
    }
    return (
      <span className="bg-slate-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs whitespace-nowrap shrink-0 inline-flex items-center">
        ผู้เยี่ยมชม
      </span>
    );
  };

  // Nav links with Dashboard at leftmost position as requested
  // Safety Committee function is ONLY visible if user is คปอ (Requirement 3 & 4)
  const navLinks = [
    { id: 'dashboard', label: 'แดชบอร์ด', fullLabel: 'แดชบอร์ด (Dashboard)', icon: LayoutDashboard },
    { id: 'equipment', label: 'ตรวจอุปกรณ์ดับเพลิง', fullLabel: 'ตรวจระบบอุปกรณ์ดับเพลิง', icon: Flame },
    ...(currentUser?.is_safety_committee ? [
      { id: 'safety_committee', label: 'คปอ.', fullLabel: 'Safety Committee (คปอ.)', icon: Calendar }
    ] : []),
    ...(currentUser?.role === 'P3' || currentUser?.role === 'P4' ? [
      { id: 'users', label: 'จัดการสมาชิก', fullLabel: 'จัดการสมาชิก', icon: Users }
    ] : []),
    ...(currentUser?.role !== 'GUEST' ? [
      { id: 'profile', label: 'โปรไฟล์', fullLabel: 'โปรไฟล์', icon: UserIcon }
    ] : [])
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FCF9F4]/95 backdrop-blur-md border-b border-[#E8DFC8] shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-4">
          {/* Logo & Brand - JDE Peet's */}
          <div className="cursor-pointer shrink-0 flex items-center" onClick={() => setActiveTab('dashboard')}>
            <SheLogo size="md" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-0.5 lg:space-x-1 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`flex items-center space-x-1 lg:space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#A04830] text-[#FCF9F4] font-bold shadow-xs'
                      : 'text-[#5C5951] hover:text-[#3F3A31] hover:bg-[#F7EEDC]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0 ${isActive ? 'text-[#FCF9F4]' : 'text-[#8C7454]'}`} />
                  <span className="hidden xl:inline">{link.fullLabel || link.label}</span>
                  <span className="inline xl:hidden">{link.label}</span>
                  {link.badge && (
                    <span className="text-[10px] bg-[#E8D5B0] text-[#3F3A31] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons & User Badge */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Notification Bell (Hidden for Guest users) */}
            {currentUser && currentUser.role !== 'GUEST' && !currentUser.id.startsWith('guest') && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 text-[#5C5951] hover:text-[#A04830] hover:bg-[#F7EEDC] rounded-xl transition shrink-0"
                title="การแจ้งเตือน"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#A04830] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800">กล่องแจ้งเตือน ({notifications.length})</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-red-600 font-semibold">ยังไม่อ่าน {unreadNotifs.length}</span>
                      {notifications.length > 0 && onClearNotifications && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('คุณต้องการล้างการแจ้งเตือนทั้งหมดใช่หรือไม่?')) {
                              onClearNotifications();
                            }
                          }}
                          className="text-[11px] text-slate-400 hover:text-red-600 underline font-medium"
                        >
                          ล้างทั้งหมด
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">ไม่มีการแจ้งเตือน</div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`p-3 text-left hover:bg-slate-50 transition cursor-pointer ${!n.is_read ? 'bg-red-50/50' : ''}`}
                        >
                          <div className="flex items-start space-x-2.5">
                            {n.type === 'DEFECT' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            ) : n.type === 'TASK' ? (
                              <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            ) : (
                              <Bell className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                  {n.title}
                                </span>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <span className="text-[10px] text-slate-400">
                                    {formatThaiDate(n.created_at, true, true)}
                                  </span>
                                  {currentUser && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        storageService.clearNotifications(currentUser.id, n.id);
                                      }}
                                      className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                      title="ลบรายการนี้"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 text-center">
                    <button
                      onClick={() => {
                        setShowNotifMenu(false);
                        setActiveTab('profile');
                      }}
                      className="text-xs text-red-600 font-bold hover:underline"
                    >
                      ดูทั้งหมดในหน้าโปรไฟล์ &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* User Profile Pill & Logout */}
            {currentUser ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 shrink-0">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center space-x-2 text-left hover:opacity-85 transition shrink-0"
                >
                  <img
                    src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={currentUser.username}
                    className="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0"
                  />
                  <div className="hidden lg:block text-left min-w-0 max-w-[150px] lg:max-w-[200px]">
                    <div className="flex items-center space-x-1.5 flex-nowrap">
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[70px] lg:max-w-[90px] shrink-0" title={currentUser.username}>
                        {currentUser.username}
                      </span>
                      {getRoleBadge(currentUser.role)}
                      {currentUser.is_safety_committee && (
                        <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold inline-flex items-center space-x-0.5 shadow-2xs whitespace-nowrap shrink-0">
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          <span>คปอ.</span>
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[10px] text-black font-semibold truncate block leading-tight mt-0.5"
                      title={currentUser.department}
                    >
                      {currentUser.department}
                    </span>
                  </div>
                </button>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition shrink-0"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className="bg-[#A04830] hover:bg-[#803A26] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-[#E8DFC8] bg-[#FCF9F4] overflow-x-auto text-xs">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`flex flex-col items-center py-1 px-2 transition ${
                  isActive ? 'text-[#A04830] font-bold' : 'text-black hover:text-[#A04830]'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-[#A04830]' : 'text-black'}`} />
                <span className={`text-[10px] whitespace-nowrap font-bold ${isActive ? 'text-[#A04830]' : 'text-black'}`}>{link.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

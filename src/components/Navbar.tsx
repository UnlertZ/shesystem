import React, { useState } from 'react';
import { User, AppNotification } from '../types';
import { ShieldAlert, Bell, User as UserIcon, LogOut, CheckCircle2, AlertTriangle, Flame, Users, LayoutDashboard, Calendar, RefreshCw } from 'lucide-react';
import { formatThaiDate } from '../utils/thaiDate';

interface NavbarProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onLogout: () => void;
  onSwitchUserRole?: (role: User['role']) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  notifications,
  onMarkNotificationRead,
  onLogout,
  onSwitchUserRole
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter(n => !n.is_read);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'P4':
        return <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">P4 ผู้จัดการระบบ</span>;
      case 'P3':
        return <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">P3 แอดมิน</span>;
      case 'P2':
        return <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">P2 หัวหน้า/ผจก</span>;
      case 'P1':
        return <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">P1 พนักงาน</span>;
      default:
        return <span className="bg-slate-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">ผู้เยี่ยมชม (Guest)</span>;
    }
  };

  const navLinks = [
    { id: 'equipment', label: 'ตรวจระบบอุปกรณ์ดับเพลิง', icon: Flame },
    { id: 'dashboard', label: 'แดชบอร์ด (Dashboard)', icon: LayoutDashboard },
    { id: 'safety_committee', label: 'Safety Committee', icon: Calendar, badge: 'Soon' },
    ...(currentUser?.role === 'P3' || currentUser?.role === 'P4' ? [
      { id: 'users', label: 'จัดการสมาชิก', icon: Users }
    ] : []),
    ...(currentUser?.role !== 'GUEST' ? [
      { id: 'profile', label: 'โปรไฟล์', icon: UserIcon }
    ] : [])
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('equipment')}>
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-red-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-800 tracking-tight">SHE SYSTEM</span>
                <span className="text-[10px] bg-red-100 text-red-700 font-semibold px-1.5 py-0.5 rounded">SAFETY</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">ระบบตรวจสอบความปลอดภัยและอุปกรณ์ดับเพลิง</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-red-50 text-red-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons & User Badge */}
          <div className="flex items-center space-x-3">
            {/* Quick Role Switcher for Testing/Demonstration */}
            {currentUser && onSwitchUserRole && (
              <div className="hidden lg:flex items-center text-xs space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <span className="text-slate-400 px-1 font-medium">สลับสิทธิ์:</span>
                {(['P1', 'P2', 'P3', 'P4'] as User['role'][]).map(r => (
                  <button
                    key={r}
                    onClick={() => onSwitchUserRole(r)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                      currentUser.role === r ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg transition"
                title="การแจ้งเตือน"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">กล่องแจ้งเตือน ({notifications.length})</span>
                    <span className="text-xs text-red-600 font-medium">ยังไม่อ่าน {unreadNotifs.length}</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">ไม่มีการแจ้งเตือน</div>
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
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatThaiDate(n.created_at, true, true)}
                                </span>
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
                      className="text-xs text-red-600 font-semibold hover:underline"
                    >
                      ดูทั้งหมดในหน้าโปรไฟล์ &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill & Logout */}
            {currentUser ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center space-x-2 text-left hover:opacity-85 transition"
                >
                  <img
                    src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={currentUser.username}
                    className="w-8 h-8 rounded-full object-cover border border-slate-300"
                  />
                  <div className="hidden sm:block text-left">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-slate-800">{currentUser.username}</span>
                      {getRoleBadge(currentUser.role)}
                    </div>
                    <span className="text-[10px] text-slate-500">{currentUser.department}</span>
                  </div>
                </button>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 overflow-x-auto text-xs">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`flex flex-col items-center py-1 px-2 ${
                  isActive ? 'text-red-600 font-bold' : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[10px] whitespace-nowrap">{link.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

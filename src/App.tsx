import React, { useState, useEffect } from 'react';
import { User, Equipment, Task, AppNotification } from './types';
import { storageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { EquipmentInspectionPage } from './components/EquipmentInspectionPage';
import { DashboardPage } from './components/DashboardPage';
import { SafetyCommitteePage } from './components/SafetyCommitteePage';
import { UserManagementPage } from './components/UserManagementPage';
import { ProfilePage } from './components/ProfilePage';
import { InspectionModal } from './components/InspectionModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => storageService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Shared state for notifications & tasks
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    currentUser ? storageService.getNotifications(currentUser.id, currentUser.role) : []
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    currentUser ? storageService.getTasks(currentUser.id) : []
  );

  // Directly inspecting from assigned task shortcut
  const [directInspectModal, setDirectInspectModal] = useState<{
    equipment: Equipment;
    task: Task;
  } | null>(null);

  const refreshUserData = () => {
    if (currentUser) {
      setNotifications(storageService.getNotifications(currentUser.id, currentUser.role));
      setTasks(storageService.getTasks(currentUser.id));
    }
  };

  useEffect(() => {
    refreshUserData();

    const handleSync = () => {
      refreshUserData();
    };
    window.addEventListener('she_data_synced', handleSync);
    return () => window.removeEventListener('she_data_synced', handleSync);
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    setNotifications(storageService.getNotifications(user.id, user.role));
    setTasks(storageService.getTasks(user.id));
  };

  const handleLogout = () => {
    storageService.setCurrentUser(null);
    setCurrentUser(null);
    setAuthView('LOGIN');
  };

  const handleMarkNotificationRead = (id: string) => {
    storageService.markNotificationAsRead(id);
    if (currentUser) {
      setNotifications(storageService.getNotifications(currentUser.id, currentUser.role));
    }
  };

  // If user is not logged in, enforce login page as first screen
  if (!currentUser) {
    if (authView === 'REGISTER') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
          <RegisterPage onGoToLogin={() => setAuthView('LOGIN')} />
          <footer className="py-4 text-center text-xs text-slate-400">
            SHE System &bull; ระบบบริหารความปลอดภัยและตรวจเช็คอุปกรณ์
          </footer>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onGoToRegister={() => setAuthView('REGISTER')}
        />
        <footer className="py-4 text-center text-xs text-slate-400">
          SHE System &bull; ระบบบริหารความปลอดภัยและตรวจเช็คอุปกรณ์
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        {/* Navigation Bar */}
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onLogout={handleLogout}
        />

        {/* Main Views */}
        <main className="pb-12">
          {activeTab === 'equipment' && (
            <EquipmentInspectionPage
              currentUser={currentUser}
              tasks={tasks}
              onRefreshTasks={refreshUserData}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage
              currentUser={currentUser}
              onRefreshData={refreshUserData}
            />
          )}

          {activeTab === 'safety_committee' && (
            <SafetyCommitteePage />
          )}

          {activeTab === 'users' && (currentUser.role === 'P3' || currentUser.role === 'P4') && (
            <UserManagementPage
              currentUser={currentUser}
              onRefreshData={refreshUserData}
            />
          )}

          {activeTab === 'profile' && (
            <ProfilePage
              currentUser={currentUser}
              onUpdateCurrentUser={setCurrentUser}
              onInspectAssignedEquipment={(equipment, task) => {
                setDirectInspectModal({ equipment, task });
              }}
            />
          )}
        </main>
      </div>

      {/* Direct Inspection Modal launched from Profile Assigned Task */}
      {directInspectModal && (
        <InspectionModal
          equipment={directInspectModal.equipment}
          currentUser={currentUser}
          assignedTask={directInspectModal.task}
          onClose={() => setDirectInspectModal(null)}
          onInspectionComplete={() => {
            setDirectInspectModal(null);
            refreshUserData();
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">SHE SYSTEM</span>
            <span>&bull; Safety & Fire Inspection</span>
          </div>
          <div className="text-slate-400">
            ระบบบริหารจัดการความปลอดภัย อาชีวอนามัย และสิ่งแวดล้อม
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

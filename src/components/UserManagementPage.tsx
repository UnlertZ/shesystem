import React, { useState } from 'react';
import { User, UserDepartment, UserRole } from '../types';
import { storageService } from '../services/storage';
import {
  Users,
  UserCheck,
  UserX,
  KeyRound,
  Shield,
  ArrowUpRight,
  Send,
  Trash2,
  Edit,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Mail,
  Building2
} from 'lucide-react';
import { formatThaiDate } from '../utils/thaiDate';

interface UserManagementPageProps {
  currentUser: User | null;
  onRefreshData?: () => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ currentUser, onRefreshData }) => {
  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'PENDING_APPROVALS'>('MEMBERS');

  // Modals state
  const [sendNotifUser, setSendNotifUser] = useState<User | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDepartment, setEditDepartment] = useState<UserDepartment>('พนักงาน');
  const [editRole, setEditRole] = useState<UserRole>('P1');

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newDepartment, setNewDepartment] = useState<UserDepartment>('พนักงาน');
  const [newRole, setNewRole] = useState<UserRole>('P1');

  const [alertBanner, setAlertBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refreshList = () => {
    setUsers(storageService.getUsers());
    if (onRefreshData) onRefreshData();
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');

  // 1. Approve / Reject Registration
  const handleApproveUser = (user: User, approve: boolean) => {
    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          status: approve ? ('approved' as const) : ('rejected' as const)
        };
      }
      return u;
    });

    storageService.saveUsers(updatedUsers);
    refreshList();

    // Send notification to user
    storageService.sendNotification({
      recipient_user_id: user.id,
      target_role: undefined,
      sender_name: currentUser?.username || 'แอดมิน',
      title: approve ? 'บัญชีของคุณได้รับการอนุมัติแล้ว' : 'บัญชีของคุณไม่ได้รับการอนุมัติ',
      message: approve ? 'คุณสามารถเข้าสู่ระบบและเริ่มใช้งาน SHE System ได้ทันที' : 'ขออภัย บัญชีของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อแอดมิน',
      type: 'SYSTEM'
    });

    setAlertBanner({
      type: 'success',
      message: `${approve ? 'อนุมัติ' : 'ปฏิเสธ'}การสมัครของ ${user.username} เรียบร้อยแล้ว`
    });
  };

  // 2. Promote P1 to P2
  const handlePromoteP1ToP2 = (user: User) => {
    if (user.role !== 'P1') return;
    if (!confirm(`ยืนยันการเลื่อนระดับสิทธิ์ของ ${user.username} จาก P1 (พนักงาน) เป็น P2 (หัวหน้างาน)?\n\nเมื่อเป็น P2 จะสามารถตรวจเช็คอุปกรณ์ได้โดยไม่ต้องขออนุญาต และสามารถมอบหมายงานให้ P1 ได้`)) return;

    const updated = users.map(u => u.id === user.id ? { ...u, role: 'P2' as UserRole } : u);
    storageService.saveUsers(updated);
    refreshList();

    // Notification to user
    storageService.sendNotification({
      recipient_user_id: user.id,
      sender_name: currentUser?.username || 'แอดมิน',
      title: 'คุณได้รับการปรับระดับสิทธิ์เป็น P2',
      message: 'ยินดีด้วย คุณได้รับการเลื่อนสิทธิ์เป็น P2 (สามารถตรวจเช็คอุปกรณ์ได้โดยตรง และมอบหมายงานให้พนักงาน P1 ได้)',
      type: 'SYSTEM'
    });

    setAlertBanner({ type: 'success', message: `เลื่อนระดับ ${user.username} เป็น P2 เรียบร้อยแล้ว` });
  };

  // 3. Reset Password to "0000" as requested
  const handleResetPassword = (user: User) => {
    if (!confirm(`คุณต้องการรีเซ็ทรหัสผ่านของ ${user.username} เป็น "0000" ใช่หรือไม่?`)) return;

    // Reset password in storage
    const updated = users.map(u => u.id === user.id ? { ...u, password: '0000' } : u);
    storageService.saveUsers(updated);
    refreshList();

    // Send notification
    storageService.sendNotification({
      recipient_user_id: user.id,
      sender_name: currentUser?.username || 'แอดมิน',
      title: 'รหัสผ่านของคุณถูกรีเซ็ทเรียบร้อยแล้ว',
      message: 'แอดมินได้ทำการรีเซ็ทรหัสผ่านของคุณเป็น "0000" กรุณาเข้าสู่ระบบและเปลี่ยนรหัสผ่านใหม่',
      type: 'PASSWORD_RESET'
    });

    setAlertBanner({ type: 'success', message: `รีเซ็ทรหัสผ่านของ ${user.username} เป็น "0000" เรียบร้อยแล้ว` });
  };

  // 4. Edit Department and Role
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updated = users.map(u => {
      if (u.id === editingUser.id) {
        return {
          ...u,
          department: editDepartment,
          role: editRole
        };
      }
      return u;
    });

    storageService.saveUsers(updated);
    setEditingUser(null);
    refreshList();
    setAlertBanner({ type: 'success', message: `แก้ไขข้อมูลของ ${editingUser.username} เรียบร้อยแล้ว` });
  };

  // 5. Send Notification Message to Selected User
  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendNotifUser || !notifTitle.trim() || !notifMessage.trim()) return;

    storageService.sendNotification({
      recipient_user_id: sendNotifUser.id,
      target_role: undefined,
      sender_name: currentUser?.username || 'แอดมิน',
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      type: 'ALERT'
    });

    setSendNotifUser(null);
    setNotifTitle('');
    setNotifMessage('');
    setAlertBanner({ type: 'success', message: `ส่งข้อความแจ้งเตือนไปยัง ${sendNotifUser.username} เรียบร้อยแล้ว` });
  };

  // 6. Delete Employee
  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      alert('ไม่สามารถลบบัญชีของตัวเองได้');
      return;
    }
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบผู้ใช้ ${user.username} ออกจากระบบ?`)) return;

    const updated = users.filter(u => u.id !== user.id);
    storageService.saveUsers(updated);
    refreshList();
    setAlertBanner({ type: 'success', message: `ลบผู้ใช้ ${user.username} เรียบร้อยแล้ว` });
  };

  // 7. Add Employee directly
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    if (users.some(u => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      alert('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว');
      return;
    }

    const newUser: User = {
      id: `u_${Date.now()}`,
      username: newUsername.trim(),
      department: newDepartment,
      role: newRole,
      status: 'approved',
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newUsername)}`,
      created_at: new Date().toISOString()
    };

    const updated = [...users, newUser];
    storageService.saveUsers(updated);
    setIsAddUserModalOpen(false);
    setNewUsername('');
    refreshList();
    setAlertBanner({ type: 'success', message: `เพิ่มพนักงาน ${newUser.username} เรียบร้อยแล้ว` });
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'P4':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">P4 ผู้จัดการระบบ</span>;
      case 'P3':
        return <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">P3 แอดมิน</span>;
      case 'P2':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">P2 หัวหน้า/ผจก</span>;
      case 'P1':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">P1 พนักงาน</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Guest</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Users className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">จัดการสมาชิกและกำหนดสิทธิ์ (Admin & Manager)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            แบ่งสิทธิ์การใช้งาน P1 (พนักงาน), P2 (หัวหน้างาน/ผู้จัดการ), P3 (แอดมิน), P4 (ผู้จัดการระบบ)
          </p>
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-200 transition flex items-center space-x-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มพนักงานใหม่</span>
        </button>
      </div>

      {/* Alert Banner */}
      {alertBanner && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in ${
          alertBanner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            {alertBanner.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{alertBanner.message}</span>
          </div>
          <button onClick={() => setAlertBanner(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 ${
            activeTab === 'MEMBERS'
              ? 'border-b-2 border-red-600 text-red-600 bg-red-50/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span>สมาชิกทั้งหมด</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full">
            {approvedUsers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PENDING_APPROVALS')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition flex items-center space-x-2 ${
            activeTab === 'PENDING_APPROVALS'
              ? 'border-b-2 border-red-600 text-red-600 bg-red-50/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span>รอแอดมินอนุมัติ</span>
          {pendingUsers.length > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'PENDING_APPROVALS' ? (
        /* Pending Approvals Table */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700">รายการสมาชิกลงทะเบียนที่รอการอนุมัติ ({pendingUsers.length})</span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              ไม่มีสมาชิกรอการอนุมัติในขณะนี้
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingUsers.map(user => (
                <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition">
                  <div className="flex items-center space-x-3">
                    <img
                      src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800">{user.username}</div>
                      <div className="text-xs text-slate-500">
                        แผนก: <span className="font-semibold text-slate-700">{user.department}</span> | ลงทะเบียนเมื่อ: {formatThaiDate(user.created_at, true)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleApproveUser(user, true)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>อนุมัติการใช้งาน</span>
                    </button>
                    <button
                      onClick={() => handleApproveUser(user, false)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>ปฏิเสธ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Approved Members List */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">ชื่อผู้ใช้ (Username)</th>
                  <th className="py-3.5 px-4">แผนก / ตำแหน่ง (Department)</th>
                  <th className="py-3.5 px-4">ระดับสิทธิ์ (Role)</th>
                  <th className="py-3.5 px-4">วันที่ลงทะเบียน</th>
                  <th className="py-3.5 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center space-x-2.5">
                      <img
                        src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                        alt={user.username}
                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                      />
                      <span>{user.username}</span>
                      {user.id === currentUser?.id && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">คุณ</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {user.department}
                    </td>

                    <td className="py-3.5 px-4">
                      {getRoleBadge(user.role)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {formatThaiDate(user.created_at)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Promote P1 to P2 button */}
                        {user.role === 'P1' && (
                          <button
                            onClick={() => handlePromoteP1ToP2(user)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold border border-blue-200 transition flex items-center space-x-1"
                            title="เพิ่มระดับพนักงาน P1 ไป P2"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>เลื่อนเป็น P2</span>
                          </button>
                        )}

                        {/* Reset password to 0000 */}
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="รีเซ็ทรหัสผ่านเป็น '0000'"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Send Notification message to user */}
                        <button
                          onClick={() => setSendNotifUser(user)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="ส่งข้อความแจ้งเตือนไปยังผู้ใช้นี้"
                        >
                          <Send className="w-4 h-4" />
                        </button>

                        {/* Edit Department & Role */}
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setEditDepartment(user.department);
                            setEditRole(user.role);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                          title="แก้ไขแผนกและสิทธิ์"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete User */}
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบพนักงาน"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Edit Department & Role */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-base text-slate-800 mb-1">แก้ไขข้อมูลผู้ใช้: {editingUser.username}</h3>
            <p className="text-xs text-slate-400 mb-4">ปรับแผนกและสิทธิ์การใช้งาน</p>

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">แผนก (Department)</label>
                <select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value as UserDepartment)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="พนักงาน">พนักงาน</option>
                  <option value="หัวหน้างาน">หัวหน้างาน</option>
                  <option value="รองผู้จัดการ">รองผู้จัดการ</option>
                  <option value="ผู้จัดการ">ผู้จัดการ</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ระดับสิทธิ์ (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="P1">P1 - พนักงาน (ต้องได้รับอนุญาตจาก P2)</option>
                  <option value="P2">P2 - หัวหน้างาน/ผู้จัดการ (ตรวจเช็คได้โดยตรง)</option>
                  <option value="P3">P3 - แอดมิน (จัดการระบบ/รีเซ็ตรหัส/อนุมัติสมาชิก)</option>
                  {currentUser?.role === 'P4' && (
                    <option value="P4">P4 - ผู้จัดการระบบ</option>
                  )}
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/2 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Send Notification Message to Selected User */}
      {sendNotifUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 text-center">
              ส่งข้อความแจ้งเตือนไปยัง: <span className="text-blue-600">{sendNotifUser.username}</span>
            </h3>
            <p className="text-xs text-slate-400 text-center mb-4">
              ข้อความจะแสดงในกล่องแจ้งเตือนเฉพาะตัวของ {sendNotifUser.username}
            </p>

            <form onSubmit={handleSendNotification} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">หัวข้อข้อความ *</label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="เช่น แจ้งเตือนการปฏิบัติงาน, มอบหมายงาน..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เนื้อหาข้อความ *</label>
                <textarea
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="พิมพ์ข้อความที่ต้องการแจ้งเตือน..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSendNotifUser(null)}
                  className="w-1/2 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs flex items-center justify-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งแจ้งเตือน</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Employee */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-base text-slate-800 mb-1">เพิ่มพนักงานใหม่</h3>
            <p className="text-xs text-slate-400 mb-4">เพิ่มพนักงานและกำหนดระดับสิทธิ์ทันที</p>

            <form onSubmit={handleAddUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ใช้งาน (Username) *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="เช่น employee02"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">รหัสผ่านเริ่มต้น</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">แผนก (Department)</label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value as UserDepartment)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="พนักงาน">พนักงาน</option>
                  <option value="หัวหน้างาน">หัวหน้างาน</option>
                  <option value="รองผู้จัดการ">รองผู้จัดการ</option>
                  <option value="ผู้จัดการ">ผู้จัดการ</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">สิทธิ์ (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="P1">P1 - พนักงาน</option>
                  <option value="P2">P2 - หัวหน้างาน / ผู้จัดการ</option>
                  <option value="P3">P3 - แอดมิน</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="w-1/2 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  เพิ่มพนักงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

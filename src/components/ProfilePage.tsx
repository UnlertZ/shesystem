import React, { useState } from 'react';
import { User, Task, AppNotification, Equipment } from '../types';
import { storageService, uploadToR2 } from '../services/storage';
import {
  User as UserIcon,
  Lock,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ListTodo,
  Bell,
  Plus,
  Send,
  Building2,
  CheckSquare,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Calendar,
  X,
  Trash2
} from 'lucide-react';
import { formatThaiDate } from '../utils/thaiDate';

interface ProfilePageProps {
  currentUser: User;
  onUpdateCurrentUser: (user: User) => void;
  onInspectAssignedEquipment?: (equipment: Equipment, task: Task) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  onUpdateCurrentUser,
  onInspectAssignedEquipment
}) => {
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>(() => storageService.getTasks(currentUser.id));

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    storageService.getNotifications(currentUser.id, currentUser.role)
  );

  // Delegate / Assign Task Modal (For P2, P3, P4)
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskType, setTaskType] = useState<'INSPECTION' | 'ACTIVITY'>('INSPECTION');
  const [assigneeId, setAssigneeId] = useState('');
  const [targetEquipId, setTargetEquipId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Complete Task Modal state & notification
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  const users = storageService.getUsers();
  const allEquipment = storageService.getEquipment();

  const isSupervisorOrAbove = currentUser.role === 'P2' || currentUser.role === 'P3' || currentUser.role === 'P4';

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 4) {
      setPasswordMsg({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' });
      return;
    }

    // Save to users list and Cloudflare D1
    storageService.changeUserPassword(currentUser.id, newPassword);

    setPasswordMsg({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleAvatarChange = (newUrl: string) => {
    setAvatarUrl(newUrl);
    const updated = { ...currentUser, avatar_url: newUrl };
    storageService.setCurrentUser(updated);
    storageService.updateUser(currentUser.id, { avatar_url: newUrl });
    onUpdateCurrentUser(updated);
  };

  const handleFileUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadToR2(file);
        handleAvatarChange(url);
      } catch (err) {
        const reader = new FileReader();
        reader.onloadend = () => {
          handleAvatarChange(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleTaskStatusToggle = (task: Task) => {
    const nextStatus = task.status === 'PENDING' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING';
    storageService.updateTaskStatus(task.id, nextStatus, currentUser);
    setTasks(storageService.getTasks(currentUser.id));
  };

  const handleOpenCompleteTask = (task: Task) => {
    setCompletingTask(task);
    setCompletionNotes('');
  };

  const handleConfirmCompleteTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!completingTask) return;

    setIsSubmittingComplete(true);
    try {
      storageService.updateTaskStatus(
        completingTask.id,
        'COMPLETED',
        currentUser,
        completionNotes.trim()
      );

      setTasks(storageService.getTasks(currentUser.id));
      setPasswordMsg({
        type: 'success',
        text: `บันทึกว่าทำสำเร็จแล้ว และส่งการแจ้งเตือนไปยังผู้มอบหมาย (${completingTask.assigned_by_name}) เรียบร้อยแล้ว`
      });
      setCompletingTask(null);
      setCompletionNotes('');
      window.dispatchEvent(new Event('she_data_synced'));
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกสถานะงาน');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleMarkNotification = (id: string) => {
    storageService.markNotificationAsRead(id);
    setNotifications(storageService.getNotifications(currentUser.id, currentUser.role));
  };

  const handleClearNotifications = () => {
    if (confirm('คุณต้องการล้างการแจ้งเตือนทั้งหมดใช่หรือไม่?')) {
      storageService.clearNotifications(currentUser.id);
      setNotifications([]);
    }
  };

  // Create Task (Delegation from P2 to P1 or Admin assignment)
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !assigneeId) {
      alert('กรุณากรอกหัวข้องานและเลือกผู้รับผิดชอบ');
      return;
    }

    const targetUser = users.find(u => u.id === assigneeId);
    if (!targetUser) return;

    const targetEquip = allEquipment.find(e => e.id === targetEquipId);

    const assignerName = currentUser.full_name ? `${currentUser.full_name} (${currentUser.username})` : currentUser.username;
    const assigneeName = targetUser.full_name ? `${targetUser.full_name} (${targetUser.username})` : targetUser.username;

    storageService.createTask({
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      equipment_id: targetEquip?.id,
      equipment_code: targetEquip?.code,
      assigned_by_id: currentUser.id,
      assigned_by_name: `${assignerName} (${currentUser.department})`,
      assigned_to_id: targetUser.id,
      assigned_to_name: `${assigneeName} (${targetUser.department})`,
      task_type: taskType,
      due_date: taskDueDate || undefined
    });

    setIsAssignTaskModalOpen(false);
    setTaskTitle('');
    setTaskDescription('');
    setTasks(storageService.getTasks(currentUser.id));
    alert(`มอบหมายงานให้ ${assigneeName} เรียบร้อยแล้ว พร้อมส่งการแจ้งเตือนส่วนตัว`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Profile Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="relative group">
          <img
            src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
            alt={currentUser.username}
            className="w-24 h-24 rounded-3xl object-cover border-2 border-slate-200 shadow-md"
          />
          <label className="absolute -bottom-2 -right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md cursor-pointer transition">
            <Camera className="w-4 h-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUploadAvatar} />
          </label>
        </div>

        <div className="flex-1 text-center md:text-left space-y-2">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h1 className="text-2xl font-bold text-slate-800">
              {currentUser.full_name || currentUser.username}
            </h1>
            {currentUser.full_name && (
              <span className="text-sm text-slate-400 font-medium">({currentUser.username})</span>
            )}
            <span className="text-xs bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full">
              สิทธิ์: {currentUser.role}
            </span>
            {currentUser.is_safety_committee && (
              <span className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-1 rounded-full flex items-center space-x-1 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>กรรมการ คปอ.</span>
              </span>
            )}
            <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2.5 py-1 rounded-full flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>อนุมัติแล้ว</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>แผนก: <strong className="text-slate-700">{currentUser.department}</strong></span>
            </span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>ตำแหน่ง: <strong className="text-slate-700">{currentUser.position || 'ทั่วไป'}</strong></span>
            </span>
            <span>ลงทะเบียนเมื่อ: {formatThaiDate(currentUser.created_at)}</span>
          </div>

          <p className="text-xs text-slate-400 max-w-xl">
            {currentUser.role === 'P1' && 'คุณอยู่ในสิทธิ์ P1: เมื่อได้รับมอบหมายงานจากหัวหน้างาน (P2) จะสามารถตรวจเช็คอุปกรณ์แทนได้'}
            {currentUser.role === 'P2' && 'คุณอยู่ในสิทธิ์ P2: สามารถตรวจเช็คอุปกรณ์ได้โดยตรงไม่ต้องขออนุญาต และสามารถมอบหมายงานตรวจสอบให้แก่พนักงาน (P1) ได้'}
            {currentUser.role === 'P3' && 'คุณอยู่ในสิทธิ์ P3 (แอดมิน): จัดการเพิ่มลบพนักงาน, เลื่อนระดับ P1 เป็น P2, รีเซ็ทรหัสผ่าน "0000", และส่งแจ้งเตือน'}
            {currentUser.role === 'P4' && 'คุณอยู่ในสิทธิ์ P4 (ผู้จัดการระบบ): มีอำนาจสูงสุดในการบริหารจัดการระบบและข้อมูลทั้งหมด'}
          </p>
        </div>

        {/* Quick Task Assign Trigger for P2, P3, P4 */}
        {isSupervisorOrAbove && (
          <button
            onClick={() => setIsAssignTaskModalOpen(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-200 transition flex items-center space-x-1.5 self-center md:self-start"
          >
            <Plus className="w-4 h-4" />
            <span>มอบหมายงานใหม่</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Tasks (งานที่ได้รับมอบหมาย อาจมีได้มากกว่า 1) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ListTodo className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    งานที่ได้รับมอบหมาย ({tasks.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    งานตรวจสอบอุปกรณ์ที่หัวหน้างาน (P2) มอบหมาย หรือกิจกรรมความปลอดภัยจากแอดมิน
                  </p>
                </div>
              </div>

              {isSupervisorOrAbove && (
                <button
                  onClick={() => setIsAssignTaskModalOpen(true)}
                  className="text-xs text-red-600 font-semibold hover:underline flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>มอบหมายงาน</span>
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                ไม่มีงานที่ได้รับมอบหมายในขณะนี้
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => {
                  const isAssignedToMe = task.assigned_to_id === currentUser.id;
                  const targetEquipment = allEquipment.find(e => e.id === task.equipment_id);

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border transition space-y-3 ${
                        task.status === 'COMPLETED'
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{task.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              task.task_type === 'INSPECTION'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {task.task_type === 'INSPECTION' ? 'ตรวจเช็คอุปกรณ์' : 'กิจกรรม Safety'}
                            </span>
                            {task.status === 'COMPLETED' ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>ทำสำเร็จแล้ว</span>
                              </span>
                            ) : task.status === 'IN_PROGRESS' ? (
                              <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                                กำลังดำเนินการ
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                                รอดำเนินการ
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                            <span>มอบหมายโดย: <strong className="text-slate-600">{task.assigned_by_name}</strong></span>
                            <span>ผู้รับผิดชอบ: <strong className="text-slate-600">{task.assigned_to_name}</strong></span>
                            {task.due_date && (
                              <span>กำหนดส่ง: <strong className="text-red-600">{task.due_date}</strong></span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                          {task.status !== 'COMPLETED' ? (
                            <button
                              onClick={() => handleOpenCompleteTask(task)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                              title="กดเมื่อทำงานเสร็จสิ้น เพื่อส่งการแจ้งเตือนไปยังผู้มอบหมาย"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ทำสำเร็จแล้ว</span>
                            </button>
                          ) : (
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>เสร็จสิ้นเรียบร้อย</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Completed summary details if available */}
                      {task.status === 'COMPLETED' && (
                        <div className="pt-2 border-t border-emerald-100 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 bg-emerald-50/50 p-2.5 rounded-xl">
                          <span className="flex items-center space-x-1 text-emerald-800 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              ทำสำเร็จเมื่อ: {task.completed_at ? formatThaiDate(task.completed_at, true) : 'เรียบร้อย'}
                              {task.completed_by_name && ` โดย ${task.completed_by_name}`}
                            </span>
                          </span>
                          {task.completion_notes && (
                            <span className="text-slate-700">
                              บันทึก: <strong className="text-slate-900">{task.completion_notes}</strong>
                            </span>
                          )}
                        </div>
                      )}

                      {/* If task has equipment and assigned to current user, provide direct inspect button */}
                      {targetEquipment && isAssignedToMe && task.status !== 'COMPLETED' && onInspectAssignedEquipment && (
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            อุปกรณ์: <strong className="text-slate-800">{targetEquipment.code}</strong> ({targetEquipment.location})
                          </span>
                          <button
                            onClick={() => onInspectAssignedEquipment(targetEquipment, task)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1 cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>เริ่มตรวจเช็คจากงานนี้ทันที</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <Lock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-sm text-slate-800">เปลี่ยนรหัสผ่านส่วนตัว</h3>
                <p className="text-xs text-slate-400">อัปเดตรหัสผ่านใหม่เพื่อความปลอดภัยในการเข้าใช้งาน</p>
              </div>
            </div>

            {passwordMsg && (
              <div className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                passwordMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="กรอกรหัสปัจจุบัน"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="ยืนยันรหัสใหม่"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="sm:col-span-3 pt-1 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-xs transition"
                >
                  บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Personal Notification Box (กล่องแจ้งเตือนเฉพาะของตัวเอง) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <Bell className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">กล่องแจ้งเตือนเฉพาะคุณ</h3>
                  <p className="text-xs text-slate-400">ข้อความและงานที่ส่งถึงคุณ</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                  {notifications.filter(n => !n.is_read).length} ใหม่
                </span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearNotifications}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="ล้างการแจ้งเตือนทั้งหมด"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                ไม่มีข้อความแจ้งเตือนในขณะนี้
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkNotification(notif.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                      !notif.is_read
                        ? 'bg-red-50/60 border-red-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-xs ${!notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatThaiDate(notif.created_at, true, true)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                    <div className="text-[10px] text-slate-400 mt-1">
                      จาก: {notif.sender_name} {!notif.is_read && <span className="text-red-600 font-bold">(คลิกเพื่ออ่าน)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Assign Task (P2 assigning inspection to P1 or Admin assigning activity) */}
      {isAssignTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-800">มอบหมายงานใหม่</h3>
                <p className="text-xs text-slate-400">
                  หัวหน้างาน (P2) มอบหมายให้พนักงาน (P1) หรือแอดมินมอบหมายกิจกรรม
                </p>
              </div>
              <button onClick={() => setIsAssignTaskModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทงาน</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="INSPECTION">ตรวจสอบอุปกรณ์ดับเพลิงแทน (มอบสิทธิ์ตรวจ)</option>
                  <option value="ACTIVITY">เข้าร่วมกิจกรรม Safety / ฝึกอบรม</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">มอบหมายให้แก่พนักงาน *</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">-- เลือกพนักงานผู้รับมอบหมาย --</option>
                  {users.filter(u => u.id !== currentUser.id).map(u => {
                    const nameDisplay = u.full_name ? `${u.full_name} (${u.username})` : u.username;
                    return (
                      <option key={u.id} value={u.id}>
                        {nameDisplay} ({u.department} - สิทธิ์ {u.role})
                      </option>
                    );
                  })}
                </select>
              </div>

              {taskType === 'INSPECTION' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เลือกอุปกรณ์ที่ต้องการมอบหมาย</label>
                  <select
                    value={targetEquipId}
                    onChange={(e) => setTargetEquipId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- เลือกอุปกรณ์ --</option>
                    {allEquipment.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.code} ({eq.type}) - {eq.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">หัวข้องาน *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="เช่น ตรวจสอบถังดับเพลิง EX-003 ประจำรอบเดือน"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">รายละเอียดและคำอธิบาย</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="ระบุเหตุผล เช่น ติดภารกิจประชุมด่วน มอบหมายให้ตรวจสอบแทน..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">กำหนดส่งงาน (Due Date)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignTaskModalOpen(false)}
                  className="w-1/2 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-xs flex items-center justify-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>บันทึกและส่งมอบหมาย</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Confirmation Modal */}
      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-800">ยืนยันทำภารกิจ/งานสำเร็จ</h3>
                  <p className="text-xs text-slate-400">ระบบจะส่งการแจ้งเตือนไปยังผู้มอบหมายงาน</p>
                </div>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCompleteTask} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 text-sm">{completingTask.title}</div>
                {completingTask.description && (
                  <p className="text-slate-600 leading-relaxed">{completingTask.description}</p>
                )}
                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 space-y-0.5">
                  <div>ผู้มอบหมายที่จะได้รับแจ้งเตือน: <strong className="text-slate-700">{completingTask.assigned_by_name}</strong></div>
                  {completingTask.due_date && (
                    <div>กำหนดส่ง: <strong className="text-red-600">{completingTask.due_date}</strong></div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">บันทึก/หมายเหตุผลการดำเนินงาน (ไม่บังคับ):</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="เช่น ตรวจเช็คอุปกรณ์และแก้ไขสิ่งผิดปกติเรียบร้อยแล้ว, ปฏิบัติงานตามขั้นตอนเสร็จสิ้น..."
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-start space-x-2">
                <Bell className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>เมื่อกดยืนยัน ระบบจะเปลี่ยนสถานะเป็น "ทำสำเร็จแล้ว" และส่งข้อความแจ้งเตือนไปยัง <strong>{completingTask.assigned_by_name}</strong> ทันที</span>
              </div>

              <div className="flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComplete}
                  className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingComplete ? 'กำลังบันทึก...' : 'บันทึกทำสำเร็จแล้ว'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, Message, Report } from '../types';
import { MessageRequest, getAllReports, updateReportStatus, deleteReport, saveGlobalSettings, createAnnouncement, updateUserRole, getAllAnnouncements, updateAnnouncement, deleteAnnouncement } from '../services/firebaseService';
import { collection, getDocs, collectionGroup, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, MessageSquare, Activity, Loader2, X, AlertOctagon, PauseCircle, Trash2, Flag, BarChart2, Download, Settings, Send, Bell, CheckCircle, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function AdminDashboard({ currentUser, currentUserProfile, showToast }: { currentUser: any, currentUserProfile?: any, showToast?: (msg: string) => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted' | 'blocked' | 'paused'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'messages' | 'reports' | 'tickets' | 'settings' | 'notifications'>('overview');
  
  const [messageFilterKeyword, setMessageFilterKeyword] = useState('');
  const [messageFilterUser, setMessageFilterUser] = useState('');
  const [messageFilterTime, setMessageFilterTime] = useState<'all' | '1h' | '24h' | '7d' | '30d'>('all');

  const [tickets, setTickets] = useState<import('../types').SupportTicket[]>([]);
  const [announcementHistory, setAnnouncementHistory] = useState<import('../types').Announcement[]>([]);
  const [actingOnAnnouncementId, setActingOnAnnouncementId] = useState<string | null>(null);
  const [announcementToPermanentlyDelete, setAnnouncementToPermanentlyDelete] = useState<import('../types').Announcement | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementMsg, setEditingAnnouncementMsg] = useState('');
  
  // Analytics
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  // Settings
  const [globalSettings, setGlobalSettings] = useState<any>({
    maintenanceMode: false,
    aiModel: 'gemini-pro',
    registrationOpen: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tabId: any) => {
    setActiveTab(tabId);
    if (window.innerWidth < 768) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    uid: string;
    field: string;
    value: boolean | string;
    actionName: string;
    message: string;
  } | null>(null);

  const isAdmin = currentUserProfile?.role === 'admin' || currentUser?.email === 'mail2tushar.jain@gmail.com';
  const isModerator = currentUserProfile?.role === 'moderator' || isAdmin;

  useEffect(() => {
    if (!isModerator) return;

    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // Fetch all users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
        setUsers(usersData);

        // Fetch all messages (using collectionGroup)
        const messagesQuery = query(collectionGroup(db, 'messages'), orderBy('createdAt', 'desc'), limit(100));
        const messagesSnapshot = await getDocs(messagesQuery);
        const messagesData = messagesSnapshot.docs.map(doc => doc.data() as Message);
        setMessages(messagesData);

        // Fetch all message requests
        const requestsSnapshot = await getDocs(collection(db, 'messageRequests'));
        const requestsData = requestsSnapshot.docs.map(doc => doc.data() as MessageRequest);
        setRequests(requestsData);

        // Fetch reports
        const fetchedReports = await getAllReports();
        setReports(fetchedReports);

        // Fetch tickets
        const fetchedTickets = await import('../services/firebaseService').then(m => m.getAllSupportTickets());
        setTickets(fetchedTickets);

        // Fetch announcements
        const fetchedAnnouncements = await getAllAnnouncements();
        setAnnouncementHistory(fetchedAnnouncements);
        
        const settingsSnap = await getDocs(collection(db, 'settings'));
        if (!settingsSnap.empty) {
          const global = settingsSnap.docs.find(d => d.id === 'global');
          if (global) {
            setGlobalSettings(prev => ({ ...prev, ...global.data() }));
          }
        }

        // Analytics calculation
        const now = Date.now();
        const activeUsersCount = usersData.filter(u => u.lastActiveAt && (now - u.lastActiveAt.toMillis()) < 30 * 24 * 60 * 60 * 1000).length;
        setActiveUsersCount(activeUsersCount);

        // Chart Data Generation (Last 7 Days)
        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return `${d.getMonth()+1}/${d.getDate()}`;
        });

        const dailyData = last7Days.map(dateStr => {
          // Count users active on this date string
          const dauCount = usersData.filter(u => u.lastActiveAt && new Date(u.lastActiveAt.toMillis()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length;
          // Registrations
          const regCount = usersData.filter(u => u.createdAt && new Date(u.createdAt.toMillis()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length;
          // Messages sent
          const msgCount = messagesData.filter(m => m.createdAt && new Date(m.createdAt.toMillis()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length;
          // Connection requests
          const reqCount = requestsData.filter(r => r.createdAt && new Date(r.createdAt.toMillis()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length;

          return { name: dateStr, DAU: dauCount, Registrations: regCount, Messages: msgCount, Requests: reqCount };
        });
        setChartData(dailyData);

      } catch (error) {
        console.error("Error fetching admin data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [isModerator]);

  const handleUpdateUserStatus = async (uid: string, field: string, value: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { [field]: value });
      setUsers(users.map(u => u.uid === uid ? { ...u, [field]: value } : u));
      if (selectedUser?.uid === uid) {
        setSelectedUser({ ...selectedUser, [field]: value });
      }
    } catch (error) {
      console.error("Error updating user status", error);
    }
  };

  const handleExportCsv = () => {
    const parameters = ['UID', 'Name', 'Email', 'College', 'Experience', 'Role', 'Status', 'CreatedAt', 'LastActiveAt'];
    const userColumns = users.map(u => {
      let status = 'Active';
      if (u.isDeleted) status = 'Deleted';
      else if (u.isBlocked) status = 'Blocked';
      else if (u.isPaused) status = 'Paused';

      return {
        'UID': u.uid,
        'Name': `"${u.displayName || ''}"`,
        'Email': u.email || '',
        'College': `"${u.collegeName || ''}"`,
        'Experience': (u.workExperiences || []).length,
        'Role': u.role || 'user',
        'Status': status,
        'CreatedAt': u.createdAt?.toDate ? u.createdAt.toDate().toISOString() : '',
        'LastActiveAt': u.lastActiveAt?.toDate ? u.lastActiveAt.toDate().toISOString() : ''
      };
    });

    const rows = parameters.map(param => {
      const rowData = [param, ...userColumns.map(userData => userData[param as keyof typeof userData])];
      return rowData.join(',');
    });

    const headersRow = ['Parameter', ...users.map((_, i) => `User ${i + 1}`)];
    const csvContent = "data:text/csv;charset=utf-8," + [headersRow.join(','), ...rows].join("\\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendAnnouncement = async () => {
    if (!announcementMsg.trim()) return;
    try {
      await createAnnouncement({ message: announcementMsg, senderId: currentUser.uid });
      setAnnouncementMsg('');
      showToast?.('Announcement Sent to all active users!');
    } catch (e) {
      showToast?.('Error sending announcement.');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveGlobalSettings(globalSettings || {});
      showToast?.('Global settings saved!');
    } catch (e) {
      showToast?.('Error saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!isModerator) {
    return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-32 md:pb-12 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Logged in as: <span className="font-bold text-slate-900 dark:text-slate-300">{currentUser?.email}</span> ({currentUserProfile?.role || 'admin'})
          </p>
        </div>
        {activeTab === 'users' && (
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-8">
        {[
          { id: 'overview', icon: Activity, label: 'Overview' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'messages', icon: MessageSquare, label: 'Messages' },
          { id: 'reports', icon: Flag, label: 'Reports', hasNotification: reports.some(r => r.status === 'pending') },
          { id: 'tickets', icon: AlertOctagon, label: 'Tickets', hasNotification: tickets.some(t => t.status === 'open') },
          { id: 'notifications', icon: Bell, label: 'Push Notifications' },
          { id: 'settings', icon: Settings, label: 'Settings' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => handleTabChange(tab.id as any)} 
            className={`relative flex flex-col items-center justify-center p-4 rounded-2xl font-bold transition-all border ${activeTab === tab.id ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-600/20 ring-offset-2 ring-offset-white dark:ring-offset-[#09090b]' : 'bg-white dark:bg-[#18181b] text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#27272a] border-slate-200 dark:border-slate-800'}`}
          >
            <div className="relative">
              <tab.icon className={`w-8 h-8 mb-3 ${activeTab === tab.id ? 'text-red-100' : 'text-slate-400 dark:text-slate-500'}`} />
              {tab.hasNotification && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white dark:border-[#18181b] box-content"></span>
              )}
            </div>
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      <div ref={contentRef} className="scroll-mt-4">
        {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{users.length}</p>
                </div>
              </div>
              <button onClick={() => handleTabChange('users')} className="text-red-600 hover:text-red-700 text-sm font-bold mt-4 flex items-center gap-1"><BarChart2 className="w-4 h-4"/> View User Analytics</button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Messages</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{messages.length}</p>
                </div>
              </div>
              <button onClick={() => handleTabChange('messages')} className="text-red-600 hover:text-red-700 text-sm font-bold mt-4 flex items-center gap-1"><BarChart2 className="w-4 h-4"/> View Message Analytics</button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Monthly Active Users</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeUsersCount}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Activity Chart */}
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">User Activity (Last 7 Days)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDAU" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f8fafc' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <Area type="monotone" dataKey="DAU" stroke="#dc2626" fillOpacity={1} fill="url(#colorDAU)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Registrations" stroke="#2563eb" fillOpacity={1} fill="url(#colorReg)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Messages" stroke="#10b981" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="Requests" stroke="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Users className="w-8 h-8 text-blue-500" /> Recent Users</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Detailed user registration and activity tracking</p>
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
               <div className="flex-1 sm:flex-none bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Active</p>
                 <p className="text-xl font-black text-green-500">{users.filter(u => !u.isDeleted && !u.isPaused && !u.isBlocked).length}</p>
               </div>
               <div className="flex-1 sm:flex-none bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Blocked</p>
                 <p className="text-xl font-black text-purple-500">{users.filter(u => u.isBlocked).length}</p>
               </div>
            </div>
          </div>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
             <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-0 bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 focus:ring-2 focus:ring-red-600 text-slate-900 dark:text-slate-50 placeholder-slate-500 transition-all outline-none"
             />
             <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-48 bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 focus:ring-2 focus:ring-red-600 text-slate-900 dark:text-slate-50 transition-all outline-none"
             >
               <option value="all">All Statuses</option>
               <option value="active">Active</option>
               <option value="deleted">Deleted</option>
               <option value="blocked">Blocked</option>
               <option value="paused">Paused</option>
             </select>
          </div>
          <div className="overflow-y-auto flex-1 space-y-4 pr-4 cursor-pointer">
            {users
              .filter(u => {
                if (statusFilter === 'active') return !u.isDeleted && !u.isPaused && !u.isBlocked;
                if (statusFilter === 'paused') return u.isPaused && !u.isBlocked && !u.isDeleted;
                if (statusFilter === 'blocked') return u.isBlocked;
                if (statusFilter === 'deleted') return u.isDeleted;
                return true;
              })
              .filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
              <motion.div 
                key={user.uid} 
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedUser(user)}
                className={`flex gap-4 sm:gap-6 items-center p-4 rounded-2xl transition-all shadow-sm ${selectedUser?.uid === user.uid ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 border-2 scale-[1.01]' : 'bg-slate-50 border border-slate-100 dark:border-slate-800 dark:bg-[#27272a] hover:border-red-300 dark:hover:border-red-800'}`}
              >
                <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-xl shadow-inner">
                  {user.displayName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-lg text-slate-900 dark:text-white truncate">{user.displayName}</p>
                  <p className="text-sm text-slate-500 truncate">{user.email}</p>
                </div>
                <div className="shrink-0 ml-auto flex gap-4 md:gap-6 text-sm text-slate-500 items-center">
                  <div className="hidden md:block text-right">
                     <p className="font-semibold text-slate-900 dark:text-slate-300">Degree</p>
                     <p>{user.degree || 'N/A'}</p>
                  </div>
                  <div className="text-right font-medium flex flex-col gap-1 items-end">
                    {user.isDeleted ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs">Deleted</span> : null}
                    {user.isPaused ? <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs">Paused</span> : null}
                    {user.isBlocked ? <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs">Blocked</span> : null}
                    {!user.isDeleted && !user.isPaused && !user.isBlocked && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">Active</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'messages' && (() => {
        const filteredMessages = messages.filter(msg => {
          const sender = users.find(u => u.uid === msg.senderId);
          const receiver = users.find(u => u.uid === msg.receiverId);
          
          if (messageFilterKeyword && !msg.text?.toLowerCase().includes(messageFilterKeyword.toLowerCase())) {
             return false;
          }
          
          if (messageFilterUser) {
            const sName = sender?.displayName?.toLowerCase() || '';
            const rName = receiver?.displayName?.toLowerCase() || '';
            const search = messageFilterUser.toLowerCase();
            if (!sName.includes(search) && !rName.includes(search)) {
              return false;
            }
          }

          if (messageFilterTime !== 'all') {
            const msgTime = msg.createdAt ? (typeof msg.createdAt.toMillis === 'function' ? msg.createdAt.toMillis() : new Date(msg.createdAt).getTime()) : 0;
            if (msgTime) {
               const now = Date.now();
               const diff = now - msgTime;
               if (messageFilterTime === '1h' && diff > 1 * 60 * 60 * 1000) return false;
               if (messageFilterTime === '24h' && diff > 24 * 60 * 60 * 1000) return false;
               if (messageFilterTime === '7d' && diff > 7 * 24 * 60 * 60 * 1000) return false;
               if (messageFilterTime === '30d' && diff > 30 * 24 * 60 * 60 * 1000) return false;
            }
          }
          return true;
        });

        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
          >
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                 <div>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><MessageSquare className="w-8 h-8 text-green-500" /> Recent Messages</h2>
                   <p className="text-slate-500 dark:text-slate-400 mt-2">Platform-wide chat activity stream</p>
                 </div>
                 <div className="w-full sm:w-auto bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                     <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Messages Scanned</p>
                     <p className="text-xl font-black text-slate-900 dark:text-white">{filteredMessages.length}</p>
                 </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                 <input 
                   type="text" 
                   placeholder="Search keywords..." 
                   className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#27272a] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                   value={messageFilterKeyword}
                   onChange={(e) => setMessageFilterKeyword(e.target.value)}
                 />
                 <input 
                   type="text" 
                   placeholder="Filter by user (name)" 
                   className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#27272a] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                   value={messageFilterUser}
                   onChange={(e) => setMessageFilterUser(e.target.value)}
                 />
                 <select 
                   className="px-4 py-2 bg-slate-50 dark:bg-[#27272a] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                   value={messageFilterTime}
                   onChange={(e) => setMessageFilterTime(e.target.value as any)}
                 >
                   <option value="all">All Time</option>
                   <option value="1h">Last 1 Hour</option>
                   <option value="24h">Last 24 Hours</option>
                   <option value="7d">Last 7 Days</option>
                   <option value="30d">Last 30 Days</option>
                 </select>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-4">
              {filteredMessages.map((msg, i) => {
                const sender = users.find(u => u.uid === msg.senderId);
                const receiver = users.find(u => u.uid === msg.receiverId);
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} className="p-5 bg-slate-50 dark:bg-[#27272a] rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 mb-3">
                       <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <span className="text-red-600 dark:text-red-400">{sender?.displayName || 'Unknown'}</span> 
                          <span className="text-slate-400 px-2">→</span> 
                          <span className="text-blue-600 dark:text-blue-400">{receiver?.displayName || 'Unknown'}</span>
                       </p>
                       <span className="text-xs font-semibold text-slate-400 bg-white dark:bg-[#18181b] px-3 py-1 rounded-full">{msg.createdAt ? new Date(msg.createdAt?.toDate?.() || msg.createdAt).toLocaleString() : 'Unknown Date'}</span>
                    </div>
                    <p className="text-base text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">{msg.text}</p>
                  </motion.div>
                );
              })}
              {filteredMessages.length === 0 && (
                <p className="text-lg text-slate-500 text-center py-12">No messages found matching criteria.</p>
              )}
            </div>
          </motion.div>
        );
      })()}

      {activeTab === 'reports' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <Flag className="w-8 h-8 text-red-500" />
                Reported Users
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Manage user moderation requests</p>
            </div>
            <div className="w-full sm:w-auto bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Pending Reports</p>
                 <p className="text-xl font-black text-red-500">{reports.filter(r => r.status === 'pending').length}</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 space-y-6 pr-4">
            {reports.map((report, i) => {
              const reporter = users.find(u => u.uid === report.reporterId);
              const reported = users.find(u => u.uid === report.reportedId);
              return (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} className={`p-6 rounded-2xl border-2 transition-all ${report.status === 'pending' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 shadow-md' : 'bg-slate-50 dark:bg-[#27272a] border-slate-100 dark:border-slate-800'}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3">
                     <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                        <button onClick={() => reported && setSelectedUser(reported)} className="hover:underline text-red-600 dark:text-red-400 decoration-2 underline-offset-2">
                           {reported?.displayName || 'Unknown'}
                        </button>
                        <span className="text-slate-500 font-normal text-sm mx-2">reported by</span> <span className="text-sm">{reporter?.displayName || 'Unknown'}</span>
                     </div>
                     <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${report.status === 'pending' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800 box-content' : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300'}`}>
                       {report.status}
                     </span>
                  </div>
                  <div className="bg-white dark:bg-[#18181b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 relative">
                     <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 dark:bg-slate-700 rounded-l-xl"></div>
                     <p className="text-base text-slate-800 dark:text-slate-200 font-medium italic pl-4">"{report.reason}"</p>
                  </div>
                  
                  <div className="flex gap-4 mt-6">
                    {report.status === 'pending' && (
                      <button 
                        onClick={async () => {
                          if (report.id) {
                            await updateReportStatus(report.id, 'reviewed');
                            setReports(reports.map(r => r.id === report.id ? { ...r, status: 'reviewed' } : r));
                          }
                        }}
                        className="flex-1 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-sm"
                      >
                        Mark as Reviewed
                      </button>
                    )}
                    {report.status === 'reviewed' && (
                      <button 
                        onClick={async () => {
                          if (report.id) {
                            await deleteReport(report.id);
                            setReports(reports.filter(r => r.id !== report.id));
                          }
                        }}
                        className="flex-1 bg-white border-2 border-red-200 dark:bg-[#18181b] dark:border-red-900/40 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      >
                        <div className="flex items-center justify-center gap-2">
                           <Trash2 className="w-5 h-5"/> Delete Report
                        </div>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {reports.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Flag className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-lg font-medium">No reports found.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* User Details Modal/Sidebar */}
      <AnimatePresence>
      {selectedUser && (
        <motion.div 
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-[#09090b] shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">User Details</h2>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-4xl mb-4">
                {selectedUser.displayName.charAt(0)}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.displayName}</h3>
              <p className="text-sm text-slate-500">{selectedUser.email}</p>
            </div>

            <div className="space-y-4 mb-8">
               <div className="bg-slate-50 dark:bg-[#18181b] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Activity Stats</h4>
                  <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                     <div className="flex justify-between">
                       <span>Account Created</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{selectedUser.createdAt ? new Date(selectedUser.createdAt?.toDate?.() || selectedUser.createdAt).toLocaleDateString() : 'Unknown'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Last Sign In</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{selectedUser.lastActiveAt ? new Date(selectedUser.lastActiveAt?.toDate?.() || selectedUser.lastActiveAt).toLocaleString() : 'Not recorded'}</span>
                     </div>
                     <div className="flex justify-between mt-4">
                       <span>Requests Sent</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{requests.filter(r => r.senderId === selectedUser.uid).length}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Requests Received</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{requests.filter(r => r.receiverId === selectedUser.uid).length}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Messages Sent</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{messages.filter(m => m.senderId === selectedUser.uid).length}</span>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-50 dark:bg-[#18181b] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Profile Info</h4>
                  <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                     <div className="flex justify-between">
                       <span>Program</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{selectedUser.degree || '-'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>College</span>
                       <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">{selectedUser.collegeName || '-'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Experience</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{selectedUser.experienceYears ? `${selectedUser.experienceYears} Yrs` : 'Fresher'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Company</span>
                       <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">{selectedUser.companyName || '-'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Competitions</span>
                       <span className="font-semibold text-slate-900 dark:text-white">{selectedUser.competitionCount || 0}</span>
                     </div>
                  </div>
                  <div className="mt-4">
                     <span className="text-xs text-slate-500 uppercase tracking-widest block mb-2">Skills</span>
                     <div className="flex flex-wrap gap-1">
                       {selectedUser.skills && selectedUser.skills.length > 0 ? selectedUser.skills.map(skill => (
                         <span key={skill} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded">{skill}</span>
                       )) : <span className="text-sm text-slate-500">No skills listed</span>}
                     </div>
                  </div>
               </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Admin Actions</h4>
              
              <select
                value={selectedUser.role || 'user'}
                onChange={(e) => handleUpdateUserStatus(selectedUser.uid, 'role', e.target.value as any)}
                disabled={!isAdmin}
                className="w-full mb-4 p-3 rounded-xl bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 outline-none"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>

              <button 
                onClick={() => {
                  setConfirmAction({
                    uid: selectedUser.uid,
                    field: 'isPaused',
                    value: !selectedUser.isPaused as any,
                    actionName: selectedUser.isPaused ? 'Unpause Account' : 'Pause Account',
                    message: `Are you sure you want to ${selectedUser.isPaused ? 'unpause' : 'pause'} this account?`
                  });
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${selectedUser.isPaused ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <PauseCircle className="w-4 h-4" />
                {selectedUser.isPaused ? 'Unpause Account' : 'Pause Account'}
              </button>
              
              <button 
                onClick={() => {
                  setConfirmAction({
                    uid: selectedUser.uid,
                    field: 'isBlocked',
                    value: !selectedUser.isBlocked as any,
                    actionName: selectedUser.isBlocked ? 'Unblock Account' : 'Block Account',
                    message: `Are you sure you want to ${selectedUser.isBlocked ? 'unblock' : 'block'} this account?`
                  });
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${selectedUser.isBlocked ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <AlertOctagon className="w-4 h-4" />
                {selectedUser.isBlocked ? 'Unblock Account' : 'Block Account'}
              </button>

              {isAdmin && (
                <button 
                  onClick={() => {
                    setConfirmAction({
                      uid: selectedUser.uid,
                      field: 'isDeleted',
                      value: !selectedUser.isDeleted as any,
                      actionName: selectedUser.isDeleted ? 'Restore Account' : 'Soft Delete Account',
                      message: `Are you sure you want to ${selectedUser.isDeleted ? 'restore' : 'delete'} this account?`
                    });
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${selectedUser.isDeleted ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'}`}
                >
                  <Trash2 className="w-4 h-4" />
                  {selectedUser.isDeleted ? 'Restore Account' : 'Soft Delete Account'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'tickets' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px]"
        >
          <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">Support Tickets & Bugs</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Manage user queries and bug reports</p>
          </div>

          <div className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} className="p-4 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-3 sm:gap-4">
                   <div className="min-w-0 flex-1">
                      <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md mb-2 ${ticket.type === 'bug' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'}`}>
                        {ticket.type.toUpperCase()}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">{ticket.title}</h4>
                      <p className="text-xs text-slate-500">By {users.find(u => u.uid === ticket.userId)?.displayName || 'Unknown User'}</p>
                   </div>
                   <div className="flex gap-2 shrink-0">
                     <button
                       onClick={async () => {
                          const newStatus = ticket.status === 'open' ? 'closed' : 'open';
                          await import('../services/firebaseService').then(m => m.updateSupportTicketStatus(ticket.id!, newStatus));
                          setTickets(tickets.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));
                       }}
                       className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${ticket.status === 'open' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:hover:bg-yellow-900/60' : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/60'}`}
                     >
                       {ticket.status === 'open' ? 'Mark Closed' : 'Reopen'}
                     </button>
                     {ticket.status === 'closed' && (
                       <button
                         onClick={async () => {
                            try {
                              await import('../services/firebaseService').then(m => m.deleteSupportTicket(ticket.id!));
                              setTickets(prev => prev.filter(t => t.id !== ticket.id));
                            } catch (e) {
                              console.error(e);
                            }
                         }}
                         className="px-3 py-1 rounded-full text-xs font-bold transition-colors bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
                       >
                         Delete
                       </button>
                     )}
                   </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mt-3">{ticket.description}</p>
              </div>
            ))}
            {tickets.length === 0 && (
              <div className="text-center py-12 text-slate-500">No support tickets found.</div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'settings' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col space-y-8"
        >
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Settings className="w-8 h-8 text-slate-500" /> Platform Settings</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Manage global platform configurations and announcements</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Global Settings</h3>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Maintenance Mode</h4>
                  <p className="text-sm text-slate-500">Disable login and show maintenance screen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={globalSettings?.maintenanceMode || false} 
                    onChange={e => {
                      const isChecked = e.target.checked;
                      if (isChecked) {
                        setShowMaintenanceConfirm(true);
                      } else {
                        setGlobalSettings({...globalSettings, maintenanceMode: false});
                      }
                    }} 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Matching Enabled</h4>
                  <p className="text-sm text-slate-500">Allow users to discover teammates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={globalSettings?.matchingEnabled !== false} onChange={e => setGlobalSettings({...globalSettings, matchingEnabled: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="space-y-4 p-4 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">Max Allowed Users (Pilot Launch)</h4>
                <p className="text-sm text-slate-500 mb-2">Limit the number of registrations. Set to 0 for unlimited.</p>
                <input 
                  type="number" 
                  value={globalSettings?.maxUsers || 0}
                  onChange={e => setGlobalSettings({...globalSettings, maxUsers: parseInt(e.target.value) || 0})}
                  className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-slate-50"
                />
              </div>

              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {savingSettings ? <Loader2 className="w-5 h-5 animate-spin"/> : <Settings className="w-5 h-5"/>} Save Settings
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col space-y-8"
        >
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Bell className="w-8 h-8 text-red-600" /> Push Notifications</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Manage announcements and view history</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Active Notifications</h3>
              <div className="space-y-4">
                {announcementHistory.filter(a => a.active).length === 0 ? (
                  <p className="text-slate-500">No active announcements right now.</p>
                ) : (
                  announcementHistory.filter(a => a.active).map(ann => (
                    <div key={ann.id} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl relative group">
                      {editingAnnouncementId === ann.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editingAnnouncementMsg}
                            onChange={(e) => setEditingAnnouncementMsg(e.target.value)}
                            className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Edit message..."
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingAnnouncementId(null)}
                              className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={actingOnAnnouncementId === ann.id || !editingAnnouncementMsg.trim()}
                              onClick={async () => {
                                if (!editingAnnouncementMsg.trim()) return;
                                setActingOnAnnouncementId(ann.id as string);
                                try {
                                  await updateAnnouncement(ann.id as string, { message: editingAnnouncementMsg.trim() });
                                  setAnnouncementHistory(announcementHistory.map(a => a.id === ann.id ? {...a, message: editingAnnouncementMsg.trim()} : a));
                                  setEditingAnnouncementId(null);
                                } finally {
                                  setActingOnAnnouncementId(null);
                                }
                              }}
                              className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-1.5"
                            >
                              {actingOnAnnouncementId === ann.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-slate-900 dark:text-slate-50 pr-20">{ann.message}</p>
                          <p className="text-xs text-slate-500 mt-1">Started on {new Date(ann.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</p>
                          <div className="absolute top-4 right-4 flex gap-2">
                            <button 
                              disabled={actingOnAnnouncementId === ann.id}
                              onClick={() => {
                                setEditingAnnouncementMsg(ann.message);
                                setEditingAnnouncementId(ann.id as string);
                              }}
                              className="p-1.5 text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-md transition disabled:opacity-50"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              disabled={actingOnAnnouncementId === ann.id}
                              onClick={async () => {
                                setActingOnAnnouncementId(ann.id as string);
                                try {
                                  await updateAnnouncement(ann.id as string, { active: false });
                                  setAnnouncementHistory(announcementHistory.map(a => a.id === ann.id ? {...a, active: false} : a));
                                  showToast?.('Announcement moved to history.');
                                } catch (e) {
                                  showToast?.('Failed to deactivate announcement.');
                                } finally {
                                  setActingOnAnnouncementId(null);
                                }
                              }}
                              className="p-1.5 text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-md transition disabled:opacity-50"
                              title="Move to History"
                            >
                              {actingOnAnnouncementId === ann.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mt-8">Create New</h3>
              <div className="space-y-4 p-6 bg-slate-50 dark:bg-[#27272a] rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">Send an announcement to all users.</p>
                <textarea 
                  value={announcementMsg}
                  onChange={e => setAnnouncementMsg(e.target.value)}
                  placeholder="Type your announcement here..."
                  className="w-full h-24 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-red-500 outline-none"
                />
                <button 
                  onClick={async () => {
                    await handleSendAnnouncement();
                    // Refetch history
                    const fresh = await getAllAnnouncements();
                    setAnnouncementHistory(fresh);
                  }}
                  disabled={!announcementMsg.trim()}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-5 h-5"/> Push Announcement
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">History</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {announcementHistory.filter(a => !a.active).length === 0 ? (
                  <p className="text-slate-500">No past announcements.</p>
                ) : (
                  announcementHistory.filter(a => !a.active).map(ann => (
                    <div key={ann.id} className="p-4 bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl opacity-70 group relative">
                      <p className="text-sm text-slate-700 dark:text-slate-300 pr-8">{ann.message}</p>
                      <p className="text-xs text-slate-400 mt-2">Sent on {new Date(ann.createdAt?.toDate?.() || Date.now()).toLocaleString()}</p>
                      <button 
                        disabled={actingOnAnnouncementId === ann.id}
                        onClick={() => setAnnouncementToPermanentlyDelete(ann)}
                        className="absolute top-4 right-4 p-1.5 text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-md transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Permanently Delete"
                      >
                        {actingOnAnnouncementId === ann.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{confirmAction.actionName}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">{confirmAction.message}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleUpdateUserStatus(confirmAction.uid, confirmAction.field, confirmAction.value as boolean);
                    setConfirmAction(null);
                  }}
                  className={`flex-1 py-2.5 text-white font-bold rounded-xl transition ${
                    confirmAction.field === 'isDeleted' ? 'bg-red-600 hover:bg-red-700' :
                    confirmAction.field === 'isBlocked' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Announcement Permanent Deletion Confirmation */}
      <AnimatePresence>
        {announcementToPermanentlyDelete && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setAnnouncementToPermanentlyDelete(null)}
               className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white dark:bg-[#18181b] p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 relative z-10 max-w-md w-full"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3 text-center">Permanent Deletion</h3>
              <div className="text-slate-600 dark:text-slate-400 mb-8 text-center leading-relaxed">
                Are you sure you want to permanently delete this announcement? 
                <br/><br/>
                <span className="font-mono text-xs bg-slate-100 dark:bg-[#09090b] p-3 block rounded-xl border border-slate-200 dark:border-slate-800 italic">
                   "{announcementToPermanentlyDelete.message}"
                </span>
                <br/>
                This action will remove it from the database forever and cannot be undone.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setAnnouncementToPermanentlyDelete(null)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                  Keep It
                </button>
                <button 
                  onClick={async () => {
                    if (announcementToPermanentlyDelete.id) {
                      setActingOnAnnouncementId(announcementToPermanentlyDelete.id);
                      setAnnouncementToPermanentlyDelete(null);
                      try {
                        await deleteAnnouncement(announcementToPermanentlyDelete.id);
                        setAnnouncementHistory(prev => prev.filter(a => a.id !== announcementToPermanentlyDelete.id));
                      } finally {
                        setActingOnAnnouncementId(null);
                      }
                    }
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  Delete Forever
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Maintenance Mode Confirmation Modal */}
      <AnimatePresence>
        {showMaintenanceConfirm && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowMaintenanceConfirm(false)}
               className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white dark:bg-[#18181b] p-8 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/30 relative z-10 max-w-md w-full"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3 text-center">Enable Maintenance?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8 text-center leading-relaxed">
                This will prevent all non-admin users from accessing the platform. 
                Users will see a maintenance screen until you turn this off.
                <br/><br/>
                <span className="text-xs font-bold text-red-500 uppercase">Note: You must still click "Save Settings" to apply this change to the database.</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowMaintenanceConfirm(false)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setGlobalSettings({...globalSettings, maintenanceMode: true});
                    setShowMaintenanceConfirm(false);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  Confirm Toggle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, Message, Report } from '../types';
import { ClickableText } from '../App';
import { MessageRequest, getAllReports, updateReportStatus, deleteReport, saveGlobalSettings, createAnnouncement, updateUserRole, getAllAnnouncements, updateAnnouncement, deleteAnnouncement } from '../services/firebaseService';
import { collection, getDocs, collectionGroup, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, MessageSquare, Activity, Loader2, X, AlertOctagon, PauseCircle, Trash2, Flag, BarChart2, Download, Settings, Send, Bell, CheckCircle, Pencil, Filter, ShieldCheck, Shield, User as UserIcon } from 'lucide-react';
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
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'moderator' | 'user'>('all');
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'alphabetical-desc' | 'newest' | 'oldest' | 'recent-login' | 'oldest-login'>('newest');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'messages' | 'reports' | 'tickets' | 'settings' | 'notifications' | 'database' | 'audit' | 'campaigns'>('overview');
  
  const [databaseSearchTerm, setDatabaseSearchTerm] = useState('');
  
  const [messageFilterKeyword, setMessageFilterKeyword] = useState('');
  const [messageFilterSender, setMessageFilterSender] = useState('');
  const [messageFilterReceiver, setMessageFilterReceiver] = useState('');
  const [messageFilterTime, setMessageFilterTime] = useState<'all' | '1h' | '24h' | '7d' | '30d'>('all');
  const [auditFilterTime, setAuditFilterTime] = useState<'all' | '1h' | '24h' | '7d' | '30d'>('all');

  const [tickets, setTickets] = useState<import('../types').SupportTicket[]>([]);
  const [announcementHistory, setAnnouncementHistory] = useState<import('../types').Announcement[]>([]);
  const [actingOnAnnouncementId, setActingOnAnnouncementId] = useState<string | null>(null);
  const [announcementToPermanentlyDelete, setAnnouncementToPermanentlyDelete] = useState<import('../types').Announcement | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementMsg, setEditingAnnouncementMsg] = useState('');
  
  // Database filter states
  type FilterField = 'skills' | 'degree' | 'ugDegree' | 'collegeName' | 'gender' | 'minCompetitions' | 'workExpDuration' | 'isFresher' | 'accountStatus';
  const AVAILABLE_FILTERS: { value: FilterField; label: string }[] = [
    { value: 'skills', label: 'Skills' },
    { value: 'degree', label: 'Degree / Program' },
    { value: 'ugDegree', label: 'Undergrad Degree' },
    { value: 'collegeName', label: 'College Name' },
    { value: 'gender', label: 'Gender' },
    { value: 'minCompetitions', label: 'Min Competitions' },
    { value: 'workExpDuration', label: 'Work Experience Duration' },
    { value: 'isFresher', label: 'Is Fresher' },
    { value: 'accountStatus', label: 'Account Status' }
  ];

  const [activeFilters, setActiveFilters] = useState<FilterField[]>(['degree', 'skills', 'minCompetitions']);
  const [filterValues, setFilterValues] = useState<Record<FilterField, any>>({
    skills: '',
    degree: '',
    ugDegree: '',
    collegeName: '',
    gender: '',
    minCompetitions: '',
    workExpDuration: { years: '', months: '' },
    isFresher: '',
    accountStatus: ''
  });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Campaign specific states
  const [campaignSelectedUserIds, setCampaignSelectedUserIds] = useState<string[]>([]);
  const [showCampaignConfirmModal, setShowCampaignConfirmModal] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<import('../types').Campaign | null>(null);
  
  const getFilteredDatabaseUsers = () => {
    return users.filter(u => {
      if (databaseSearchTerm) {
        const searchL = databaseSearchTerm.toLowerCase();
        if (!u.displayName?.toLowerCase().includes(searchL) && !u.email?.toLowerCase().includes(searchL)) {
          return false;
        }
      }
      
      if (activeFilters.includes('degree') && filterValues.degree && (!u.degree || !u.degree.toLowerCase().includes(filterValues.degree.toLowerCase()))) return false;
      if (activeFilters.includes('skills') && filterValues.skills) {
        const searchSkills = filterValues.skills.toLowerCase().split(',').map((s: string) => s.trim());
        if (!u.skills?.some(s => searchSkills.some((ss: string) => s.toLowerCase().includes(ss)))) return false;
      }
      if (activeFilters.includes('minCompetitions') && filterValues.minCompetitions !== '' && (u.competitionCount || 0) < Number(filterValues.minCompetitions)) return false;
      
      if (activeFilters.includes('ugDegree') && filterValues.ugDegree && (!u.ugDegree || !u.ugDegree.toLowerCase().includes(filterValues.ugDegree.toLowerCase()))) return false;
      if (activeFilters.includes('collegeName') && filterValues.collegeName && (!u.collegeName || !u.collegeName.toLowerCase().includes(filterValues.collegeName.toLowerCase()))) return false;
      if (activeFilters.includes('gender') && filterValues.gender && (!u.gender || !u.gender.toLowerCase().includes(filterValues.gender.toLowerCase()))) return false;
      
      if (activeFilters.includes('isFresher') && filterValues.isFresher !== '') {
        const isF = filterValues.isFresher === '1';
        if (!!u.isFresher !== isF) return false;
      }

      if (activeFilters.includes('workExpDuration')) {
        const y = filterValues.workExpDuration.years !== '' ? Number(filterValues.workExpDuration.years) : 0;
        const m = filterValues.workExpDuration.months !== '' ? Number(filterValues.workExpDuration.months) : 0;
        const totalReqMonths = (y * 12) + m;
        
        let totalUserMonths = 0;
        if (u.workExperiences && Array.isArray(u.workExperiences)) {
           u.workExperiences.forEach(we => {
              const weY = we.durationYears || 0;
              const weM = we.durationMonths || 0;
              totalUserMonths += (weY * 12) + weM;
           });
        }
        if (totalReqMonths > 0 && totalUserMonths < totalReqMonths) return false;
      }

      if (activeFilters.includes('accountStatus') && filterValues.accountStatus !== '') {
        const status = filterValues.accountStatus;
        if (status === 'active') {
          if (u.isDeleted || u.isPaused || u.isBlocked) return false;
        } else if (status === 'inactive') {
          if (!u.isDeleted && !u.isBlocked && !u.isPaused) return false;
        } else if (status === 'blocked') {
          if (!u.isBlocked) return false;
        } else if (status === 'deleted') {
          if (!u.isDeleted) return false;
        } else if (status === 'paused') {
          if (!u.isPaused || u.isBlocked || u.isDeleted) return false;
        }
      }

      return true;
    });
  };

  const renderFiltersBlock = () => (
    <div className="mb-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Active Filters</h3>
        <div className="flex-1 w-full sm:max-w-xs ml-0 sm:ml-4">
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={databaseSearchTerm}
            onChange={(e) => setDatabaseSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 text-sm placeholder-slate-500 transition-all outline-none text-slate-900 dark:text-white"
          />
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors text-sm"
          >
            + Add Filter
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-white dark:bg-[#27272a] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-2">
               {AVAILABLE_FILTERS.map(filter => (
                 <button
                   key={filter.value}
                   onClick={() => {
                     if (!activeFilters.includes(filter.value)) {
                       setActiveFilters([...activeFilters, filter.value]);
                     }
                     setShowFilterDropdown(false);
                   }}
                   disabled={activeFilters.includes(filter.value)}
                   className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-[#3f3f46] text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                 >
                   {filter.label}
                 </button>
               ))}
            </div>
          )}
        </div>
        {activeFilters.length > 0 && (
          <button 
            onClick={() => {
              setActiveFilters([]);
              setFilterValues({
                skills: '', degree: '', ugDegree: '', collegeName: '', gender: '', minCompetitions: '', workExpDuration: { years: '', months: '' }, isFresher: '', accountStatus: ''
              });
            }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold ml-auto"
          >
            Clear All
          </button>
        )}
      </div>
      
      {activeFilters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          {activeFilters.map(filter => (
            <div key={filter} className="bg-white dark:bg-[#1c1c1f] border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm min-w-0">
               <div className="flex justify-between items-center gap-2">
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{AVAILABLE_FILTERS.find(f => f.value === filter)?.label}</span>
                 <button onClick={() => {
                   setActiveFilters(activeFilters.filter(f => f !== filter));
                   setFilterValues(prev => ({...prev, [filter]: filter === 'workExpDuration' ? { years: '', months: '' } : ''}));
                 }} className="text-slate-400 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
               </div>
               
               {filter === 'skills' && (
                 <input type="text" value={filterValues.skills} onChange={e => setFilterValues(prev => ({...prev, skills: e.target.value}))} placeholder="e.g. React, Node" className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
               )}
               {filter === 'degree' && (
                 <input type="text" value={filterValues.degree} onChange={e => setFilterValues(prev => ({...prev, degree: e.target.value}))} placeholder="e.g. B.Tech" className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
               )}
               {filter === 'ugDegree' && (
                 <input type="text" value={filterValues.ugDegree} onChange={e => setFilterValues(prev => ({...prev, ugDegree: e.target.value}))} placeholder="e.g. B.Sc" className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
               )}
               {filter === 'collegeName' && (
                 <input type="text" value={filterValues.collegeName} onChange={e => setFilterValues(prev => ({...prev, collegeName: e.target.value}))} placeholder="e.g. MIT" className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
               )}
               {filter === 'gender' && (
                 <select value={filterValues.gender} onChange={e => setFilterValues(prev => ({...prev, gender: e.target.value}))} className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500">
                   <option value="">Any</option>
                   <option value="Male">Male</option>
                   <option value="Female">Female</option>
                   <option value="Other">Other</option>
                 </select>
               )}
               {filter === 'minCompetitions' && (
                 <input type="number" value={filterValues.minCompetitions} onChange={e => setFilterValues(prev => ({...prev, minCompetitions: e.target.value}))} placeholder="e.g. 2" className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
               )}
               {filter === 'workExpDuration' && (
                 <div className="flex gap-2">
                   <input type="number" placeholder="Years" min="0" value={filterValues.workExpDuration.years} onChange={e => setFilterValues(prev => ({...prev, workExpDuration: { ...prev.workExpDuration, years: e.target.value }}))} className="text-sm w-1/2 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                   <input type="number" placeholder="Months" min="0" max="11" value={filterValues.workExpDuration.months} onChange={e => setFilterValues(prev => ({...prev, workExpDuration: { ...prev.workExpDuration, months: e.target.value }}))} className="text-sm w-1/2 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                 </div>
               )}
               {filter === 'isFresher' && (
                 <select value={filterValues.isFresher} onChange={e => setFilterValues(prev => ({...prev, isFresher: e.target.value}))} className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500">
                   <option value="">Any</option>
                   <option value="1">Yes (Fresher)</option>
                   <option value="0">No (Experienced)</option>
                 </select>
               )}
               {filter === 'accountStatus' && (
                 <select value={filterValues.accountStatus} onChange={e => setFilterValues(prev => ({...prev, accountStatus: e.target.value}))} className="text-sm w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500">
                   <option value="">Any</option>
                   <option value="active">Active</option>
                   <option value="inactive">Inactive</option>
                   <option value="blocked">Blocked</option>
                   <option value="paused">Paused</option>
                   <option value="deleted">Deleted</option>
                 </select>
               )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Audit Logs and Campaigns
  const [auditLogs, setAuditLogs] = useState<import('../types').AuditLog[]>([]);
  const [campaigns, setCampaigns] = useState<import('../types').Campaign[]>([]);
  const [newCampaign, setNewCampaign] = useState<Partial<import('../types').Campaign>>({ title: '', message: '' });
  
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
    if (window.innerWidth < 1024) {
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
    if (selectedUser || confirmAction || announcementToPermanentlyDelete || showMaintenanceConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { 
      document.body.style.overflow = ''; 
    };
  }, [selectedUser, confirmAction, announcementToPermanentlyDelete, showMaintenanceConfirm]);

  useEffect(() => {
    if (!isModerator) return;
    
    // Always fetch settings unconditionally at least once, lightweight
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDocs(collection(db, 'settings'));
        if (!settingsSnap.empty) {
          const global = settingsSnap.docs.find(d => d.id === 'global');
          if (global) setGlobalSettings(prev => ({ ...prev, ...global.data() }));
        }
      } catch (e) {}
    };
    fetchSettings();
  }, [isModerator]);

  useEffect(() => {
    if (!isModerator) return;

    const loadDataForTab = async () => {
      setLoading(true);
      try {
        let currentUserList = users;
        let currentMessagesList = messages;
        let currentRequestsList = requests;

        if ((activeTab === 'overview' || activeTab === 'users' || activeTab === 'database') && users.length === 0) {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          currentUserList = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
          setUsers(currentUserList);
        }
        if ((activeTab === 'overview' || activeTab === 'messages') && messages.length === 0) {
           const messagesQuery = query(collectionGroup(db, 'messages'), orderBy('createdAt', 'desc'), limit(100));
           const msgsSnap = await getDocs(messagesQuery);
           currentMessagesList = msgsSnap.docs.map(d => d.data() as Message);
           setMessages(currentMessagesList);
           const reqsSnap = await getDocs(collection(db, 'messageRequests'));
           currentRequestsList = reqsSnap.docs.map(d => d.data() as MessageRequest);
           setRequests(currentRequestsList);
        }
        if (activeTab === 'reports' && reports.length === 0) {
           setReports(await getAllReports());
        }
        if (activeTab === 'tickets' && tickets.length === 0) {
           setTickets(await import('../services/firebaseService').then(m => m.getAllSupportTickets()));
        }
        if (activeTab === 'notifications' && announcementHistory.length === 0) {
           setAnnouncementHistory(await getAllAnnouncements());
        }
        if (activeTab === 'audit' && auditLogs.length === 0) {
           setAuditLogs(await import('../services/firebaseService').then(m => m.getAuditLogs()));
        }
        if (activeTab === 'campaigns' && campaigns.length === 0) {
           setCampaigns(await import('../services/firebaseService').then(m => m.getCampaigns()));
        }

        if (activeTab === 'overview' && currentUserList.length > 0 && currentMessagesList.length > 0) {
          const now = Date.now();
          setActiveUsersCount(currentUserList.filter(u => u.lastActiveAt && (now - u.lastActiveAt.toMillis?.()) < 30 * 24 * 60 * 60 * 1000).length);
          
          const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return `${d.getMonth()+1}/${d.getDate()}`;
          });
          setChartData(last7Days.map(dateStr => ({
            name: dateStr,
            DAU: currentUserList.filter(u => u.lastActiveAt && new Date(u.lastActiveAt.toMillis?.()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length,
            Registrations: currentUserList.filter(u => u.createdAt && new Date(u.createdAt.toMillis?.()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length,
            Messages: currentMessagesList.filter(m => m.createdAt && new Date((m.createdAt as any).toMillis?.()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length,
            Requests: currentRequestsList.filter(r => r.createdAt && new Date((r.createdAt as any).toMillis?.()).toLocaleDateString('en-US', {month:'numeric', day:'numeric'}) === dateStr).length
          })));
        }
      } catch (error) {
        console.error("Error fetching admin data", error);
      } finally {
        setLoading(false);
      }
    };
    loadDataForTab();
  }, [isModerator, activeTab]);

  const handleUpdateUserStatus = async (uid: string, field: string, value: any) => {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', uid), { [field]: value }, { merge: true });
      setUsers(users.map(u => u.uid === uid ? { ...u, [field]: value } : u));
      if (selectedUser?.uid === uid) {
        setSelectedUser({ ...selectedUser, [field]: value });
      }

      // Log audit action
      const targetUser = users.find(u => u.uid === uid);
      let actionName = `Updated ${field} to ${value}`;
      if (field === 'isDeleted' && value === true) actionName = 'Soft Deleted User';
      if (field === 'isDeleted' && value === false) actionName = 'Restored User';
      if (field === 'isBlocked' && value === true) actionName = 'Blocked User';
      if (field === 'isBlocked' && value === false) actionName = 'Unblocked User';
      if (field === 'isPaused' && value === true) actionName = 'Paused User';
      if (field === 'isPaused' && value === false) actionName = 'Unpaused User';
      if (field === 'role') actionName = `Changed Role to ${value}`;

      await import('../services/firebaseService').then(m => m.logAuditAction({
        adminId: currentUserProfile?.uid || '',
        adminName: currentUserProfile?.displayName || 'Unknown Admin',
        action: actionName,
        targetUserId: uid,
        targetUserName: targetUser?.displayName || 'Unknown User',
        details: `${currentUserProfile?.displayName || 'Admin'} ${actionName.toLowerCase()}.`
      }));
      
      const newAuditLogs = await import('../services/firebaseService').then(m => m.getAuditLogs());
      setAuditLogs(newAuditLogs);

    } catch (error) {
      console.error("Error updating user status", error);
    }
  };

  const handleExportCsv = (usersToExport: import('../types').UserProfile[] = users) => {
    const parameters = ['UID', 'Name', 'Email', 'College', 'Degree', 'UG Degree', 'Experience in Years', 'Experience in Months', 'Competitions', 'Role', 'Status', 'Created At Date', 'Created At Time', 'Last Active Date', 'Last Active Time'];
    const userColumns = usersToExport.map(u => {
      let status = 'Active';
      if (u.isDeleted) status = 'Deleted';
      else if (u.isBlocked) status = 'Blocked';
      else if (u.isPaused) status = 'Paused';

      let totalMonths = 0;
      if (u.workExperiences && Array.isArray(u.workExperiences)) {
         u.workExperiences.forEach(we => totalMonths += (we.durationYears || 0) * 12 + (we.durationMonths || 0));
      } else if (u.experienceYears) {
         totalMonths = (u.experienceYears || 0) * 12;
      }
      const expY = Math.floor(totalMonths / 12);
      const expM = totalMonths % 12;

      const createdDateObj = u.createdAt?.toDate ? u.createdAt.toDate() : null;
      let createdDate = '';
      let createdTime = '';
      if (createdDateObj) {
          createdDate = createdDateObj.toLocaleDateString();
          createdTime = createdDateObj.toLocaleTimeString();
      }

      const activeDateObj = u.lastActiveAt?.toDate ? u.lastActiveAt.toDate() : null;
      let activeDate = '';
      let activeTime = '';
      if (activeDateObj) {
          activeDate = activeDateObj.toLocaleDateString();
          activeTime = activeDateObj.toLocaleTimeString();
      }

      return [
        u.uid,
        `"${u.displayName || ''}"`,
        u.email || '',
        `"${u.collegeName || ''}"`,
        `"${u.degree || ''}"`,
        `"${u.ugDegree || ''}"`,
        expY,
        expM,
        u.competitionCount || 0,
        u.role || 'user',
        status,
        `"${createdDate}"`,
        `"${createdTime}"`,
        `"${activeDate}"`,
        `"${activeTime}"`
      ];
    });

    const rows = [parameters.join(','), ...userColumns.map(row => row.join(','))].join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + rows;
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
        {(activeTab === 'users' || activeTab === 'database') && (
          <button 
            onClick={() => handleExportCsv(activeTab === 'database' ? getFilteredDatabaseUsers() : users)} 
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90 transition-all"
          >
            <Download className="w-4 h-4" /> {activeTab === 'database' ? 'Export Filtered CSV' : 'Export CSV'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-8">
        {[
          { id: 'overview', icon: Activity, label: 'Overview' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'database', icon: Download, label: 'Database' },
          { id: 'messages', icon: MessageSquare, label: 'Messages' },
          { id: 'campaigns', icon: Send, label: 'Targeted Campaigns' },
          { id: 'reports', icon: Flag, label: 'Reports', hasNotification: reports.some(r => r.status === 'pending') },
          { id: 'tickets', icon: AlertOctagon, label: 'Tickets', hasNotification: tickets.some(t => t.status === 'open') },
          { id: 'audit', icon: Shield, label: 'Activity Log' },
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <button onClick={() => setActiveTab('users' as any)} className="text-red-600 hover:text-red-700 text-sm font-bold mt-4 flex items-center gap-1"><BarChart2 className="w-4 h-4"/> View User Analytics</button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">MAU (30d)</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeUsersCount}</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                  <Flag className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Reports</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{reports.filter(r => r.status === 'pending').length}</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Open Tickets</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{tickets.filter(t => t.status === 'open').length}</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Retention Analytics (DAU vs MAU)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
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
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#64748b" fontSize={12} tickMargin={10} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f8fafc' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <Area type="monotone" name="DAU" dataKey="dau" stroke="#dc2626" fillOpacity={1} fill="url(#colorDAU)" strokeWidth={2} />
                    <Area type="monotone" name="Registrations" dataKey="requests" stroke="#2563eb" fillOpacity={1} fill="url(#colorReg)" strokeWidth={2} />
                    <Area type="monotone" name="Messages" dataKey="messages" stroke="#10b981" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Matching & Engagement Funnel</h3>
              <div className="flex flex-col justify-center h-[300px] gap-6">
                {[
                  { label: 'Total Users', value: users.length, color: 'bg-blue-500' },
                  { label: 'Profile Completed', value: users.filter(u => u.skills && u.skills.length > 0 && u.degree).length, color: 'bg-indigo-500' },
                  { label: 'Connection Requests Sent', value: requests.length, color: 'bg-purple-500' },
                  { label: 'Connections Accepted', value: requests.filter(r => r.status === 'accepted').length, color: 'bg-green-500' }
                ].map((step, idx, arr) => {
                  const maxVal = arr[0].value || 1;
                  const widthPct = Math.max((step.value / maxVal) * 100, 5);
                  return (
                    <div key={idx} className="relative group">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{step.label}</span>
                        <span className="text-slate-500 font-medium">{step.value}</span>
                      </div>
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${step.color}`} 
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 1, delay: idx * 0.1 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'database' && (() => {
        const filteredDB = getFilteredDatabaseUsers();

        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Download className="w-8 h-8 text-indigo-500" /> Database Explorer</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Filter and find exact user profiles for detailed targeting.</p>
              </div>
              <div className="flex gap-4">
                 <div className="bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Results</p>
                   <p className="text-xl font-black text-indigo-600">{filteredDB.length}</p>
                 </div>
              </div>
            </div>

            {/* Filter Section */}
            <div className="bg-slate-50 dark:bg-[#27272a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-8">
              {renderFiltersBlock()}
            </div>

            <div className="overflow-x-auto flex-1 min-h-0 bg-slate-50 dark:bg-[#27272a]/50 rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4" style={{minWidth: '200px'}}>User</th>
                    <th className="p-4" style={{minWidth: '100px'}}>Status</th>
                    {activeFilters.includes('degree') && <th className="p-4" style={{minWidth: '150px'}}>Degree</th>}
                    {activeFilters.includes('ugDegree') && <th className="p-4" style={{minWidth: '150px'}}>UG Degree</th>}
                    {activeFilters.includes('collegeName') && <th className="p-4" style={{minWidth: '150px'}}>College</th>}
                    {activeFilters.includes('gender') && <th className="p-4" style={{minWidth: '100px'}}>Gender</th>}
                    {activeFilters.includes('minCompetitions') && <th className="p-4" style={{minWidth: '100px'}}>Comps</th>}
                    {activeFilters.includes('workExpDuration') && <th className="p-4" style={{minWidth: '150px'}}>Experience</th>}
                    {activeFilters.includes('isFresher') && <th className="p-4" style={{minWidth: '100px'}}>Fresher</th>}
                    {activeFilters.includes('skills') && <th className="p-4" style={{minWidth: '200px'}}>Skills</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredDB.slice(0, 50).map(u => {
                    let status = 'Active';
                    if (u.isDeleted) status = 'Deleted';
                    else if (u.isBlocked) status = 'Blocked';
                    else if (u.isPaused) status = 'Paused';

                    let expText = '-';
                    if (u.workExperiences && Array.isArray(u.workExperiences) && u.workExperiences.length > 0) {
                      let totalM = 0;
                      u.workExperiences.forEach(we => totalM += ((we.durationYears || 0) * 12) + (we.durationMonths || 0));
                      const y = Math.floor(totalM / 12);
                      const m = totalM % 12;
                      expText = `${y}y ${m}m`;
                    }

                    return (
                      <tr key={u.uid} className="hover:bg-slate-100 dark:hover:bg-[#27272a] transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">{u.displayName}</div>
                          <div className="text-sm text-slate-500">{u.email}</div>
                        </td>
                        <td className="p-4">
                           <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                             status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                             status === 'Deleted' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                             'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                           }`}>{status}</span>
                        </td>
                        {activeFilters.includes('degree') && <td className="p-4 text-slate-700 dark:text-slate-300">{u.degree || '-'}</td>}
                        {activeFilters.includes('ugDegree') && <td className="p-4 text-slate-700 dark:text-slate-300">{u.ugDegree || '-'}</td>}
                        {activeFilters.includes('collegeName') && <td className="p-4 text-slate-700 dark:text-slate-300">{u.collegeName || '-'}</td>}
                        {activeFilters.includes('gender') && <td className="p-4 text-slate-700 dark:text-slate-300">{u.gender || '-'}</td>}
                        {activeFilters.includes('minCompetitions') && <td className="p-4 text-slate-700 dark:text-slate-300 text-center">{u.competitionCount || 0}</td>}
                        {activeFilters.includes('workExpDuration') && <td className="p-4 text-slate-700 dark:text-slate-300">{expText}</td>}
                        {activeFilters.includes('isFresher') && <td className="p-4 text-slate-700 dark:text-slate-300">{u.isFresher ? 'Yes' : 'No'}</td>}
                        {activeFilters.includes('skills') && <td className="p-4 text-slate-700 dark:text-slate-300 line-clamp-2">{u.skills?.join(', ') || '-'}</td>}
                      </tr>
                    );
                  })}
                  {filteredDB.length === 0 && (
                    <tr><td colSpan={2 + activeFilters.length} className="p-8 text-center text-slate-500">No users match your criteria.</td></tr>
                  )}
                  {filteredDB.length > 50 && (
                    <tr><td colSpan={2 + activeFilters.length} className="p-4 text-center text-slate-500 text-sm italic">Showing first 50 results. Use "Export Filtered CSV" to view all.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );
      })()}

      {activeTab === 'audit' && (() => {
        const filteredAuditLogs = auditLogs.filter(log => {
          if (auditFilterTime !== 'all') {
            const logTime = log.createdAt ? (typeof log.createdAt.toMillis === 'function' ? log.createdAt.toMillis() : new Date(log.createdAt).getTime()) : 0;
            if (logTime) {
               const now = Date.now();
               const diff = now - logTime;
               if (auditFilterTime === '1h' && diff > 1 * 60 * 60 * 1000) return false;
               if (auditFilterTime === '24h' && diff > 24 * 60 * 60 * 1000) return false;
               if (auditFilterTime === '7d' && diff > 7 * 24 * 60 * 60 * 1000) return false;
               if (auditFilterTime === '30d' && diff > 30 * 24 * 60 * 60 * 1000) return false;
            }
          }
          return true;
        }).sort((a, b) => {
           const timeA = a.createdAt ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
           const timeB = b.createdAt ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
           return timeB - timeA;
        });

        return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Shield className="w-8 h-8 text-slate-700 dark:text-slate-300" /> Moderation Activity Logs</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Complete history of all administrative actions taken on the platform.</p>
            </div>
            <div className="flex gap-4 items-center">
              <select 
                className="px-4 py-2 bg-slate-50 dark:bg-[#27272a] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                value={auditFilterTime}
                onChange={(e) => setAuditFilterTime(e.target.value as any)}
              >
                <option value="all">All Time</option>
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredAuditLogs.slice(0, 100).map(log => {
               const logTime = log.createdAt ? (typeof log.createdAt.toMillis === 'function' ? log.createdAt.toMillis() : new Date(log.createdAt).getTime()) : 0;
               return (
               <div key={log.id} className="p-4 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between flex-wrap gap-4 items-start">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{log.action}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Admin: <span className="text-blue-600 dark:text-blue-400 font-medium">{log.adminName}</span> • Target: <span className="font-medium">{log.targetUserName}</span>
                      </p>
                      {log.details && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                          {log.details.startsWith('Field:') 
                            ? `${log.adminName} performed "${log.action.toLowerCase()}" on user ${log.targetUserName}.` 
                            : log.details}
                        </p>
                      )}
                    </div>
                    <div className="text-slate-400 text-sm whitespace-nowrap">
                      {logTime ? new Date(logTime).toLocaleString() : 'Unknown Time'}
                    </div>
                  </div>
               </div>
            )})}
            {filteredAuditLogs.length === 0 && (
              <div className="text-center py-12 text-slate-500">No moderation activity corresponds to your criteria.</div>
            )}
          </div>
        </motion.div>
      )})}

      {activeTab === 'campaigns' && (() => {
        const filteredDB = getFilteredDatabaseUsers();
        
        return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
        >
          <div className="flex flex-col flex-wrap sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Send className="w-8 h-8 text-teal-500" /> Targeted Mass Campaigns & Nudges</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Send push notifications targeted to specific user segments.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 flex-1">
            <div className="flex flex-col gap-6">
              <div className="bg-slate-50 dark:bg-[#27272a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">1. Filter Target Audience</h3>
                {renderFiltersBlock()}
              </div>

              <div className="bg-slate-50 dark:bg-[#27272a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white">2. Select Users</h3>
                   <label className="flex items-center gap-2 cursor-pointer p-2 bg-white dark:bg-[#18181b] rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={filteredDB.length > 0 && campaignSelectedUserIds.length === filteredDB.length}
                        onChange={(e) => {
                          if (e.target.checked) setCampaignSelectedUserIds(filteredDB.map(u => u.uid));
                          else setCampaignSelectedUserIds([]);
                        }}
                      />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Select All {filteredDB.length} Users</span>
                   </label>
                </div>
                <div className="overflow-y-auto flex-1 bg-white dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-slate-700 max-h-[300px]">
                   {filteredDB.length === 0 ? (
                     <div className="p-8 text-center text-slate-500 text-sm">No users match criteria to display.</div>
                   ) : (
                     <table className="w-full text-left">
                       <thead className="sticky top-0 bg-slate-50 dark:bg-[#27272a] shadow-sm z-10 border-b border-slate-200 dark:border-slate-800">
                         <tr className="bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-500 uppercase tracking-wider">
                           <th className="p-3 w-12 text-center"></th>
                           <th className="p-3 min-w-[200px]">User</th>
                           <th className="p-3 min-w-[100px]">Status</th>
                           {activeFilters.includes('degree') && <th className="p-3 min-w-[150px]">Degree</th>}
                           {activeFilters.includes('ugDegree') && <th className="p-3 min-w-[150px]">UG Degree</th>}
                           {activeFilters.includes('collegeName') && <th className="p-3 min-w-[150px]">College</th>}
                           {activeFilters.includes('gender') && <th className="p-3 min-w-[100px]">Gender</th>}
                           {activeFilters.includes('minCompetitions') && <th className="p-3 min-w-[100px]">Comps</th>}
                           {activeFilters.includes('workExpDuration') && <th className="p-3 min-w-[150px]">Experience</th>}
                           {activeFilters.includes('isFresher') && <th className="p-3 min-w-[100px]">Fresher</th>}
                           {activeFilters.includes('skills') && <th className="p-3 min-w-[200px]">Skills</th>}
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                         {filteredDB.map(u => {
                            let status = 'Active';
                            if (u.isDeleted) status = 'Deleted';
                            else if (u.isBlocked) status = 'Blocked';
                            else if (u.isPaused) status = 'Paused';
                            let expText = '-';
                            if (u.workExperiences && Array.isArray(u.workExperiences) && u.workExperiences.length > 0) {
                              let totalM = 0;
                              u.workExperiences.forEach(we => totalM += ((we.durationYears || 0) * 12) + (we.durationMonths || 0));
                              const y = Math.floor(totalM / 12);
                              const m = totalM % 12;
                              expText = `${y}y ${m}m`;
                            }
                            return (
                           <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-[#27272a] transition-colors" onClick={() => {
                             if(campaignSelectedUserIds.includes(u.uid)) setCampaignSelectedUserIds(camp => camp.filter(id => id !== u.uid));
                             else setCampaignSelectedUserIds(camp => [...camp, u.uid]);
                           }}>
                             <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={campaignSelectedUserIds.includes(u.uid)}
                                  onChange={(e) => {
                                    if(e.target.checked) setCampaignSelectedUserIds(camp => [...camp, u.uid]);
                                    else setCampaignSelectedUserIds(camp => camp.filter(id => id !== u.uid));
                                  }}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                             </td>
                             <td className="p-3">
                               <div className="font-bold text-sm text-slate-900 dark:text-white">{u.displayName}</div>
                               <div className="text-xs text-slate-500">{u.email}</div>
                             </td>
                             <td className="p-3">
                               <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                    status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                    status === 'Deleted' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                                    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                  }`}>{status}</span>
                             </td>
                             {activeFilters.includes('degree') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{u.degree || '-'}</td>}
                             {activeFilters.includes('ugDegree') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{u.ugDegree || '-'}</td>}
                             {activeFilters.includes('collegeName') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{u.collegeName || '-'}</td>}
                             {activeFilters.includes('gender') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{u.gender || '-'}</td>}
                             {activeFilters.includes('minCompetitions') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300 text-center">{u.competitionCount || 0}</td>}
                             {activeFilters.includes('workExpDuration') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{expText}</td>}
                             {activeFilters.includes('isFresher') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{u.isFresher ? 'Yes' : 'No'}</td>}
                             {activeFilters.includes('skills') && <td className="p-3 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{u.skills?.join(', ') || '-'}</td>}
                           </tr>
                         )})}
                       </tbody>
                     </table>
                   )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-slate-50 dark:bg-[#27272a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">3. Compose & Send</h3>
                 <div className="space-y-4">
                   <div>
                     <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">Campaign Title</label>
                     <input 
                       type="text"
                       value={newCampaign.title || ''}
                       onChange={e => setNewCampaign({...newCampaign, title: e.target.value})}
                       className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                       placeholder="e.g. Invite Strategy Experts"
                     />
                   </div>
                   <div>
                     <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">Message</label>
                     <textarea
                       value={newCampaign.message || ''}
                       onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                       className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[100px]"
                       placeholder="Your targeted message..."
                     />
                   </div>
                   <button 
                    onClick={() => {
                      if(!newCampaign.title || !newCampaign.message || campaignSelectedUserIds.length === 0) return;
                      setShowCampaignConfirmModal(true);
                    }}
                    disabled={!newCampaign.title || !newCampaign.message || campaignSelectedUserIds.length === 0}
                    className="w-full py-3 px-2 sm:px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all flex flex-row justify-center items-center gap-1 sm:gap-2 disabled:opacity-50"
                   >
                     <span className="truncate">Launch ({campaignSelectedUserIds.length} <span className="hidden sm:inline">Users</span>)</span> <Send className="w-5 h-5 shrink-0" />
                   </button>
                 </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#27272a] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col flex-1 max-h-[600px] overflow-y-auto">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Past & Active Campaigns</h3>
                 <div className="space-y-4">
                   {campaigns.map(camp => {
                     const dateMillis = typeof camp.createdAt?.toMillis === 'function' ? camp.createdAt.toMillis() : new Date(camp.createdAt).getTime();
                     const dateStr = dateMillis ? new Date(dateMillis).toLocaleDateString() : '';

                     return (
                     <div key={camp.id} onClick={() => setSelectedCampaignDetails(camp)} className="p-4 sm:p-5 bg-white dark:bg-[#18181b] border-2 border-slate-200 dark:border-slate-700 rounded-xl relative cursor-pointer shadow-sm hover:shadow-md hover:border-teal-300 dark:hover:border-teal-800 transition flex flex-col w-full overflow-hidden">
                       <div className="flex justify-between items-start gap-2 mb-2 w-full pr-1">
                         <h4 className="font-bold text-slate-900 dark:text-white truncate">{camp.title}</h4>
                         <span className={`shrink-0 px-2 py-1 text-[10px] uppercase font-bold rounded-full ${camp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                           {camp.status}
                         </span>
                       </div>
                       <p className="text-sm text-slate-500 mb-2 shrink-0">Targeted: <span className="font-medium text-slate-700 dark:text-slate-300">{camp.targetUserIds?.length || 0} Users</span></p>
                       <div 
                         className="text-sm bg-slate-50 dark:bg-[#27272a] p-3 rounded-lg border border-slate-200 dark:border-slate-800 mb-4 whitespace-pre-wrap break-all sm:break-words line-clamp-3 w-full block"
                          text={camp.message}
                       />
                       <div className="flex justify-between items-center text-xs text-slate-400 w-full mt-auto">
                          <span className="truncate flex-1 mr-2">{dateStr} - By {camp.creatorName || camp.createdBy || ''}</span>
                          <div className="flex gap-3 shrink-0">
                             {camp.status === 'active' && (
                               <button onClick={async (e) => {
                                 e.stopPropagation();
                                 await import('../services/firebaseService').then(m => m.updateCampaignStatus(camp.id!, 'paused'));
                                 const refreshed = await import('../services/firebaseService').then(m => m.getCampaigns());
                                 setCampaigns(refreshed);
                               }} className="hover:text-yellow-500 text-slate-500 font-bold transition-colors flex items-center gap-1 group">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                 <span className="hidden sm:inline group-hover:text-yellow-500">Pause</span>
                               </button>
                             )}
                             {camp.status === 'paused' && (
                               <button onClick={async (e) => {
                                 e.stopPropagation();
                                 await import('../services/firebaseService').then(m => m.updateCampaignStatus(camp.id!, 'active'));
                                 const refreshed = await import('../services/firebaseService').then(m => m.getCampaigns());
                                 setCampaigns(refreshed);
                               }} className="hover:text-green-500 text-slate-500 font-bold transition-colors flex items-center gap-1 group">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                 <span className="hidden sm:inline group-hover:text-green-500">Resume</span>
                               </button>
                             )}
                             <button onClick={(e) => {
                                 e.stopPropagation();
                                 setCampaignToDelete(camp.id!);
                               }} className="hover:text-red-500 text-slate-500 font-bold transition-colors flex items-center gap-1 group">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                 <span className="hidden sm:inline group-hover:text-red-500">Delete</span>
                               </button>
                          </div>
                       </div>
                     </div>
                   );})}
                   {campaigns.length === 0 && (
                     <p className="text-slate-500 text-center py-8">No campaigns created yet.</p>
                   )}
                 </div>
              </div>
            </div>
          </div>
          
          {campaignToDelete && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                 className="bg-white dark:bg-[#18181b] p-6 rounded-2xl max-w-sm w-full shadow-2xl relative"
               >
                 <Shield className="w-12 h-12 text-red-500 mb-4" />
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Campaign?</h2>
                 <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
                   Are you sure you want to delete this campaign? This action cannot be undone.
                 </p>
                 <div className="flex gap-3">
                   <button 
                     onClick={() => setCampaignToDelete(null)}
                     className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={async () => {
                        const id = campaignToDelete;
                        setCampaignToDelete(null);
                        await import('../services/firebaseService').then(m => m.deleteCampaign(id));
                        const refreshed = await import('../services/firebaseService').then(m => m.getCampaigns());
                        setCampaigns(refreshed);
                     }}
                     className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-700 transition-all"
                   >
                     Delete
                   </button>
                 </div>
               </motion.div>
            </div>
          )}
          
          {showCampaignConfirmModal && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                 className="bg-white dark:bg-[#18181b] p-6 rounded-2xl max-w-md w-full shadow-2xl relative"
               >
                 <Shield className="w-12 h-12 text-teal-500 mb-4" />
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Confirm Campaign Launch</h2>
                 <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
                   Are you sure you want to send this push message to <strong className="text-teal-600 dark:text-teal-400">{campaignSelectedUserIds.length}</strong> selected users? They will receive an in-app popup message as soon as they log in.
                 </p>
                 <div className="flex gap-3">
                   <button 
                     onClick={() => setShowCampaignConfirmModal(false)}
                     className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={async () => {
                       setShowCampaignConfirmModal(false);
                       const { createCampaign, getCampaigns } = await import('../services/firebaseService');
                       const campData: any = {
                         title: newCampaign.title,
                         message: newCampaign.message,
                         targetUserIds: campaignSelectedUserIds,
                         sentCount: campaignSelectedUserIds.length,
                         readCount: 0,
                         cohortDetails: activeFilters.map(f => `${AVAILABLE_FILTERS.find(x => x.value === f)?.label || f}: ${filterValues[f]}`).join(', ') || 'No specific filters (sent to selected segment)',
                         status: 'active',
                         creatorId: currentUser.uid,
                         creatorName: currentUserProfile?.displayName || 'Admin'
                       };
                       await createCampaign(campData);
                       const refreshed = await getCampaigns();
                       setCampaigns(refreshed);
                       setNewCampaign({title: '', message: ''});
                       setCampaignSelectedUserIds([]);
                       showToast?.('Campaign Sent Successfully!');
                     }}
                     className="flex-1 px-4 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition shadow-md flex items-center justify-center gap-2"
                   >
                     <Send className="w-4 h-4" /> Send Now
                   </button>
                 </div>
               </motion.div>
            </div>
          )}

          {selectedCampaignDetails && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                 onClick={() => setSelectedCampaignDetails(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-[#18181b] shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#27272a]">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Send className="w-6 h-6 text-teal-600" /> Campaign Details
                  </h3>
                  <button 
                    onClick={() => setSelectedCampaignDetails(null)}
                    className="p-2 bg-slate-200 dark:bg-[#18181b] hover:bg-slate-300 dark:hover:bg-[#09090b] text-slate-500 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 md:p-8 overflow-y-auto space-y-8">
                   <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Campaign Title</h4>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedCampaignDetails.title}</p>
                      </div>
                        <div className="bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Message Body</h4>
                          <ClickableText className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap block" text={selectedCampaignDetails.message} />
                        </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-800 transition-all hover:border-teal-200 dark:hover:border-teal-900/50">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Sent</p>
                        <p className="text-3xl font-black text-teal-600">{selectedCampaignDetails.sentCount}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-800 transition-all hover:border-blue-200 dark:hover:border-blue-900/50">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Read Count</p>
                        <p className="text-3xl font-black text-blue-600">{selectedCampaignDetails.readCount || 0}</p>
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                     <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">Cohort & Metadata</h4>
                     <div className="grid grid-cols-1 gap-3 text-sm">
                       <div className="flex justify-between p-3 bg-slate-50 dark:bg-[#27272a] rounded-lg">
                         <span className="text-slate-500 font-bold">Created By</span>
                         <span className="font-bold text-slate-900 dark:text-white">{selectedCampaignDetails.creatorName}</span>
                       </div>
                       <div className="flex justify-between p-3 bg-slate-50 dark:bg-[#27272a] rounded-lg">
                         <span className="text-slate-500 font-bold">Created At</span>
                         <span className="font-bold text-slate-900 dark:text-white">{selectedCampaignDetails.createdAt ? new Date(selectedCampaignDetails.createdAt).toLocaleString() : 'Unknown'}</span>
                       </div>
                       <div className="flex justify-between p-3 bg-slate-50 dark:bg-[#27272a] rounded-lg">
                         <span className="text-slate-500 font-bold">Status</span>
                         <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-full ${selectedCampaignDetails.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                           {selectedCampaignDetails.status}
                         </span>
                       </div>
                       <div className="p-3 bg-slate-50 dark:bg-[#27272a] rounded-lg">
                         <span className="text-slate-500 font-bold mb-1 block">Cohort Filters Applied</span>
                         <span className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-relaxed inline-block bg-slate-200 dark:bg-[#18181b] p-2 rounded w-full">
                           {selectedCampaignDetails.cohortDetails || 'Manual selection (no explicit filter criteria stored)'}
                         </span>
                       </div>
                     </div>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
        );
      })()}

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
          <div className="mb-6 flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Search Users</label>
                <input 
                   type="text" 
                   placeholder="Search by name or email..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 focus:ring-2 focus:ring-red-600 text-slate-900 dark:text-slate-50 placeholder-slate-500 transition-all outline-none"
                />
             </div>
             <div className="w-full md:w-auto flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Quick Role Filter</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'all', label: 'All', icon: Users },
                    { id: 'admin', label: 'Admins', icon: ShieldCheck, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
                    { id: 'moderator', label: 'Mods', icon: Shield, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                    { id: 'user', label: 'Users', icon: UserIcon, color: 'text-slate-600 bg-slate-50 dark:bg-slate-900/20' }
                  ].map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setRoleFilter(role.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${
                        roleFilter === role.id 
                          ? (role.color || 'bg-red-600 text-white border-red-600 shadow-red-200/50')
                          : 'bg-white dark:bg-[#18181b] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-red-600'
                      }`}
                    >
                      <role.icon className="w-4 h-4" />
                      {role.label}
                    </button>
                  ))}
                </div>
             </div>
             <div className="w-full md:w-48">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Account Status</label>
                <select
                   value={statusFilter}
                   onChange={(e) => setStatusFilter(e.target.value as any)}
                   className="w-full bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 focus:ring-2 focus:ring-red-600 text-slate-900 dark:text-slate-50 transition-all outline-none cursor-pointer font-medium"
                >
                  <option value="all">All Users</option>
                  <option value="active">Active Users</option>
                  <option value="deleted">Soft Deleted</option>
                  <option value="blocked">Blocked Users</option>
                  <option value="paused">Paused Accounts</option>
                </select>
             </div>
             <div className="w-full md:w-56">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Sort By</label>
                <select
                   value={sortOrder}
                   onChange={(e) => setSortOrder(e.target.value as any)}
                   className="w-full bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 focus:ring-2 focus:ring-red-600 text-slate-900 dark:text-slate-50 transition-all outline-none cursor-pointer font-medium"
                >
                  <option value="newest">Most Recent Created</option>
                  <option value="oldest">Least Recent Created</option>
                  <option value="recent-login">Most Recent Login</option>
                  <option value="oldest-login">Least Recent Login</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                  <option value="alphabetical-desc">Alphabetical (Z-A)</option>
                </select>
             </div>
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
              .filter(u => {
                if (roleFilter === 'admin') return u.role === 'admin';
                if (roleFilter === 'moderator') return u.role === 'moderator';
                if (roleFilter === 'user') return !u.role || u.role === 'user';
                return true;
              })
              .filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
              .sort((a, b) => {
                const nameA = (a.displayName || '').toLowerCase();
                const nameB = (b.displayName || '').toLowerCase();
                
                if (sortOrder === 'alphabetical') {
                  return nameA.localeCompare(nameB);
                }
                if (sortOrder === 'alphabetical-desc') {
                  return nameB.localeCompare(nameA);
                }
                
                const getDate = (dateObj: any) => {
                  if (!dateObj) return 0;
                  return dateObj.seconds ? dateObj.seconds * 1000 : new Date(dateObj).getTime();
                };

                if (sortOrder === 'newest') {
                  return getDate(b.createdAt) - getDate(a.createdAt);
                }
                if (sortOrder === 'oldest') {
                  return getDate(a.createdAt) - getDate(b.createdAt);
                }
                if (sortOrder === 'recent-login') {
                  return getDate(b.lastActiveAt) - getDate(a.lastActiveAt);
                }
                if (sortOrder === 'oldest-login') {
                  return getDate(a.lastActiveAt) - getDate(b.lastActiveAt);
                }
                return 0;
              })
              .map(user => (
              <motion.div 
                key={user.uid} 
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedUser(user)}
                className={`flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center p-4 rounded-2xl transition-all shadow-sm cursor-pointer ${selectedUser?.uid === user.uid ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 border-2 scale-[1.01]' : 'bg-slate-50 border border-slate-100 dark:border-slate-800 dark:bg-[#27272a] hover:border-red-300 dark:hover:border-red-800'}`}
              >
                <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                  <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-xl shadow-inner">
                    {user.displayName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg text-slate-900 dark:text-white truncate">{user.displayName || 'Unknown'}</p>
                    <p className="text-sm text-slate-500 truncate">{user.email || 'No email'}</p>
                  </div>
                </div>
                
                <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-4 md:gap-6 text-sm text-slate-500 pt-3 sm:pt-0 mt-2 sm:mt-0 border-t border-slate-200 dark:border-slate-800 sm:border-0">
                  <div className="flex flex-col items-center justify-center min-w-[80px]">
                     {user.role === 'admin' ? (
                        <div className="flex flex-col items-center gap-1 text-red-600 dark:text-red-400">
                          <ShieldCheck className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Admin</span>
                        </div>
                     ) : user.role === 'moderator' ? (
                        <div className="flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Shield className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Mod</span>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
                          <UserIcon className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">User</span>
                        </div>
                     )}
                  </div>
                  <div className="text-right font-medium flex flex-wrap gap-1 justify-end">
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
          
          if (messageFilterSender) {
            const sName = sender?.displayName?.toLowerCase() || '';
            const searchSender = messageFilterSender.toLowerCase();
            if (!sName.includes(searchSender)) {
              return false;
            }
          }

          if (messageFilterReceiver) {
            const rName = receiver?.displayName?.toLowerCase() || '';
            const searchReceiver = messageFilterReceiver.toLowerCase();
            if (!rName.includes(searchReceiver)) {
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
                   placeholder="Filter by Sender" 
                   className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#27272a] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px]"
                   value={messageFilterSender}
                   onChange={(e) => setMessageFilterSender(e.target.value)}
                 />
                 <input 
                   type="text" 
                   placeholder="Filter by Receiver" 
                   className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#27272a] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px]"
                   value={messageFilterReceiver}
                   onChange={(e) => setMessageFilterReceiver(e.target.value)}
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

      {/* User Details Modal */}
      <AnimatePresence>
      {selectedUser && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 pb-24 md:pb-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-[#09090b] shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] md:max-h-[90vh]"
          >
            <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
              <button 
                onClick={() => setSelectedUser(null)} 
                className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 bg-slate-50 dark:bg-[#18181b] p-2 rounded-full transition-colors"
                id="close-user-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 md:p-8 pt-10 md:pt-12">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-10">
                <div className="w-32 h-32 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center font-bold text-5xl shadow-inner shrink-0">
                  {selectedUser.displayName.charAt(0)}
                </div>
                <div className="flex-1 text-center md:text-left space-y-4 w-full">
                  <div>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 justify-center md:justify-start">
                      <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedUser.displayName}</h3>
                      <div className="flex gap-2 justify-center md:justify-start">
                         {selectedUser.role === 'admin' && <span className="bg-red-600 text-white text-[10px] uppercase font-black px-2 py-1 rounded flex items-center gap-1 shadow-sm shadow-red-200/50"><ShieldCheck className="w-3 h-3"/> Admin</span>}
                         {selectedUser.role === 'moderator' && <span className="bg-blue-600 text-white text-[10px] uppercase font-black px-2 py-1 rounded flex items-center gap-1 shadow-sm shadow-blue-200/50"><Shield className="w-3 h-3"/> Moderator</span>}
                         {(!selectedUser.role || selectedUser.role === 'user') && <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-black px-2 py-1 rounded">Standard User</span>}
                      </div>
                    </div>
                    <p className="text-lg text-slate-500 font-medium">{selectedUser.email}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono tracking-tighter">UID: {selectedUser.uid}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                 <div className="bg-slate-50 dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-hover hover:shadow-md">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Activity className="w-4 h-4" /> Activity Logs
                    </h4>
                    <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                       <div className="flex justify-between items-center">
                         <span className="text-slate-500">Joined Platform</span>
                         <span className="font-bold text-slate-900 dark:text-white">{selectedUser.createdAt ? new Date(selectedUser.createdAt?.toDate?.() || selectedUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Unknown'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-500">Last Active</span>
                         <span className="font-bold text-slate-900 dark:text-white">{selectedUser.lastActiveAt ? new Date(selectedUser.lastActiveAt?.toDate?.() || selectedUser.lastActiveAt).toLocaleString() : 'Not recorded'}</span>
                       </div>
                       <div className="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
                       <div className="flex justify-between items-center">
                         <span>Connections Sent</span>
                         <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg text-xs font-black">{requests.filter(r => r.senderId === selectedUser.uid).length}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span>Connections Recv</span>
                         <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-lg text-xs font-black">{requests.filter(r => r.receiverId === selectedUser.uid).length}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span>Broad Messages</span>
                         <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-lg text-xs font-black">{messages.filter(m => m.senderId === selectedUser.uid).length}</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-50 dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-hover hover:shadow-md">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Users className="w-4 h-4" /> Academic & Work
                    </h4>
                    <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                       <div className="flex justify-between items-center">
                         <span className="text-slate-500">Degree/Program</span>
                         <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{selectedUser.degree || '-'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-500">College</span>
                         <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]" title={selectedUser.collegeName}>{selectedUser.collegeName || '-'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-500">Experience</span>
                         <span className="font-bold text-slate-900 dark:text-white">{selectedUser.experienceYears ? `${selectedUser.experienceYears} Years` : 'Fresher'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-500">Current Company</span>
                         <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{selectedUser.companyName || '-'}</span>
                       </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-2">Technical Skills</span>
                       <div className="flex flex-wrap gap-1.5">
                         {selectedUser.skills && selectedUser.skills.length > 0 ? selectedUser.skills.map(skill => (
                           <span key={skill} className="bg-white dark:bg-[#09090b] text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-slate-200 dark:border-slate-800">{skill}</span>
                         )) : <span className="text-xs text-slate-400 italic">No skills listed</span>}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 border-l-4 border-red-600 pl-3">Administrative Authority</h4>
                
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-100 dark:bg-[#18181b] p-5 rounded-2xl">
                   <div className="flex-1">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">Update User Authority</p>
                      <p className="text-xs text-slate-500">Grant or revoke administrative powers</p>
                   </div>
                   <select
                    value={selectedUser.role || 'user'}
                    onChange={(e) => handleUpdateUserStatus(selectedUser.uid, 'role', e.target.value as any)}
                    disabled={!isAdmin}
                    className="w-full md:w-48 p-3 rounded-xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 outline-none font-bold text-sm shadow-sm"
                  >
                    <option value="user">Standard User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-sm ${selectedUser.isPaused ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    <PauseCircle className="w-5 h-5" />
                    {selectedUser.isPaused ? 'Unpause' : 'Pause'}
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
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-sm ${selectedUser.isBlocked ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    <AlertOctagon className="w-5 h-5" />
                    {selectedUser.isBlocked ? 'Unblock' : 'Block'}
                  </button>

                  <button 
                    disabled={!isAdmin}
                    onClick={() => {
                      setConfirmAction({
                        uid: selectedUser.uid,
                        field: 'isDeleted',
                        value: !selectedUser.isDeleted as any,
                        actionName: selectedUser.isDeleted ? 'Restore Account' : 'Soft Delete Account',
                        message: `Are you sure you want to ${selectedUser.isDeleted ? 'restore' : 'delete'} this account?`
                      });
                    }}
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-sm disabled:opacity-30 ${selectedUser.isDeleted ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'}`}
                  >
                    <Trash2 className="w-5 h-5" />
                    {selectedUser.isDeleted ? 'Restore' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
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
                          <ClickableText className="font-medium text-slate-900 dark:text-slate-50 pr-20 block" text={ann.message} />
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
                    announcementHistory.filter(a => !a.active).map(ann => {
                      const dM = typeof ann.createdAt?.toMillis === 'function' ? ann.createdAt.toMillis() : (ann.createdAt?.toDate ? ann.createdAt.toDate().getTime() : new Date(ann.createdAt || Date.now()).getTime());
                      const dA = Math.floor((Date.now() - dM) / (1000 * 60 * 60 * 24));
                      const dO = new Date(dM);
                      const dS = `${String(dO.getDate()).padStart(2, '0')}/${String(dO.getMonth() + 1).padStart(2, '0')}/${dO.getFullYear()}`;

                      return (
                      <div key={ann.id} className="p-4 bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl opacity-70 group relative">
                        <ClickableText className="text-sm text-slate-700 dark:text-slate-300 pr-8 block" text={ann.message} />
                        <p className="text-xs text-slate-400 mt-2">Sent {dA} {dA === 1 ? 'day' : 'days'} ago ({dS})</p>
                      <button 
                        disabled={actingOnAnnouncementId === ann.id}
                        onClick={() => setAnnouncementToPermanentlyDelete(ann)}
                        className="absolute top-4 right-4 p-1.5 text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-md transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Permanently Delete"
                      >
                        {actingOnAnnouncementId === ann.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  )})
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

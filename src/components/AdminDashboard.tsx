import React, { useEffect, useState } from 'react';
import { UserProfile, Message, Report } from '../types';
import { MessageRequest, getAllReports, updateReportStatus, deleteReport } from '../services/firebaseService';
import { collection, getDocs, collectionGroup, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, MessageSquare, Activity, Loader2, X, AlertOctagon, PauseCircle, Trash2, Flag, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboard({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'messages' | 'reports'>('overview');

  useEffect(() => {
    if (currentUser?.email !== 'mail2tushar.jain@gmail.com') return;

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

      } catch (error) {
        console.error("Error fetching admin data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [currentUser]);

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

  if (currentUser?.email !== 'mail2tushar.jain@gmail.com') {
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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Monitor platform activity and user engagement.</p>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {(['overview', 'users', 'messages', 'reports'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`px-6 py-2.5 rounded-full font-bold capitalize whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#18181b] dark:text-slate-300 dark:hover:bg-[#27272a]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

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
              <button onClick={() => setActiveTab('users')} className="text-red-600 hover:text-red-700 text-sm font-bold mt-4 flex items-center gap-1"><BarChart2 className="w-4 h-4"/> View User Analytics</button>
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
              <button onClick={() => setActiveTab('messages')} className="text-red-600 hover:text-red-700 text-sm font-bold mt-4 flex items-center gap-1"><BarChart2 className="w-4 h-4"/> View Message Analytics</button>
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
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Connection Requests</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{requests.length}</p>
                </div>
              </div>
            </motion.div>
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
          <div className="mb-6">
             <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-md bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 focus:ring-2 focus:ring-red-600 text-slate-900 dark:text-slate-50 placeholder-slate-500 transition-all outline-none"
             />
          </div>
          <div className="overflow-y-auto flex-1 space-y-4 pr-4 cursor-pointer">
            {users.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
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

      {activeTab === 'messages' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[600px] flex flex-col"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
             <div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3"><MessageSquare className="w-8 h-8 text-green-500" /> Recent Messages</h2>
               <p className="text-slate-500 dark:text-slate-400 mt-2">Platform-wide chat activity stream</p>
             </div>
             <div className="w-full sm:w-auto bg-slate-50 dark:bg-[#27272a] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Messages Scanned</p>
                 <p className="text-xl font-black text-slate-900 dark:text-white">{messages.length}</p>
             </div>
          </div>
          <div className="overflow-y-auto flex-1 space-y-4 pr-4">
            {messages.map((msg, i) => {
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
                     <span className="text-xs font-semibold text-slate-400 bg-white dark:bg-[#18181b] px-3 py-1 rounded-full">{new Date(msg.createdAt?.toDate?.() || msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-base text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">{msg.text}</p>
                </motion.div>
              );
            })}
            {messages.length === 0 && (
              <p className="text-lg text-slate-500 text-center py-12">No messages found.</p>
            )}
          </div>
        </motion.div>
      )}

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
              
              <button 
                onClick={() => handleUpdateUserStatus(selectedUser.uid, 'isPaused', !selectedUser.isPaused)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${selectedUser.isPaused ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <PauseCircle className="w-4 h-4" />
                {selectedUser.isPaused ? 'Unpause Account' : 'Pause Account'}
              </button>
              
              <button 
                onClick={() => handleUpdateUserStatus(selectedUser.uid, 'isBlocked', !selectedUser.isBlocked)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${selectedUser.isBlocked ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <AlertOctagon className="w-4 h-4" />
                {selectedUser.isBlocked ? 'Unblock Account' : 'Block Account'}
              </button>

              <button 
                onClick={() => handleUpdateUserStatus(selectedUser.uid, 'isDeleted', !selectedUser.isDeleted)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${selectedUser.isDeleted ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'}`}
              >
                <Trash2 className="w-4 h-4" />
                {selectedUser.isDeleted ? 'Restore Account' : 'Soft Delete Account'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

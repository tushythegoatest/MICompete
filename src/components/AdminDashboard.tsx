import React, { useEffect, useState } from 'react';
import { UserProfile, Message } from '../types';
import { MessageRequest } from '../services/firebaseService';
import { collection, getDocs, collectionGroup, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, MessageSquare, Activity, Loader2, X, AlertOctagon, PauseCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboard({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Monitor platform activity and user engagement.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
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
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
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
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[500px] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Users</h2>
          </div>
          <div className="mb-4">
             <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-red-600 text-slate-900 dark:text-slate-50 placeholder-slate-500 transition-all outline-none"
             />
          </div>
          <div className="overflow-y-auto flex-1 space-y-4 pr-2 cursor-pointer">
            {users.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
              <motion.div 
                key={user.uid} 
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedUser(user)}
                className={`flex gap-4 items-center p-3 rounded-xl transition-colors ${selectedUser?.uid === user.uid ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 border' : 'hover:bg-slate-50 dark:hover:bg-[#27272a]'}`}
              >
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">
                  {user.displayName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{user.displayName}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="ml-auto text-xs font-medium space-y-1 text-right">
                  {user.isDeleted ? <div className="text-red-500">Deleted</div> : null}
                  {user.isPaused ? <div className="text-yellow-500">Paused</div> : null}
                  {user.isBlocked ? <div className="text-purple-500">Blocked</div> : null}
                  {!user.isDeleted && !user.isPaused && !user.isBlocked && <div className="text-green-500">Active</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Messages */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[500px] flex flex-col"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Recent Messages</h2>
          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            {messages.map((msg, i) => {
              const sender = users.find(u => u.uid === msg.senderId);
              const receiver = users.find(u => u.uid === msg.receiverId);
              return (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} className="p-3 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                     <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {sender?.displayName || 'Unknown'} → {receiver?.displayName || 'Unknown'}
                     </p>
                     <span className="text-[10px] text-slate-400">{new Date(msg.createdAt?.toDate?.() || msg.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{msg.text}</p>
                </motion.div>
              );
            })}
            {messages.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No messages found.</p>
            )}
          </div>
        </motion.div>
      </div>

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

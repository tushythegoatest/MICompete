import React, { useEffect, useState } from 'react';
import { UserProfile, Message, MessageRequest } from '../types';
import { collection, getDocs, collectionGroup, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, MessageSquare, Activity, Loader2 } from 'lucide-react';

export default function AdminDashboard({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Monitor platform activity and user engagement.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Messages</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{messages.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Connection Requests</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{requests.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[500px] flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Recent Users</h2>
          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            {users.slice(0, 50).map(user => (
              <div key={user.uid} className="flex gap-4 items-center p-3 hover:bg-slate-50 dark:hover:bg-[#27272a] rounded-xl transition-colors">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">
                  {user.displayName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{user.displayName}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="ml-auto text-xs text-slate-400">
                  {user.isPaused ? 'Paused' : 'Active'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[500px] flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Recent Messages</h2>
          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            {messages.map((msg, i) => {
              const sender = users.find(u => u.uid === msg.senderId);
              const receiver = users.find(u => u.uid === msg.receiverId);
              return (
                <div key={i} className="p-3 bg-slate-50 dark:bg-[#27272a] rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                     <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {sender?.displayName || 'Unknown'} → {receiver?.displayName || 'Unknown'}
                     </p>
                     <span className="text-[10px] text-slate-400">{new Date(msg.createdAt.toDate?.() || msg.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{msg.text}</p>
                </div>
              );
            })}
            {messages.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No messages found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

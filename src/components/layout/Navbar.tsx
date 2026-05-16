import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Network, MessageSquare, User, Shield, Menu, X } from 'lucide-react';
import { View } from '../../types.ts';
import { signInWithGoogle, getAllReports, getAllSupportTickets } from '../../services/firebaseService.ts';

export const Navbar = ({ 
  currentView, 
  setCurrentView, 
  currentUser, 
  userProfile,
  hasUnreadMessages 
}: any) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasAdminNotification, setHasAdminNotification] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email === 'mail2tushar.jain@gmail.com';

  useEffect(() => {
    if (isAdmin) {
      const checkAdminNotifications = async () => {
        try {
          const reports = await getAllReports();
          if (reports.some(r => r.status === 'pending')) {
            setHasAdminNotification(true);
            return;
          }
          const tickets = await getAllSupportTickets();
          if (tickets.some(t => t.status === 'open')) {
            setHasAdminNotification(true);
            return;
          }
          setHasAdminNotification(false);
        } catch (e) {
          console.error(e);
        }
      };
      checkAdminNotifications();
      // Polling or just one-off? One-off on mount is fine, maybe every minute
      const interval = setInterval(checkAdminNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const navItems = [
    ...(currentUser ? [
      { id: 'competitions', label: 'Compete', icon: Trophy },
      { id: 'teammates', label: 'Connect', icon: Network },
      { id: 'chat', label: 'Message', icon: MessageSquare, hasNotification: hasUnreadMessages },
      { id: 'profile', label: 'Profile', icon: User },
      ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield, hasNotification: hasAdminNotification }] : [])
    ] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-[#09090b]/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#27272a] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <button className="flex items-center gap-3 cursor-pointer transition-transform hover:scale-105 mr-4 lg:mr-8" onClick={() => setCurrentView('home')}>
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img src="/dark-logo.png" alt="MICompete" className="hidden dark:block h-full w-auto object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
              <img src="/light-logo.png" alt="MICompete" className="block dark:hidden h-full w-auto object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.15)]" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-50 drop-shadow-sm">MICompete</span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-12">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as View)}
                className={`relative flex items-center gap-2 lg:gap-3 text-sm lg:text-base font-semibold transition-colors ${
                  currentView === item.id ? 'text-red-600 border-b-2 border-red-600 pb-1 mt-1' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 pb-1 mt-1'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <item.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                  {item.hasNotification && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse border-2 border-white dark:border-[#09090b] box-content"></span>
                  )}
                </div>
                {item.label}
              </button>
            ))}
            {!currentUser && (
              <button 
                onClick={signInWithGoogle}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors"
              >
                Sign In with Google
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-[#09090b]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as View);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-3 text-base font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-[#18181b] rounded-md"
                >
                  <div className="relative flex items-center justify-center">
                    <item.icon className="w-5 h-5" />
                    {item.hasNotification && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse border-2 border-white dark:border-[#09090b] box-content"></span>
                    )}
                  </div>
                  {item.label}
                </button>
              ))}
              {!currentUser && (
                 <button 
                  onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }}
                  className="w-full mt-2 bg-red-600 text-white px-3 py-3 rounded-md text-base font-bold"
                >
                  Sign In with Google
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

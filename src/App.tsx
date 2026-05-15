import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  MessageSquare, 
  User, 
  Home, 
  Plus, 
  Trophy,
  LogOut,
  Menu,
  X,
  Send,
  ExternalLink,
  ChevronRight,
  Loader2,
  ThumbsUp,
  Network,
  Trash2,
  Pause,
  Briefcase
} from 'lucide-react';
import { View, UserProfile, Competition, Message, Endorsement } from './types.ts';
import { auth } from './lib/firebase.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  signInWithGoogle, 
  logout, 
  getUserProfile, 
  saveUserProfile, 
  getAllUsers, 
  sendMessage, 
  listenToMessages,
  endorseSkill,
  removeEndorsement,
  getEndorsementsForUser,
  MessageRequest,
  listenToMessageRequests,
  sendMessageRequest,
  updateMessageRequestStatus,
  checkChatExists,
  listenToTotalUnreadMessages,
  markMessagesAsRead
} from './services/firebaseService.ts';

export const formatNameForPrivacy = (currentUserUid: string | undefined, profileUid: string, rawName: string | undefined): string => {
  if (!rawName) return 'User';
  if (currentUserUid === profileUid) return rawName;
  const parts = rawName.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
};

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allTeammates, setAllTeammates] = useState<UserProfile[]>([]);
  const [activeChatUserIds, setActiveChatUserIds] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, selectedPartner]);
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  // Filters
  const [filterSkill, setFilterSkill] = useState('');
  const [filterExperience, setFilterExperience] = useState('');
  const [filterMinComps, setFilterMinComps] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'active'>('relevance');

  // Modal
  const [selectedProfileModal, setSelectedProfileModal] = useState<UserProfile | null>(null);
  const [modalEndorsements, setModalEndorsements] = useState<Endorsement[]>([]);

  const DEFAULT_PROFILE_FORM = {
    displayName: '',
    photoURL: '',
    gender: '',
    degree: '',
    ugDegree: '',
    collegeName: '',
    experienceYears: 0,
    companyName: '',
    role: '',
    workExperiences: [] as {company: string, role: string, duration?: string, durationYears?: number, durationMonths?: number}[],
    skills: '',
    competitionCount: 0,
    bio: ''
  };

  // Profile Form State
  const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE_FORM);

  const [showProfileSavedSplash, setShowProfileSavedSplash] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showDeleteProgressDialog, setShowDeleteProgressDialog] = useState(false);
  const [showPauseConfirmDialog, setShowPauseConfirmDialog] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        if (profile) {
          setProfileForm({
            displayName: profile.displayName || '',
            photoURL: profile.photoURL || user.photoURL || '',
            gender: profile.gender || '',
            degree: profile.degree || '',
            ugDegree: profile.ugDegree || '',
            collegeName: profile.collegeName || '',
            experienceYears: profile.experienceYears || 0,
            companyName: profile.companyName || '',
            role: profile.role || '',
            workExperiences: profile.workExperiences || [],
            skills: profile.skills?.join(', ') || '',
            competitionCount: profile.competitionCount || 0,
            bio: profile.bio || ''
          });
          if (profile.darkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } else {
          setProfileForm({ ...DEFAULT_PROFILE_FORM, displayName: user.displayName || '', photoURL: user.photoURL || '' });
          setCurrentView('profile');
          setIsEditingProfile(true);
        }
      } else {
        setUserProfile(null);
        setCurrentView('home');
        document.documentElement.classList.remove('dark');
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (currentView === 'teammates' || currentView === 'chat') {
      fetchTeammates();
    }
  }, [currentView]);

  useEffect(() => {
    let unsubscribe: () => void;
    if (currentView === 'chat' && currentUser && selectedPartner) {
      setIsMessagesLoading(true);
      unsubscribe = listenToMessages(currentUser.uid, selectedPartner.uid, (msgs) => {
        setChatMessages(msgs);
        setIsMessagesLoading(false);
        const hasUnread = msgs.some(m => m.receiverId === currentUser.uid && !m.isRead);
        if (hasUnread) {
          markMessagesAsRead(selectedPartner.uid, currentUser.uid);
        }
      });
    } else {
      setChatMessages([]);
    }
    return () => unsubscribe?.();
  }, [currentView, currentUser, selectedPartner]);

  useEffect(() => {
    let unsubscribeReqs: (() => void) | undefined;
    let unsubscribeUnread: (() => void) | undefined;
    if (currentUser) {
      unsubscribeReqs = listenToMessageRequests(currentUser.uid, (requests) => {
        setMessageRequests(requests);
      });
      unsubscribeUnread = listenToTotalUnreadMessages(currentUser.uid, (count) => {
        setTotalUnreadMessages(count);
      });
    }
    return () => {
      unsubscribeReqs?.();
      unsubscribeUnread?.();
    };
  }, [currentUser]);

  const fetchTeammates = async () => {
    if (!currentUser) return;
    const users = await getAllUsers();
    const teammates = users.filter(u => u.uid !== currentUser.uid);
    setAllTeammates(teammates);
    
    // Check which users have existing chats
    const activeChatsPromises = teammates.map(async (t) => {
      const hasChat = await checkChatExists(currentUser.uid, t.uid);
      return hasChat ? t.uid : null;
    });
    
    const activeChats = (await Promise.all(activeChatsPromises)).filter(Boolean) as string[];
    setActiveChatUserIds(activeChats);
  };

  const getRequestStatus = (otherId: string) => {
    if (!currentUser) return null;
    const req = messageRequests.find(r => 
      (r.senderId === currentUser.uid && r.receiverId === otherId) ||
      (r.senderId === otherId && r.receiverId === currentUser.uid)
    );
    return req ? { req, status: req.status, isSender: req.senderId === currentUser.uid } : null;
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    
    if (
      !profileForm.displayName.trim() ||
      !profileForm.degree.trim() ||
      !profileForm.ugDegree.trim() ||
      !profileForm.collegeName.trim() ||
      !profileForm.skills.trim() ||
      profileForm.competitionCount === undefined ||
      !profileForm.bio.trim()
    ) {
      alert("Please fill all mandatory fields.");
      return;
    }

    const hasInvalidExp = profileForm.workExperiences.some(e => !e.company.trim() || !e.role.trim() || (e.durationYears === undefined && e.durationMonths === undefined && (!e.duration || !e.duration.trim())));
    if (hasInvalidExp) {
       alert("Please fill all fields in your work experiences.");
       return;
    }

    const calculatedMonths = profileForm.workExperiences.reduce((sum, exp) => sum + ((exp.durationYears || 0) * 12) + (exp.durationMonths || 0), 0);
    const calculatedExperienceYears = calculatedMonths > 0 ? parseFloat((calculatedMonths / 12).toFixed(2)) : 0;

    const profileData: Omit<UserProfile, 'createdAt'> = {
      uid: currentUser.uid,
      displayName: profileForm.displayName,
      email: currentUser.email || '',
      photoURL: profileForm.photoURL || currentUser.photoURL || undefined,
      gender: profileForm.gender || undefined,
      skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean),
      degree: profileForm.degree,
      ugDegree: profileForm.ugDegree,
      collegeName: profileForm.collegeName,
      experienceYears: calculatedExperienceYears,
      companyName: calculatedExperienceYears > 0 ? profileForm.workExperiences[0]?.company : undefined,
      role: calculatedExperienceYears > 0 ? profileForm.workExperiences[0]?.role : undefined,
      workExperiences: profileForm.workExperiences,
      competitionCount: Number(profileForm.competitionCount),
      bio: profileForm.bio
    };

    // Remove undefined fields
    const cleanedProfileData = Object.fromEntries(
      Object.entries(profileData).filter(([_, v]) => v !== undefined)
    ) as Omit<UserProfile, 'createdAt'>;

    cleanedProfileData.isDeleted = false;
    cleanedProfileData.isPaused = false;

    try {
      await saveUserProfile(cleanedProfileData);
      const updatedProfile = await getUserProfile(currentUser.uid);
      setUserProfile(updatedProfile);
      setIsEditingProfile(false);
      setShowProfileSavedSplash(true);
      setTimeout(() => setShowProfileSavedSplash(false), 2500);
    } catch (err) {
      alert("Failed to save profile. Check console for details.");
    }
  };

  const handleSendMessage = async () => {
    if (!currentUser || !selectedPartner || !newMessage.trim() || isSendingMessage) return;
    setIsSendingMessage(true);
    try {
      await sendMessage(currentUser.uid, selectedPartner.uid, newMessage);
      if (!activeChatUserIds.includes(selectedPartner.uid)) {
        setActiveChatUserIds(prev => [...prev, selectedPartner.uid]);
      }
      setNewMessage('');
    } catch (err) {
      console.error(err);
      alert("Failed to send message. Please check your connection.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const openProfileModal = async (profile: UserProfile) => {
    setSelectedProfileModal(profile);
    const end = await getEndorsementsForUser(profile.uid);
    setModalEndorsements(end);
  };
  
  const handleEndorse = async (skill: string) => {
    if (!currentUser || !selectedProfileModal) return;
    const isEndorsed = modalEndorsements.some(e => e.skill === skill && e.endorserId === currentUser.uid);
    // Optimistic update
    if (isEndorsed) {
      setModalEndorsements(prev => prev.filter(e => !(e.skill === skill && e.endorserId === currentUser.uid)));
      await removeEndorsement(currentUser.uid, selectedProfileModal.uid, skill);
    } else {
      const newEnd: Endorsement = {
        endorserId: currentUser.uid,
        endorseeId: selectedProfileModal.uid,
        skill,
        createdAt: new Date()
      };
      setModalEndorsements(prev => [...prev, newEnd]);
      await endorseSkill(currentUser.uid, selectedProfileModal.uid, skill);
    }
  };

  const getFilteredTeammates = () => {
    return allTeammates.filter(tm => {
      if (filterSkill && !tm.skills?.some(s => s.toLowerCase().includes(filterSkill.toLowerCase()))) return false;
      if (filterExperience && ![tm.degree, tm.ugDegree, tm.collegeName, tm.companyName, tm.role].some(field => field?.toLowerCase().includes(filterExperience.toLowerCase()))) return false;
      if (filterMinComps && (tm.competitionCount || 0) < parseInt(filterMinComps)) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'relevance') {
        const compDiff = (b.competitionCount || 0) - (a.competitionCount || 0);
        if (compDiff !== 0) return compDiff;
        return (a.displayName || '').localeCompare(b.displayName || '');
      }
      // Since we don't have last active, we just sort by display name for 'active'
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
         alert("Image is too large. Max 500KB accepted.");
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const hasUnreadRequests = messageRequests.some(req => !req.isSender && req.status === 'pending');
  const hasUnreadMessages = totalUnreadMessages > 0;

  const navItems = [
    ...(currentUser ? [
      { id: 'competitions', label: 'Compete', icon: Trophy },
      { id: 'teammates', label: 'Connect', icon: Network },
      { id: 'chat', label: 'Message', icon: MessageSquare, hasNotification: hasUnreadRequests || hasUnreadMessages },
      { id: 'profile', label: 'Profile', icon: User },
    ] : []),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b]">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 dark:text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden transition-colors">
      {/* Mesh Gradient Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 dark:bg-red-900/20 rounded-full blur-[120px] pointer-events-none z-0 transition-colors"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-400/20 dark:bg-red-800/10 rounded-full blur-[120px] pointer-events-none z-0 transition-colors"></div>
      <div className="fixed top-[30%] left-[40%] w-[30%] h-[30%] bg-red-300/10 dark:bg-red-900/10 rounded-full blur-[100px] pointer-events-none z-0 transition-colors"></div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-[#09090b]/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#27272a] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 mr-4 lg:mr-8" onClick={() => setCurrentView('home')}>
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 5 L5 95 L95 95 Z" fill="#B32025" />
                  <line x1="5" y1="95" x2="75" y2="50" stroke="white" strokeWidth="3" strokeLinecap="square" />
                  <line x1="48" y1="67" x2="65" y2="95" stroke="white" strokeWidth="3" strokeLinecap="square" />
                </svg>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-50">MICompete</span>
            </button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id as View)}
                  className={`relative flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm font-medium transition-colors ${
                    currentView === item.id ? 'text-red-600 border-b-2 border-red-600 pb-1 mt-1' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 pb-1 mt-1'
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <item.icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {!currentUser ? (
                <div className="space-y-16">
                  {/* Pre-login Hero */}
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="text-center md:text-left md:flex items-center justify-between gap-12 py-12"
                  >
                    <div className="md:w-1/2 space-y-6">
                      <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none text-slate-900 dark:text-slate-50">
                        Compete. Connect. <span className="text-red-600">Conquer.</span>
                      </h1>
                      <p className="text-xl text-slate-700 dark:text-slate-300 max-w-lg mx-auto md:mx-0">
                        Welcome to MICompete. The ultimate platform for MICAns to meet the perfect case comp partner, and discover industry-defining case competitions.
                      </p>
                      <div className="flex justify-center md:justify-start">
                         <button 
                          onClick={signInWithGoogle}
                          className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2"
                        >
                          Join MICompete <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: false, margin: "-100px" }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="mt-12 md:mt-0 md:w-1/2 relative"
                    >
                      <div className="absolute -inset-4 bg-gradient-to-r from-red-600 to-red-500 rounded-[2rem] blur-2xl opacity-20"></div>
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 aspect-[4/3]">
                        <img 
                          src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop" 
                          alt="Business teamwork"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex items-end p-8">
                           <div className="flex items-center gap-4 bg-white dark:bg-[#09090b]/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 w-full">
                             <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                               <Trophy className="text-red-400" />
                             </div>
                             <div>
                               <div className="font-bold text-slate-900 dark:text-white text-xl">15+ events</div>
                               <div className="text-sm text-slate-700 dark:text-slate-300">are ready to be disrupted</div>
                             </div>
                           </div>
                         </div>
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Pre-login Benefits Section */}
                  <div className="grid md:grid-cols-3 gap-8 py-12 border-t border-slate-200 dark:border-slate-800 relative">
                    <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="bg-slate-50 dark:bg-[#18181b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-[#27272a] transition-colors"
                    >
                      <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-6 border border-red-200">
                        <Users className="text-red-600 w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">Find Perfect Partners</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        Search through diverse profiles to find teammates with complementary skills for your next case competition.
                      </p>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="bg-slate-50 dark:bg-[#18181b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-[#27272a] transition-colors"
                    >
                      <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6 border border-red-500/20">
                        <Trophy className="text-red-500 w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">Discover Opportunities</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        Stay updated with the latest ongoing and upcoming B-school competitions across the globe.
                      </p>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="bg-slate-50 dark:bg-[#18181b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-[#27272a] transition-colors"
                    >
                      <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6 border border-red-500/20">
                        <MessageSquare className="text-red-500 w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">Real-time Collab</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        Chat, brainstorm, and plan your strategy with potential teammates seamlessly through our built-in chat.
                      </p>
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="space-y-12">
                  {/* Post-login Hero */}
                  <div className="text-center md:text-left md:flex items-center justify-between gap-12 py-12">
                    <motion.div 
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.6 }}
                      className="md:w-1/2 space-y-6"
                    >
                      <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none text-slate-900 dark:text-slate-50">
                        Welcome back to <span className="text-red-600">MICompete</span>
                      </h1>
                      <p className="text-xl text-slate-700 dark:text-slate-300 max-w-lg">
                        Ready to conquer the next challenge? Browse active competitions or find your missing teammate.
                      </p>
                      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <button 
                          onClick={() => setCurrentView('competitions')}
                          className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                        >
                          Browse Competitions
                        </button>
                        <button 
                          onClick={() => setCurrentView('teammates')}
                          className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 px-8 py-4 rounded-xl font-bold hover:bg-slate-100 dark:bg-[#27272a] transition-colors text-slate-900 dark:text-slate-50"
                        >
                          Find Partners
                        </button>
                      </div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, x: 30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="hidden md:block md:w-1/2"
                    >
                       <div className="relative group">
                         <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                         <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 aspect-[4/3]">
                           <img 
                             src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop" 
                             alt="Collaborative meeting"
                             referrerPolicy="no-referrer"
                             className="w-full h-full object-cover"
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex items-end p-8">
                             <div className="flex items-center gap-4 bg-white dark:bg-[#09090b]/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 w-full">
                               <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                                 <Trophy className="text-red-400" />
                               </div>
                               <div>
                                 <div className="font-bold text-slate-900 dark:text-white text-xl">15+ events</div>
                                 <div className="text-sm text-slate-700 dark:text-slate-300">are ready to be disrupted</div>
                               </div>
                             </div>
                           </div>
                         </div>
                       </div>
                    </motion.div>
                  </div>

                  {/* Stats / Features */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
                    >
                      <div className="w-10 h-10 bg-slate-100 dark:bg-[#27272a] rounded-xl flex items-center justify-center mb-4 text-red-600">
                        <Search className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-50">Smart Search</h3>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">We crawl Unstop and Mettl so you don't have to. Real-time updates on active competitions.</p>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
                    >
                      <div className="w-10 h-10 bg-slate-100 dark:bg-[#27272a] rounded-xl flex items-center justify-center mb-4 text-red-600">
                        <User className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-50">Detailed Profiles</h3>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">Filter by skills, experience, and education level. Find exactly who your team needs.</p>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: false, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
                    >
                      <div className="w-10 h-10 bg-slate-100 dark:bg-[#27272a] rounded-xl flex items-center justify-center mb-4 text-red-600">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-50">Insta-Chat</h3>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">Found someone? Start chatting immediately within the app to discuss strategy.</p>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'competitions' && (
            <motion.div
              key="competitions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Explore Competitions</h2>
                  <p className="text-slate-700 dark:text-slate-300">Discover and participate in top events across these platforms.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: "Unstop", url: "https://unstop.com", desc: "Discover opportunities, participate in competitions, and get hired.", img: "https://assets.unstop.com/images/favicon.ico" },
                  { name: "Xathon Mettl", url: "https://xathon.mettl.com/", desc: "A leading platform for hackathons and coding challenges.", img: "https://devfolio.co/favicon.ico" },
                  { name: "Devfolio", url: "https://devfolio.co/", desc: "Grow through community and continuous learning with dev projects.", img: "https://devfolio.co/favicon.ico" },
                  { name: "InsideIIM", url: "https://insideiim.com/", desc: "An integral platform for MBA students and aspirants.", img: "https://insideiim.com/favicon.ico" },
                  { name: "HackerEarth", url: "https://www.hackerearth.com/", desc: "Participate in global developer hackathons and hiring challenges.", img: "https://www.hackerearth.com/favicon.ico" }
                ].map((platform, idx) => (
                  <motion.a 
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={idx} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: false, margin: "-50px" }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="flex flex-col bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:bg-slate-100 hover:dark:bg-[#27272a] transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <div className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider break-words text-left">
                        Platform
                      </div>
                      <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors" />
                    </div>
                    <h3 className="font-bold text-2xl mb-2 text-slate-900 dark:text-slate-50">{platform.name}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 flex-1">
                      {platform.desc}
                    </p>
                    <div className="flex items-center gap-2 mt-auto text-sm font-semibold text-red-600 group-hover:text-red-700 transition-colors">
                      Visit Platform <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}

          {currentView === 'teammates' && (
            <motion.div
              key="teammates"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Find Teammates</h2>
                  <p className="text-slate-700 dark:text-slate-300">Discover and connect with top B-school talent</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                   <button onClick={fetchTeammates} className="p-2 bg-slate-50 dark:bg-[#18181b] rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-[#27272a] text-slate-700 dark:text-slate-300">
                    <Search className="w-4 h-4" />
                   </button>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Search Skills</label>
                  <input 
                    type="text"
                    value={filterSkill}
                    onChange={(e) => setFilterSkill(e.target.value)}
                    placeholder="e.g. Marketing, Finance"
                    className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder-slate-500 focus:ring-1 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Experience / Ed.</label>
                  <input 
                    type="text"
                    value={filterExperience}
                    onChange={(e) => setFilterExperience(e.target.value)}
                    placeholder="e.g. McKinsey, ISB"
                    className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder-slate-500 focus:ring-1 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Min. Comps</label>
                  <input 
                    type="number"
                    value={filterMinComps}
                    onChange={(e) => setFilterMinComps(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder-slate-500 focus:ring-1 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Sort By</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'relevance' | 'active')}
                    className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:ring-1 focus:ring-red-600 outline-none appearance-none"
                  >
                    <option value="relevance">Relevance (Cases)</option>
                    <option value="active">A-Z Name</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {getFilteredTeammates().map((tm, idx) => (
                  <motion.div 
                    key={tm.uid} 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, margin: "-50px" }}
                    transition={{ duration: 0.4, delay: (idx % 3) * 0.1 }}
                    className="bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 group hover:bg-slate-100 dark:bg-[#27272a]"
                  >
                    <div className="h-24 bg-gradient-to-br from-red-600/20 to-red-500/20 opacity-50 relative cursor-pointer" onClick={() => openProfileModal(tm)}>
                       <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-xs text-slate-900 dark:text-slate-50 flex items-center gap-1 font-bold">
                          <Trophy className="w-3 h-3 text-yellow-400" /> {tm.competitionCount === 11 ? '10+' : (tm.competitionCount || 0)}
                       </div>
                    </div>
                    <div className="px-6 pb-6 -mt-10">
                      <div className="relative mb-4 cursor-pointer" onClick={() => openProfileModal(tm)}>
                        <div className="w-20 h-20 bg-white dark:bg-[#09090b] rounded-2xl border-4 border-[#0d1117] shadow-xl flex items-center justify-center font-bold text-2xl overflow-hidden">
                          {tm.photoURL ? (
                            <img src={tm.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-slate-900 dark:text-slate-50">{formatNameForPrivacy(currentUser?.uid, tm.uid, tm.displayName)?.[0]}</span>
                          )}
                        </div>
                        <div className="absolute bottom-1 right-0 w-4 h-4 bg-green-500 border-2 border-[#0d1117] rounded-full"></div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50 cursor-pointer hover:text-red-600" onClick={() => openProfileModal(tm)}>{formatNameForPrivacy(currentUser?.uid, tm.uid, tm.displayName)}</h3>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mb-0.5 font-medium uppercase tracking-wide truncate">{tm.degree || 'Current Program'}</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mb-4 font-medium uppercase tracking-wide truncate">{tm.ugDegree || 'UG Degree'}{tm.collegeName ? ` @ ${tm.collegeName}` : ''}</p>
                      
                      {tm.experienceYears && tm.experienceYears > 0 ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium tracking-wide mb-4 bg-slate-100 dark:bg-[#27272a] py-1 px-3 rounded-full w-fit mx-auto truncate max-w-[80%]">
                           <Briefcase className="w-3.5 h-3.5" /> 
                           {(() => {
                              const yrs = Math.floor(tm.experienceYears);
                              const mos = Math.round((tm.experienceYears - yrs) * 12);
                              let parts = [];
                              if (yrs > 0) parts.push(`${yrs} Yr${yrs > 1 ? 's' : ''}`);
                              if (mos > 0) parts.push(`${mos} Mo${mos > 1 ? 's' : ''}`);
                              return parts.join(' ');
                           })()}
                           {tm.role && tm.companyName && <span className="opacity-75 md:inline hidden truncate"> - {tm.role} @ {tm.companyName}</span>}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium tracking-wide mb-4 bg-slate-100 dark:bg-[#27272a] py-1 px-3 rounded-full w-fit mx-auto">
                           <Briefcase className="w-3.5 h-3.5" /> Fresher
                        </div>
                      )}
                      
                      <div className="flex flex-wrap justify-center items-center gap-2 mb-6 min-h-[3rem]">
                        {tm.skills?.slice(0, 3).map(skill => (
                          <span key={skill} className="text-[10px] bg-slate-50 dark:bg-[#18181b] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md font-bold uppercase tracking-tight text-center">
                            {skill}
                          </span>
                        ))}
                        {(tm.skills?.length || 0) > 3 && (
                          <span className="text-[10px] bg-red-500/20 text-red-700 border border-red-200 px-2 py-1 rounded-md font-bold text-center">
                            +{(tm.skills?.length || 0) - 3}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button 
                          onClick={() => openProfileModal(tm)}
                          className="flex-1 bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-slate-50 py-2 rounded-lg text-sm font-bold hover:bg-slate-100 dark:bg-[#27272a] transition-colors border border-slate-200 dark:border-slate-800"
                        >
                          View Profile
                        </button>
                        {(() => {
                          const reqStatus = getRequestStatus(tm.uid);
                          if (!reqStatus || reqStatus.status === 'rejected') {
                            return (
                              <button 
                                onClick={async () => {
                                  if (currentUser) {
                                    await sendMessageRequest(currentUser.uid, tm.uid);
                                  }
                                }}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                              >
                                <Network className="w-4 h-4" /> Connect
                              </button>
                            );
                          } else if (reqStatus.status === 'pending') {
                            if (!reqStatus.isSender) {
                               return (
                                 <div className="flex-1 flex gap-1">
                                   <button onClick={() => updateMessageRequestStatus(reqStatus.req.id, 'accepted')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-500 transition-colors">Accept</button>
                                   <button onClick={() => updateMessageRequestStatus(reqStatus.req.id, 'rejected')} className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Reject</button>
                                 </div>
                               );
                            }
                            return (
                              <button 
                                disabled
                                className="flex-1 bg-slate-200 dark:bg-[#27272a] text-slate-500 dark:text-slate-400 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                              >
                                Requested
                              </button>
                            );
                          } else {
                            return (
                              <button 
                                onClick={() => {
                                  setSelectedPartner(tm);
                                  setCurrentView('chat');
                                }}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                              >
                                <MessageSquare className="w-4 h-4" /> Message
                              </button>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {getFilteredTeammates().length === 0 && (
                  <div className="col-span-3 py-12 text-center text-slate-700 dark:text-slate-300">
                    No potential teammates found yet. Be the first to join!
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'profile' && currentUser && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-8">
                <div className="flex items-center gap-6">
                   <div className="relative group w-24 h-24 shrink-0">
                     <div className="w-full h-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-center overflow-hidden">
                       {(isEditingProfile ? profileForm.photoURL : (userProfile?.photoURL || currentUser.photoURL)) ? (
                         <img src={(isEditingProfile ? profileForm.photoURL : (userProfile?.photoURL || currentUser.photoURL)) || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       ) : (
                         <User className="text-slate-700 dark:text-slate-300 w-8 h-8" />
                       )}
                     </div>
                     {isEditingProfile && (
                       <label className="absolute inset-0 bg-black/40 text-white rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity">
                         <Plus className="w-6 h-6 mb-1" />
                         <span className="text-[10px] font-bold">Upload</span>
                         <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                       </label>
                     )}
                   </div>
                   <div className="flex-1 flex justify-between items-start">
                     <div>
                       <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{isEditingProfile ? (userProfile ? 'Update Your Profile' : 'Complete Your Profile') : 'Your Profile'}</h2>
                       <p className="text-slate-700 dark:text-slate-300 text-sm">{isEditingProfile ? 'Fill in your details to get noticed by potential teammates.' : 'Here is how your profile looks to others.'}</p>
                     </div>
                     {!isEditingProfile && (
                       <button onClick={() => setIsEditingProfile(true)} className="px-4 py-2 bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors">
                         Edit
                       </button>
                     )}
                   </div>
                </div>

                {isEditingProfile ? (
                  <>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Full Name <span className="text-red-500">*</span></label>
                          <input 
                            value={profileForm.displayName}
                            onChange={(e) => setProfileForm({...profileForm, displayName: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500" 
                            placeholder="e.g. John Doe" 
                          />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Gender</label>
                           <select
                             value={profileForm.gender}
                             onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})}
                             className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 [&>option]:bg-white dark:bg-[#09090b] [&>option]:text-slate-900 dark:text-slate-50"
                           >
                             <option value="">Select Gender</option>
                             <option value="Male">Male</option>
                             <option value="Female">Female</option>
                             <option value="Non-binary">Non-binary</option>
                             <option value="Prefer not to say">Prefer not to say</option>
                           </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Current Program <span className="text-red-500">*</span></label>
                        <select 
                          value={profileForm.degree}
                          onChange={(e) => setProfileForm({...profileForm, degree: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50"
                        >
                          <option value="">Select Program</option>
                          <option value="PGDM">PGDM</option>
                          <option value="PGDM-C">PGDM-C</option>
                          <option value="CCC">CCC</option>
                          <option value="CCE">CCE</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">UG College Name <span className="text-red-500">*</span></label>
                          <input 
                            value={profileForm.collegeName}
                            onChange={(e) => setProfileForm({...profileForm, collegeName: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500" 
                            placeholder="e.g. IIT Kharagpur" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">UG Degree <span className="text-red-500">*</span></label>
                          <input 
                            value={profileForm.ugDegree}
                            onChange={(e) => setProfileForm({...profileForm, ugDegree: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500" 
                            placeholder="e.g. B.Tech" 
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                          <div className="space-y-4 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                                Work Experiences (Max 5)
                                <span className="ml-2 lowercase font-normal italic text-slate-500 text-[10px]">
                                  {(() => {
                                    const totalMonths = profileForm.workExperiences.reduce((sum, exp) => sum + ((exp.durationYears || 0) * 12) + (exp.durationMonths || 0), 0);
                                    if (totalMonths === 0) return '';
                                    const years = Math.floor(totalMonths / 12);
                                    const months = totalMonths % 12;
                                    return `(Total: ${years > 0 ? `${years}y ` : ''}${months > 0 ? `${months}m` : ''})`;
                                  })()}
                                </span>
                              </label>
                              {profileForm.workExperiences.length < 5 && (
                                <button type="button" onClick={() => setProfileForm({...profileForm, workExperiences: [...profileForm.workExperiences, {company: '', role: '', durationYears: 0, durationMonths: 1}]})} className="text-xs text-red-600 font-bold hover:underline">
                                  + Add Experience
                                </button>
                              )}
                            </div>
                            {profileForm.workExperiences.map((exp, idx) => (
                              <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 relative group">
                                <input placeholder="Company" value={exp.company} onChange={(e) => setProfileForm({...profileForm, workExperiences: profileForm.workExperiences.map((we, i) => i === idx ? {...we, company: e.target.value} : we)})} className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50" />
                                <input placeholder="Role" value={exp.role} onChange={(e) => setProfileForm({...profileForm, workExperiences: profileForm.workExperiences.map((we, i) => i === idx ? {...we, role: e.target.value} : we)})} className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50" />
                                <div className="flex gap-2 w-full">
                                  <select value={exp.durationYears ?? 0} onChange={(e) => setProfileForm({...profileForm, workExperiences: profileForm.workExperiences.map((we, i) => i === idx ? {...we, durationYears: parseInt(e.target.value)} : we)})} className="w-1/2 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-900 dark:text-slate-50">
                                    {Array.from({length: 16}, (_, i) => <option key={i} value={i}>{i} Yrs</option>)}
                                  </select>
                                  <select value={exp.durationMonths ?? 0} onChange={(e) => setProfileForm({...profileForm, workExperiences: profileForm.workExperiences.map((we, i) => i === idx ? {...we, durationMonths: parseInt(e.target.value)} : we)})} className="w-1/2 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-900 dark:text-slate-50">
                                    {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{i} Mos</option>)}
                                  </select>
                                </div>
                                <button type="button" onClick={() => setProfileForm({...profileForm, workExperiences: profileForm.workExperiences.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-red-100 text-red-600 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pb-0.5 shadow-sm text-xs border border-red-200">
                                  x
                                </button>
                              </div>
                            ))}
                            {profileForm.workExperiences.length === 0 && (
                              <p className="text-sm text-slate-700 dark:text-slate-300 italic text-center py-2">Add at least one experience to get better visibility.</p>
                            )}
                          </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Skills (Comma separated) <span className="text-red-500">*</span></label>
                        <input 
                          value={profileForm.skills}
                          onChange={(e) => setProfileForm({...profileForm, skills: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500" 
                          placeholder="e.g. Strategy, Valuation, Design" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Case Competitions Done <span className="text-red-500">*</span></label>
                        <select
                          value={profileForm.competitionCount}
                          onChange={(e) => setProfileForm({...profileForm, competitionCount: parseInt(e.target.value) || 0})}
                          className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 [&>option]:bg-white dark:bg-[#09090b] [&>option]:text-slate-900 dark:text-slate-50"
                        >
                          {Array.from({ length: 11 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                          <option value={11}>10+</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Bio <span className="text-red-500">*</span></label>
                        <textarea 
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500" 
                          placeholder="Tell us about yourself..." 
                          rows={4}
                        ></textarea>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      {userProfile && (
                        <button 
                          onClick={() => {
                            setIsEditingProfile(false);
                            setProfileForm({
                              displayName: userProfile.displayName || '',
                              degree: userProfile.degree || '',
                              ugDegree: userProfile.ugDegree || '',
                              collegeName: userProfile.collegeName || '',
                              experienceYears: userProfile.experienceYears || 0,
                              companyName: userProfile.companyName || '',
                              role: userProfile.role || '',
                              skills: userProfile.skills?.join(', ') || '',
                              competitionCount: userProfile.competitionCount || 0,
                              bio: userProfile.bio || ''
                            });
                          }}
                          className="flex-1 bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-slate-50 py-4 rounded-xl font-bold tracking-widest text-xs hover:bg-slate-100 dark:bg-[#27272a] transition-colors uppercase border border-slate-200 dark:border-slate-800"
                        >
                          Cancel
                        </button>
                      )}
                      <button 
                        onClick={handleSaveProfile}
                        className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold tracking-widest text-xs hover:bg-red-500 transition-colors uppercase"
                      >
                        Save Profile
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Full Name</h3>
                        <p className="text-slate-900 dark:text-slate-50">{userProfile?.displayName}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Gender</h3>
                        <p className="text-slate-900 dark:text-slate-50">{userProfile?.gender || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Current Program</h3>
                        <p className="text-slate-900 dark:text-slate-50">{userProfile?.degree || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">UG College Name</h3>
                        <p className="text-slate-900 dark:text-slate-50">{userProfile?.collegeName || '-'}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">UG Degree</h3>
                        <p className="text-slate-900 dark:text-slate-50">{userProfile?.ugDegree || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Total Work Experience</h3>
                        <p className="text-slate-900 dark:text-slate-50">{userProfile?.experienceYears !== undefined && userProfile.experienceYears > 0 ? (() => {
                          const yrs = Math.floor(userProfile.experienceYears);
                          const mos = Math.round((userProfile.experienceYears - yrs) * 12);
                          let parts = [];
                          if (yrs > 0) parts.push(`${yrs} Yr${yrs > 1 ? 's' : ''}`);
                          if (mos > 0) parts.push(`${mos} Mo${mos > 1 ? 's' : ''}`);
                          return parts.join(' ');
                        })() : '-'}</p>
                      </div>
                      {userProfile?.experienceYears && userProfile.experienceYears > 0 && (!userProfile.workExperiences || userProfile.workExperiences.length === 0) ? (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Role @ Company</h3>
                          <p className="text-slate-900 dark:text-slate-50">{userProfile?.role} @ {userProfile?.companyName}</p>
                        </div>
                      ) : null}
                    </div>
                    
                    {userProfile?.workExperiences && userProfile.workExperiences.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">Work Experiences</h3>
                        <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-1.5 before:w-px before:bg-slate-200 pl-6">
                          {userProfile.workExperiences.map((exp, idx) => (
                             <div key={idx} className="relative">
                               <div className="absolute -left-[27px] top-1.5 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-sm"></div>
                               <div className="font-bold text-slate-900 dark:text-slate-50 text-sm">{exp.role}</div>
                               <div className="text-slate-700 dark:text-slate-300 text-sm">{exp.company}</div>
                               {(exp.durationYears !== undefined || exp.durationMonths !== undefined || exp.duration) && (
                                 <div className="text-slate-400 text-xs mt-0.5">
                                   {exp.durationYears !== undefined || exp.durationMonths !== undefined 
                                     ? `${exp.durationYears || 0} Yrs ${exp.durationMonths || 0} Mos` 
                                     : exp.duration}
                                 </div>
                               )}
                             </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {userProfile?.skills && userProfile.skills.length > 0 ? userProfile.skills.map((skill, i) => (
                           <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-[#27272a] text-slate-900 dark:text-slate-50 text-sm rounded-full">{skill}</span>
                        )) : <span className="text-slate-700 dark:text-slate-300">-</span>}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Case Competitions Done</h3>
                      <p className="text-slate-900 dark:text-slate-50">{userProfile?.competitionCount === 11 ? '10+' : (userProfile?.competitionCount || 0)}</p>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">Bio</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{userProfile?.bio || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
              {!isEditingProfile && (
                 <div className="bg-white dark:bg-[#09090b] backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-[#27272a] p-8 md:p-12 shadow-sm mt-8">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-6">Preferences & Settings</h2>
                    <div className="space-y-6">
                       <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#27272a]">
                         <div>
                            <div className="font-bold text-slate-900 dark:text-slate-50">Dark Mode</div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">Switch the app to a dark theme.</div>
                         </div>
                         <button 
                           onClick={async () => {
                             const newMode = !userProfile?.darkMode;
                             if(newMode) document.documentElement.classList.add('dark');
                             else document.documentElement.classList.remove('dark');
                             if(currentUser && userProfile) {
                               const updated = {...userProfile, darkMode: newMode};
                               setUserProfile(updated);
                               await saveUserProfile(updated);
                             }
                           }}
                           className={`w-12 h-6 rounded-full transition-colors relative ${userProfile?.darkMode ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                         >
                           <div className={`w-4 h-4 rounded-full bg-white dark:bg-[#09090b] absolute top-1 transition-transform ${userProfile?.darkMode ? 'translate-x-7' : 'translate-x-1'}`}></div>
                         </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#27272a]">
                         <div>
                            <div className="font-bold text-slate-900 dark:text-slate-50">Pause Account</div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">Temporarily hide your profile from others on Connect.</div>
                         </div>
                         <button 
                           onClick={async () => {
                             if (!userProfile?.isPaused) {
                               setShowPauseConfirmDialog(true);
                             } else {
                               if (currentUser && userProfile) {
                                 const updated = { ...userProfile, isPaused: false };
                                 setUserProfile(updated);
                                 await saveUserProfile(updated);
                               }
                             }
                           }}
                           className={`w-12 h-6 rounded-full transition-colors relative ${userProfile?.isPaused ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                         >
                           <div className={`w-4 h-4 rounded-full bg-white dark:bg-[#09090b] absolute top-1 transition-transform ${userProfile?.isPaused ? 'translate-x-7' : 'translate-x-1'}`}></div>
                         </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-[#27272a]">
                        <button 
                          onClick={async () => { 
                            await logout();
                            setCurrentUser(null); 
                            setUserProfile(null); 
                            setCurrentView('home'); 
                          }}
                          className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#18181b] transition-colors flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-4 h-4"/> Sign Out
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirmDialog(true)}
                          className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4"/> Delete Account
                        </button>
                      </div>
                    </div>
                 </div>
              )}
            </motion.div>
          )}

          {currentView === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-12rem)] flex bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl"
            >
              {/* Contacts Sidebar */}
              <div className="w-80 border-r border-slate-200 dark:border-slate-800 hidden md:block">
                 <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-black dark:text-slate-50">Connections & Requests</h3>
                 </div>
                 <div className="overflow-y-auto h-full pb-16">
                    {allTeammates.filter(t => {
                      const req = getRequestStatus(t.uid);
                      const hasActiveChat = activeChatUserIds.includes(t.uid);
                      
                      if (!req) return hasActiveChat; 
                      return req.status === 'accepted' || (!req.isSender && req.status === 'pending') || hasActiveChat;
                    }).map(t => (
                      <button 
                        key={t.uid} 
                        onClick={() => setSelectedPartner(t)}
                        className={`w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:bg-[#18181b] transition-colors ${selectedPartner?.uid === t.uid ? 'bg-slate-100 dark:bg-[#27272a] border-r-2 border-red-500' : ''}`}
                      >
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 text-xs flex items-center justify-center font-bold text-black dark:text-slate-50">
                             {t.photoURL ? <img src={t.photoURL} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : formatNameForPrivacy(currentUser?.uid, t.uid, t.displayName)?.[0]}
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-sm text-black dark:text-slate-50">{formatNameForPrivacy(currentUser?.uid, t.uid, t.displayName)}</div>
                              <div className="text-xs text-black dark:text-slate-300 truncate w-32">{t.degree || 'Current Program'}</div>
                           </div>
                         </div>
                         {getRequestStatus(t.uid)?.status === 'pending' && !getRequestStatus(t.uid)?.isSender && (
                           <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 animate-pulse"></div>
                         )}
                      </button>
                    ))}
                    {allTeammates.filter(t => {
                      const req = getRequestStatus(t.uid);
                      const hasActiveChat = activeChatUserIds.includes(t.uid);
                      if (!req) return hasActiveChat;
                      return req.status === 'accepted' || (!req.isSender && req.status === 'pending') || hasActiveChat;
                    }).length === 0 && <p className="p-4 text-xs text-slate-700 dark:text-slate-300">No connections yet</p>}
                 </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col h-full relative">
                 {/* background pattern */}
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                 {selectedPartner ? (
                   <>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#18181b]/80 backdrop-blur-md relative z-10">
                        <div className="flex items-center gap-3">
                          <button 
                            className="md:hidden p-2 -ml-2 text-slate-700 dark:text-slate-300 hover:text-slate-900"
                            onClick={() => setSelectedPartner(null)}
                          >
                            <ChevronRight className="w-5 h-5 rotate-180" />
                          </button>
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center font-bold text-xs text-black dark:text-slate-50">
                            {selectedPartner.photoURL ? <img src={selectedPartner.photoURL} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : formatNameForPrivacy(currentUser?.uid, selectedPartner.uid, selectedPartner.displayName)?.[0]}
                          </div>
                          <div className="flex flex-col">
                            <div className="font-bold text-sm text-black dark:text-slate-50">{formatNameForPrivacy(currentUser?.uid, selectedPartner.uid, selectedPartner.displayName)}</div>
                            <div className="text-xs text-black dark:text-slate-400">{selectedPartner.degree || 'Current Program'}</div>
                          </div>
                        </div>
                        <button onClick={() => openProfileModal(selectedPartner)} className="p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50">
                          <ChevronRight />
                        </button>
                    </div>

                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-transparent min-h-0 relative z-10">
                        {isMessagesLoading ? (
                          <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                          </div>
                        ) : (() => {
                           const req = getRequestStatus(selectedPartner.uid);
                           if (req?.status === 'pending') {
                             if (!req.isSender) {
                               return (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-4">
                                   <p className="text-sm">You have a connection request from {formatNameForPrivacy(currentUser?.uid, selectedPartner.uid, selectedPartner.displayName)}.</p>
                                   <div className="flex gap-2">
                                     <button onClick={() => updateMessageRequestStatus(req.req.id, 'accepted')} className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-green-500">Accept</button>
                                     <button onClick={() => {
                                       updateMessageRequestStatus(req.req.id, 'rejected');
                                       setSelectedPartner(null);
                                     }} className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700">Reject</button>
                                   </div>
                                 </div>
                               );
                             } else {
                               return (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-2">
                                    <Network className="w-8 h-8 opacity-20 text-slate-700 dark:text-slate-300" />
                                    <p className="text-sm">Waiting for {formatNameForPrivacy(currentUser?.uid, selectedPartner.uid, selectedPartner.displayName)} to accept your request.</p>
                                 </div>
                               );
                             }
                           }
                           return (
                             <>
                               {chatMessages.map((msg) => (
                                 <div key={msg.id} className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                                   <div className={`${msg.senderId === currentUser?.uid ? 'bg-red-600 text-white rounded-tr-none shadow-sm' : 'bg-slate-100 dark:bg-[#27272a] text-black dark:text-slate-50 border border-slate-200 dark:border-slate-800 rounded-tl-none shadow-sm'} p-4 rounded-2xl max-w-[80%] text-sm`}>
                                       {msg.text}
                                   </div>
                                 </div>
                               ))}
                               {chatMessages.length === 0 && (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-2">
                                    <MessageSquare className="w-8 h-8 opacity-10 text-slate-700 dark:text-slate-300" />
                                    <p className="text-sm">Start a conversation with {formatNameForPrivacy(currentUser?.uid, selectedPartner.uid, selectedPartner.displayName)}</p>
                                 </div>
                               )}
                               <div ref={messagesEndRef} />
                             </>
                           );
                        })()}
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-4 items-center bg-slate-50 dark:bg-[#18181b] backdrop-blur-lg relative z-10">
                        {(() => {
                           const req = getRequestStatus(selectedPartner.uid);
                           if (req?.status === 'accepted' || !req) {
                             return (
                               <>
                                 <input 
                                   value={newMessage}
                                   onChange={(e) => setNewMessage(e.target.value)}
                                   onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                   placeholder="Type a message..."
                                   readOnly={isSendingMessage}
                                   className="flex-1 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-red-600 text-slate-900 dark:text-slate-50 placeholder-slate-600 dark:placeholder-slate-400 transition-all"
                                 />
                                 <button 
                                   onClick={handleSendMessage}
                                   disabled={!newMessage.trim() || isSendingMessage}
                                   className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 transition-colors shadow-lg"
                                 >
                                   {isSendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-1" />}
                                 </button>
                               </>
                             );
                           } else if (req.status === 'pending') {
                             return (
                               <p className="text-sm text-slate-600 dark:text-slate-400 w-full text-center py-2 italic">
                                 {req.isSender ? 'Waiting for connection to be accepted...' : 'Accept request in the chat area to start messaging'}
                               </p>
                             );
                           } else {
                             return <p className="text-sm text-slate-600 dark:text-slate-400 w-full text-center py-2">Connection request rejected</p>
                           }
                        })()}
                    </div>
                   </>
                 ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-4 relative z-10">
                      <MessageSquare className="w-12 h-12 opacity-20 text-slate-700 dark:text-slate-300" />
                      <p>Select a partner to start chatting</p>
                      <button 
                        onClick={() => setCurrentView('teammates')}
                        className="text-red-600 text-sm font-bold underline hover:text-red-700"
                      >
                        Find partners
                      </button>
                   </div>
                 )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* App Bar (Mobile Only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#09090b]/80 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id as View)}
            className={`p-2 transition-colors relative ${
              currentView === item.id ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <item.icon className="w-6 h-6" />
              {item.hasNotification && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse border-2 border-white dark:border-[#09090b] box-content"></span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfileModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-8"
            >
              <button 
                onClick={() => setSelectedProfileModal(null)}
                className="absolute top-6 right-6 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 bg-slate-50 dark:bg-[#18181b] p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col md:flex-row gap-8 items-start">
                 <div className="w-32 h-32 rounded-3xl bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 flex items-center justify-center text-4xl font-bold overflow-hidden shrink-0">
                    {selectedProfileModal.photoURL ? (
                      <img src={selectedProfileModal.photoURL} alt={formatNameForPrivacy(currentUser?.uid, selectedProfileModal.uid, selectedProfileModal.displayName)} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-900 dark:text-slate-50">{formatNameForPrivacy(currentUser?.uid, selectedProfileModal.uid, selectedProfileModal.displayName)?.[0]}</span>
                    )}
                 </div>
                 <div className="space-y-4 flex-1 w-full">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-1">{formatNameForPrivacy(currentUser?.uid, selectedProfileModal.uid, selectedProfileModal.displayName)}</h2>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider flex flex-wrap gap-2 items-center">
                        <span>{selectedProfileModal.degree || 'Current Program'}</span>
                        <span className="opacity-50">•</span>
                        <span>{selectedProfileModal.ugDegree || 'UG Degree'}{selectedProfileModal.collegeName ? ` @ ${selectedProfileModal.collegeName}` : ''}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 px-3 py-1.5 rounded-lg w-fit text-sm font-bold">
                         <Trophy className="w-4 h-4" /> {selectedProfileModal.competitionCount === 11 ? '10+' : (selectedProfileModal.competitionCount || 0)} Case Competitions
                      </div>
                      
                      {selectedProfileModal.experienceYears && selectedProfileModal.experienceYears > 0 ? (
                        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg w-fit text-sm font-bold">
                           <Briefcase className="w-4 h-4" /> 
                           {(() => {
                              const yrs = Math.floor(selectedProfileModal.experienceYears);
                              const mos = Math.round((selectedProfileModal.experienceYears - yrs) * 12);
                              let parts = [];
                              if (yrs > 0) parts.push(`${yrs} Yr${yrs > 1 ? 's' : ''}`);
                              if (mos > 0) parts.push(`${mos} Mo${mos > 1 ? 's' : ''}`);
                              return parts.join(' ');
                           })()} Exp
                           {selectedProfileModal.role && selectedProfileModal.companyName ? ` (${selectedProfileModal.role} @ ${selectedProfileModal.companyName})` : ''}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-slate-500/10 border border-slate-500/20 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg w-fit text-sm font-bold">
                           <Briefcase className="w-4 h-4" /> Fresher
                        </div>
                      )}
                    </div>

                    <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedProfileModal.bio || "No bio provided."}
                    </div>

                    {selectedProfileModal.skills && selectedProfileModal.skills.length > 0 && (
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider mb-4">Skills & Endorsements</h3>
                        <div className="flex flex-col gap-3">
                          {selectedProfileModal.skills.map(skill => {
                             const skillEndorsements = modalEndorsements.filter(e => e.skill === skill);
                             const isEndorsedByMe = skillEndorsements.some(e => e.endorserId === currentUser?.uid);
                             return (
                               <div key={skill} className="flex items-center justify-between bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-slate-900 dark:text-slate-50 font-medium">{skill}</span>
                                    {skillEndorsements.length > 0 && (
                                      <span className="flex items-center gap-1 text-xs font-bold bg-red-500/20 text-red-600 px-2 py-0.5 rounded-md">
                                        <ThumbsUp className="w-3 h-3" /> {skillEndorsements.length}
                                      </span>
                                    )}
                                  </div>
                                  {currentUser && currentUser.uid !== selectedProfileModal.uid && (
                                    <button 
                                      onClick={() => handleEndorse(skill)}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        isEndorsedByMe 
                                        ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' 
                                        : 'bg-slate-50 dark:bg-[#18181b] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800'
                                      }`}
                                    >
                                      {isEndorsedByMe ? <><ThumbsUp className="w-3 h-3 fill-current" /> Endorsed</> : <><Plus className="w-3 h-3" /> Endorse</>}
                                    </button>
                                  )}
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Profile Saved Splash Screen */}
      <AnimatePresence>
        {showProfileSavedSplash && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="relative bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl overflow-hidden"
            >
              {/* Glowing effect behind icon */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-500/20 blur-[50px] rounded-full pointer-events-none" />
              
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', bounce: 0.6 }}
                className="w-16 h-16 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)] z-10"
              >
                <motion.svg 
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="w-8 h-8 text-slate-900 dark:text-slate-50" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </motion.svg>
              </motion.div>
              
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2 z-10">Profile Saved!</h2>
              <p className="text-slate-700 dark:text-slate-300 text-sm z-10 text-center max-w-[200px]">Your information has been updated successfully.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirmDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirmDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Delete Account</h3>
                  <p className="text-slate-700 dark:text-slate-300 mt-2 text-sm">
                    Are you sure you want to delete your account? This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-4">
                  <button 
                    onClick={() => setShowDeleteConfirmDialog(false)}
                    className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 font-medium rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                       setShowDeleteConfirmDialog(false);
                       setShowDeleteProgressDialog(true);
                       
                       // Simulate network process to prevent instant close
                       setTimeout(async () => {
                         if(currentUser) {
                            if (userProfile) {
                               await saveUserProfile({ ...userProfile, isDeleted: true });
                            }
                            await logout();
                         }
                         setCurrentUser(null);
                         setUserProfile(null);
                         setCurrentView('home');
                         setShowDeleteProgressDialog(false);
                       }, 2500);
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Progress Dialog */}
      <AnimatePresence>
        {showDeleteProgressDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-sm bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-4"
            >
              <Loader2 className="w-10 h-10 animate-spin text-red-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 text-center">Account deletion in progress...</h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 text-center">Please wait while we remove your data.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pause Confirmation Dialog */}
      <AnimatePresence>
        {showPauseConfirmDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPauseConfirmDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                  <Pause className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Pause Account?</h3>
                  <p className="text-slate-700 dark:text-slate-300 mt-2 text-sm">
                    Are you sure you want to pause your account? Your profile will be hidden from everyone in the Connect section.
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-4">
                  <button 
                    onClick={() => setShowPauseConfirmDialog(false)}
                    className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 font-medium rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                       setShowPauseConfirmDialog(false);
                       if (currentUser && userProfile) {
                         const updated = { ...userProfile, isPaused: true };
                         setUserProfile(updated);
                         await saveUserProfile(updated);
                       }
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition"
                  >
                    Pause
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

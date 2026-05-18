import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Briefcase,
  Shield,
  Pencil,
  Flag,
  Activity,
  Mail,
  UserMinus,
  UserPlus,
  UserCheck,
  Hourglass,
} from "lucide-react";
import {
  View,
  UserProfile,
  Competition,
  Message,
  Endorsement,
} from "./types.ts";
import { auth } from "./lib/firebase.ts";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import AdminDashboard from "./components/AdminDashboard.tsx";
import {
  signInWithGoogle,
  logout,
  getUserProfile,
  listenToUserProfile,
  saveUserProfile,
  getAllUsers,
  getPaginatedUsers,
  sendMessage,
  listenToMessages,
  endorseSkill,
  removeEndorsement,
  getEndorsementsForUser,
  MessageRequest,
  listenToMessageRequests,
  sendMessageRequest,
  updateMessageRequestStatus,
  deleteMessageRequest,
  deleteChatHistory,
  checkChatExists,
  listenToTotalUnreadMessages,
  listenToAllReceivedMessages,
  listenToAllSentMessages,
  markMessagesAsRead,
  reportUser,
  setTypingStatus,
  listenToTypingStatus,
  listenToTargetedCampaigns,
} from "./services/firebaseService.ts";

import { Navbar } from "./components/layout/Navbar.tsx";

import { useLocation, useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";

// Remove the import of 'Menu' and 'X' from 'lucide-react' if they are unused, but it's okay to leave them for now.
export const formatNameForPrivacy = (
  currentUserUid: string | undefined,
  profileUid: string,
  rawName: string | undefined,
): string => {
  if (!rawName) return "User";
  if (currentUserUid === profileUid) return rawName;
  const parts = rawName.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
};

// FIX: Replaced `any` with strict typing (`Date | { toMillis: () => number } | string | number`) and resilient object parsing to avoid runtime exceptions on invalid Date inputs.
export const formatTimeAgo = (date: Date | { toMillis: () => number } | string | number) => {
  if (!date) return "";
  const millis =
    typeof date === "object" && "toMillis" in date && typeof date.toMillis === "function"
      ? date.toMillis()
      : new Date(date as any).getTime();
  if (!millis || isNaN(millis)) return "";
  const seconds = Math.floor((new Date().getTime() - millis) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const formatMessageTime = (date: Date | { toMillis: () => number } | string | number) => {
  if (!date) return "";
  const millis =
    typeof date === "object" && "toMillis" in date && typeof date.toMillis === "function"
      ? date.toMillis()
      : new Date(date as any).getTime();
  if (!millis || isNaN(millis)) return "";

  const d = new Date(millis);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;
  return hours + ":" + minutesStr + " " + ampm;
};

export const ClickableText = ({ text, className }: { text: string; className?: string }) => {
  if (!text) return null;
  // Regex to match URLs starting with http or https
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold hover:opacity-80 transition-opacity break-all inline"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
};

export default function App() {
  const [currentView, setCurrentViewState] = useState<View>("home");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname.split("/")[1];
    if (path) {
      setCurrentViewState(path as View);
    } else {
      setCurrentViewState("home");
    }
  }, [location.pathname]);

  const setCurrentView = (view: View) => {
    setCurrentViewState(view);
    navigate(view === "home" ? "/" : `/${view}`);
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  // Replaced with React Query:
  // const [allTeammates, setAllTeammates] = useState<UserProfile[]>([]);
  // const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot | null>(null);
  // const [hasMoreTeammates, setHasMoreTeammates] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<
    import("./types").GlobalSettings | null
  >(null);
  const [announcements, setAnnouncements] = useState<
    import("./types").Announcement[]
  >([]);
  const [announcementToDismiss, setAnnouncementToDismiss] = useState<
    string | null
  >(null);

  const [userCampaigns, setUserCampaigns] = useState<import("./types").Campaign[]>([]);
  const [campaignToDismiss, setCampaignToDismiss] = useState<string | null>(null);

  const visibleAnnouncements = React.useMemo(() => {
    if (!currentUser || !userProfile) return [];
    return announcements.filter(
      (a) => a.id && !userProfile?.dismissedAnnouncements?.includes(a.id),
    );
  }, [announcements, userProfile, currentUser]);

  const visibleCampaigns = React.useMemo(() => {
    if (!currentUser || !userProfile) return [];
    return userCampaigns
      .filter((c) => c.id && !userProfile?.dismissedCampaigns?.includes(c.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [userCampaigns, userProfile, currentUser]);

  const [connectionProfiles, setConnectionProfiles] = useState<
    Record<string, UserProfile>
  >({});

  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(
    null,
  );
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, selectedPartner]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filters
  const [filterSkill, setFilterSkill] = useState("");
  const [teammatesTab, setTeammatesTab] = useState<"discover" | "requests">(
    "discover",
  );
  const [filterExperience, setFilterExperience] = useState("");
  const [filterMinComps, setFilterMinComps] = useState("");
  const [sortBy, setSortBy] = useState<"relevance" | "active">("relevance");

  // Modal
  const [selectedProfileModal, setSelectedProfileModal] =
    useState<UserProfile | null>(null);
  const [modalEndorsements, setModalEndorsements] = useState<Endorsement[]>([]);

  // Report User Dialog
  const [reportTarget, setReportTarget] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [isReportingSubmitting, setIsReportingSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const DEFAULT_PROFILE_FORM = {
    displayName: "",
    photoURL: "",
    gender: "",
    degree: "",
    ugDegree: "",
    collegeName: "",
    experienceYears: 0,
    isFresher: false,
    companyName: "",
    role: "",
    workExperiences: [] as {
      company: string;
      role: string;
      duration?: string;
      durationYears?: number;
      durationMonths?: number;
    }[],
    skills: "",
    competitionCount: 0,
    bio: "",
  };

  // Profile Form State
  const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE_FORM);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [showProfileSavedSplash, setShowProfileSavedSplash] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showSignOutConfirmDialog, setShowSignOutConfirmDialog] =
    useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showDeleteProgressDialog, setShowDeleteProgressDialog] =
    useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showPauseConfirmDialog, setShowPauseConfirmDialog] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    profile: UserProfile;
  } | null>(null);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportForm, setSupportForm] = useState<{
    title: string;
    description: string;
    type: "query" | "bug";
  }>({ title: "", description: "", type: "query" });
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  const [showMaintenancePopup, setShowMaintenancePopup] = useState(false);

  useEffect(() => {
    const isModalOpen = !!(
      selectedProfileModal ||
      reportTarget ||
      showSignOutConfirmDialog ||
      showDeleteConfirmDialog ||
      showDeleteProgressDialog ||
      showPauseConfirmDialog ||
      showUnfriendConfirm ||
      showProfileSavedSplash ||
      showSupportDialog ||
      showMaintenancePopup ||
      announcementToDismiss !== null ||
      visibleCampaigns.length > 0
    );

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = "0px"; // Prevent layout shift if possible
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [
    selectedProfileModal,
    reportTarget,
    showSignOutConfirmDialog,
    showDeleteConfirmDialog,
    showDeleteProgressDialog,
    showPauseConfirmDialog,
    showUnfriendConfirm,
    showProfileSavedSplash,
    showSupportDialog,
    showMaintenancePopup,
    announcementToDismiss,
    visibleCampaigns.length,
    userProfile,
    currentUser,
  ]);

  useEffect(() => {
    let unsubscribeAnnouncements: () => void;
    try {
      import("./services/firebaseService").then((m) => {
        m.getGlobalSettings().then(setGlobalSettings);
        unsubscribeAnnouncements = m.listenToAnnouncements(setAnnouncements);
      });
    } catch (e) {
      console.error(e);
    }
    return () => {
      if (unsubscribeAnnouncements) unsubscribeAnnouncements();
    };
  }, []);

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('quotaExceeded', handleQuotaExceeded);
    return () => window.removeEventListener('quotaExceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (user) {
        unsubscribeProfile = listenToUserProfile(user.uid, async (profile) => {
          let settings = globalSettings;
          if (!settings) {
            try {
              settings = await import("./services/firebaseService").then((m) =>
                m.getGlobalSettings(),
              );
            } catch (e) {}
          }

          if (
            settings?.maintenanceMode === true &&
            profile?.role !== "admin" &&
            user?.email !== "mail2tushar.jain@gmail.com"
          ) {
            await logout();
            setCurrentUser(null);
            setUserProfile(null);
            setIsLoading(false);
            setShowMaintenancePopup(true);
            return;
          }

          setCurrentUser(user);
          if (profile?.isBlocked) {
            await logout();
            alert(
              "Your account has been blocked. Please contact the administrator.",
            );
            return;
          }

          setUserProfile(profile);
          if (profile) {
            // Update last active time in background (throttled/debounced if needed, but here simple)
            // Note: we might want to avoid doing this on EVERY profile update if we are listening to it.
            // But usually profile updates are rare.

            setProfileForm({
              displayName: profile.displayName || "",
              photoURL: profile.photoURL || user.photoURL || "",
              gender: profile.gender || "",
              degree: profile.degree || "",
              ugDegree: profile.ugDegree || "",
              collegeName: profile.collegeName || "",
              experienceYears: profile.experienceYears || 0,
              isFresher: profile.isFresher || false,
              companyName: profile.companyName || "",
              role: profile.jobRole || "",
              workExperiences: profile.workExperiences || [],
              skills: profile.skills?.join(", ") || "",
              competitionCount: profile.competitionCount || 0,
              bio: profile.bio || "",
            });

            if (profile.darkMode) {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          } else {
            setProfileForm({
              ...DEFAULT_PROFILE_FORM,
              displayName: user.displayName || "",
              photoURL: user.photoURL || "",
            });
            setCurrentView("profile");
            setIsEditingProfile(true);
          }
          setIsLoading(false);
        });
      } else {
        setUserProfile(null);
        setCurrentUser(null);
        setUserCampaigns([]);
        setCurrentView("home");
        document.documentElement.classList.remove("dark");
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // No longer needed due to useInfiniteQuery
  // useEffect(() => {
  //   if (currentView === 'teammates' || currentView === 'chat') {
  //     // fetchTeammates();
  //   }
  // }, [currentView]);

  useEffect(() => {
    let unsubscribe: () => void;
    let typingUnsubscribe: () => void;
    if (currentView === "chat" && currentUser && selectedPartner) {
      setIsMessagesLoading(true);
      unsubscribe = listenToMessages(
        currentUser.uid,
        selectedPartner.uid,
        (msgs) => {
          setChatMessages(msgs);
          setIsMessagesLoading(false);
          const hasUnread = msgs.some(
            (m) => m.receiverId === currentUser.uid && !m.isRead,
          );
          if (hasUnread) {
            markMessagesAsRead(selectedPartner.uid, currentUser.uid);
            setReceivedMessages((prev) =>
              prev.map((m) =>
                m.senderId === selectedPartner.uid ? { ...m, isRead: true } : m,
              ),
            );
          }
        },
      );
      typingUnsubscribe = listenToTypingStatus(
        currentUser.uid,
        selectedPartner.uid,
        (isTyping) => {
          setIsPartnerTyping(isTyping);
        },
      );
    } else {
      setChatMessages([]);
      setIsPartnerTyping(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
      if (typingUnsubscribe) typingUnsubscribe();
    };
  }, [currentView, currentUser, selectedPartner]);

  useEffect(() => {
    let unsubscribeReqs: (() => void) | undefined;
    let unsubscribeUnread: (() => void) | undefined;
    let unsubscribeReceived: (() => void) | undefined;
    let unsubscribeSent: (() => void) | undefined;
    let unsubscribeCampaigns: (() => void) | undefined;

    if (currentUser) {
      setMessageRequests([]);
      setTotalUnreadMessages(0);
      setUserCampaigns([]);
      setReceivedMessages([]);
      setSentMessages([]);
      unsubscribeReqs = listenToMessageRequests(currentUser.uid, (requests) => {
        setMessageRequests(requests);
      });
      unsubscribeUnread = listenToTotalUnreadMessages(
        currentUser.uid,
        (count) => {
          setTotalUnreadMessages(count);
        },
      );
      unsubscribeCampaigns = listenToTargetedCampaigns(currentUser.uid, setUserCampaigns);
      unsubscribeReceived = listenToAllReceivedMessages(
        currentUser.uid,
        (msgs) => {
          setReceivedMessages(msgs);
        },
      );
      unsubscribeSent = listenToAllSentMessages(currentUser.uid, (msgs) => {
        setSentMessages(msgs);
      });
    }
    return () => {
      unsubscribeReqs?.();
      unsubscribeUnread?.();
      unsubscribeReceived?.();
      unsubscribeSent?.();
      unsubscribeCampaigns?.();
    };
  }, [currentUser]);

  const teammatesQuery = useInfiniteQuery({
    queryKey: ["teammates", currentUser?.uid, filterMinComps],
    initialPageParam: null as any,
    queryFn: async ({ pageParam = null as any }) => {
      if (!currentUser) return { users: [], lastDoc: null, hasMore: false };
      const { users, lastDoc } = await getPaginatedUsers(20, pageParam, {
        minComps: filterMinComps ? parseInt(filterMinComps) : undefined,
      });
      const teammates = users.filter(
        (u: UserProfile) => u.uid !== currentUser.uid,
      );
      return {
        users: teammates,
        lastDoc,
        hasMore: users.length === 20,
      };
    },
    getNextPageParam: (lastPage: {
      users: UserProfile[];
      lastDoc: any;
      hasMore: boolean;
    }) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled:
      !!currentUser && (currentView === "teammates" || currentView === "chat"),
  });

  const allTeammates: UserProfile[] =
    teammatesQuery.data?.pages.flatMap((page: any) => page.users) || [];
  const hasMoreTeammates = teammatesQuery.hasNextPage;

  const activeChatUserIds = React.useMemo(() => {
    const uids = new Set<string>();
    receivedMessages.forEach((m) => uids.add(m.senderId));
    sentMessages.forEach((m) => uids.add(m.receiverId));
    messageRequests.forEach((r) => {
      uids.add(r.senderId);
      uids.add(r.receiverId);
    });
    uids.delete(currentUser?.uid || "");
    return Array.from(uids);
  }, [receivedMessages, sentMessages, messageRequests, currentUser?.uid]);

  useEffect(() => {
    const missingUids = activeChatUserIds.filter(
      (uid) =>
        !connectionProfiles[uid] &&
        !allTeammates.some((t: UserProfile) => t.uid === uid),
    );

    if (missingUids.length > 0 && currentUser) {
      const fetchMissing = async () => {
        // Prevent concurrent fetches for the same uids or infinite loops if failed
        const newProfiles: Record<string, UserProfile | null> = {
          ...connectionProfiles,
        };
        // Pre-mark them to avoid multiple fetch triggers
        missingUids.forEach(uid => { newProfiles[uid] = null; });
        
        await Promise.all(
          missingUids.map(async (uid) => {
            try {
              const profile = await getUserProfile(uid);
              if (profile) newProfiles[uid] = profile;
            } catch (e) {}
          }),
        );
        setConnectionProfiles(newProfiles as Record<string, UserProfile>);
      };
      fetchMissing();
    }
  }, [activeChatUserIds, allTeammates, currentUser, connectionProfiles]);

  const sidebarTeammates = React.useMemo(() => {
    const teammateMap = new Map<string, UserProfile>();
    allTeammates.forEach((t: UserProfile) => teammateMap.set(t.uid, t));
    Object.values(connectionProfiles).forEach((p: UserProfile) =>
      teammateMap.set(p.uid, p),
    );
    return Array.from(teammateMap.values());
  }, [allTeammates, connectionProfiles]);

  const loadMoreTeammates = () => {
    if (teammatesQuery.hasNextPage && !teammatesQuery.isFetchingNextPage)
      teammatesQuery.fetchNextPage();
  };

  // Chat visibility logic is now derived from messages and requests
  
  const getRequestStatus = (otherId: string) => {
    if (!currentUser) return null;
    const req = messageRequests.find(
      (r) =>
        (r.senderId === currentUser.uid && r.receiverId === otherId) ||
        (r.senderId === otherId && r.receiverId === currentUser.uid),
    );
    return req
      ? { req, status: req.status, isSender: req.senderId === currentUser.uid }
      : null;
  };

  const handleSaveProfile = async () => {
    // FIX: Added `isSavingProfile` check to prevent race conditions and multiple rapid network requests.
    if (!currentUser || isSavingProfile) return;

    setProfileError("");
    setIsSavingProfile(true);
    if (
      !profileForm.displayName.trim() ||
      !profileForm.degree.trim() ||
      !profileForm.ugDegree.trim() ||
      !profileForm.collegeName.trim() ||
      !profileForm.skills.trim() ||
      profileForm.competitionCount === undefined ||
      !profileForm.bio.trim()
    ) {
      setProfileError("Please fill all mandatory fields.");
      setIsSavingProfile(false);
      return;
    }

    const validWorkExperiences = profileForm.workExperiences.filter(
      (e) => e.company.trim() || e.role.trim(),
    );
    const hasInvalidExp = validWorkExperiences.some(
      (e) => !e.company.trim() || !e.role.trim(),
    );
    if (hasInvalidExp) {
      setProfileError(
        "Please fill both Company and Role for all work experiences, or remove empty ones.",
      );
      setIsSavingProfile(false);
      return;
    }

    const calculatedMonths = validWorkExperiences.reduce(
      (sum, exp) =>
        sum + (exp.durationYears || 0) * 12 + (exp.durationMonths || 0),
      0,
    );
    const calculatedExperienceYears =
      calculatedMonths > 0 ? parseFloat((calculatedMonths / 12).toFixed(2)) : 0;

    const profileData: Omit<UserProfile, "createdAt"> = {
      uid: currentUser.uid,
      displayName: profileForm.displayName,
      email: currentUser.email || "",
      photoURL: profileForm.photoURL || currentUser.photoURL || undefined,
      gender: profileForm.gender || undefined,
      skills: profileForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      degree: profileForm.degree,
      ugDegree: profileForm.ugDegree,
      collegeName: profileForm.collegeName,
      experienceYears: profileForm.isFresher ? 0 : calculatedExperienceYears,
      isFresher: profileForm.isFresher,
      companyName:
        !profileForm.isFresher && calculatedExperienceYears > 0
          ? validWorkExperiences[0]?.company
          : undefined,
      jobRole:
        !profileForm.isFresher && calculatedExperienceYears > 0
          ? validWorkExperiences[0]?.role
          : undefined,
      workExperiences: profileForm.isFresher ? [] : validWorkExperiences,
      competitionCount: Number(profileForm.competitionCount),
      bio: profileForm.bio,
    };

    // Remove undefined fields
    const cleanedProfileData = Object.fromEntries(
      Object.entries(profileData).filter(([_, v]) => v !== undefined),
    ) as Omit<UserProfile, "createdAt">;

    cleanedProfileData.isDeleted = false;
    cleanedProfileData.isPaused = false;

    try {
      if (
        !userProfile &&
        globalSettings?.maxUsers &&
        globalSettings.maxUsers > 0
      ) {
        const { collection, getCountFromServer } =
          await import("firebase/firestore");
        const { db } = await import("./lib/firebase");
        const coll = collection(db, "users");
        const snapshot = await getCountFromServer(coll);
        if (snapshot.data().count >= globalSettings.maxUsers) {
          setProfileError(
            `Registration is currently limited to ${globalSettings.maxUsers} users. Please try again later.`,
          );
          setIsSavingProfile(false);
          return;
        }
      }

      await saveUserProfile(cleanedProfileData);
      const updatedProfile = await getUserProfile(currentUser.uid);
      setUserProfile(updatedProfile);
      setIsEditingProfile(false);
      setShowProfileSavedSplash(true);
      setTimeout(() => setShowProfileSavedSplash(false), 2500);
    } catch (err: any) {
      console.error("Profile save error:", err);
      setProfileError(`Failed to save: ${err.message || "Check console"}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendMessage = async () => {
    if (
      !currentUser ||
      !selectedPartner ||
      !newMessage.trim() ||
      isSendingMessage
    )
      return;
    setIsSendingMessage(true);
    try {
      await sendMessage(currentUser.uid, selectedPartner.uid, newMessage);
      setTypingStatus(currentUser.uid, selectedPartner.uid, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setNewMessage("");
    } catch (err) {
      console.error(err);
      alert("Failed to send message. Please check your connection.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!currentUser || !selectedPartner) return;

    setTypingStatus(currentUser.uid, selectedPartner.uid, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(currentUser.uid, selectedPartner.uid, false);
    }, 2000);
  };

  const openProfileModal = async (profile: UserProfile) => {
    setSelectedProfileModal(profile);
    const end = await getEndorsementsForUser(profile.uid);
    setModalEndorsements(end);
  };

  const handleEndorse = async (skill: string) => {
    if (!currentUser || !selectedProfileModal) return;
    const isEndorsed = modalEndorsements.some(
      (e) => e.skill === skill && e.endorserId === currentUser.uid,
    );
    // Optimistic update
    if (isEndorsed) {
      setModalEndorsements((prev) =>
        prev.filter(
          (e) => !(e.skill === skill && e.endorserId === currentUser.uid),
        ),
      );
      await removeEndorsement(currentUser.uid, selectedProfileModal.uid, skill);
    } else {
      const newEnd: Endorsement = {
        endorserId: currentUser.uid,
        endorseeId: selectedProfileModal.uid,
        skill,
        createdAt: new Date(),
      };
      setModalEndorsements((prev) => [...prev, newEnd]);
      await endorseSkill(currentUser.uid, selectedProfileModal.uid, skill);
    }
  };

  const getFilteredTeammates = () => {
    return allTeammates
      .filter((tm) => {
        if (
          filterSkill &&
          !tm.skills?.some((s) =>
            s.toLowerCase().includes(filterSkill.toLowerCase()),
          )
        )
          return false;
        if (
          filterExperience &&
          ![
            tm.degree,
            tm.ugDegree,
            tm.collegeName,
            tm.companyName,
            tm.jobRole,
          ].some((field) =>
            field?.toLowerCase().includes(filterExperience.toLowerCase()),
          )
        )
          return false;
        if (
          filterMinComps &&
          (tm.competitionCount || 0) < parseInt(filterMinComps)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "relevance") {
          const compDiff =
            (b.competitionCount || 0) - (a.competitionCount || 0);
          if (compDiff !== 0) return compDiff;
          return (a.displayName || "").localeCompare(b.displayName || "");
        }
        // Since we don't have last active, we just sort by display name for 'active'
        return (a.displayName || "").localeCompare(b.displayName || "");
      });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setProfileError("Image is too large. Max 500KB accepted.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm((prev) => ({
          ...prev,
          photoURL: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const hasUnreadRequests = messageRequests.some(
    (req) => !req.isSender && req.status === "pending",
  );
  const hasUnreadMessages = totalUnreadMessages > 0;
  const hasConnectionRequests =
    messageRequests.filter(
      (r) => r.receiverId === currentUser?.uid && r.status === "pending",
    ).length > 0;

  const isAdmin =
    userProfile?.role === "admin" ||
    currentUser?.email === "mail2tushar.jain@gmail.com";

  const navItems = [
    ...(currentUser
      ? [
          { id: "competitions", label: "Compete", icon: Trophy },
          { id: "teammates", label: "Connect", icon: Network },
          {
            id: "chat",
            label: "Message",
            icon: MessageSquare,
            hasNotification: hasUnreadMessages,
          },
          { id: "profile", label: "Profile", icon: User },
          ...(isAdmin ? [{ id: "admin", label: "Admin", icon: Shield }] : []),
        ]
      : []),
  ];

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setTimeout(async () => {
      await logout();
      setCurrentUser(null);
      setUserProfile(null);
      setUserCampaigns([]);
      setCampaignToDismiss(null);
      setAnnouncementToDismiss(null);
      setCurrentView("home");
      setIsSigningOut(false);
    }, 1920);
  };

  if (quotaExceeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b] px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-lg w-full bg-white dark:bg-[#18181b] rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-100 dark:border-slate-800"
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.8, 1, 0.8] 
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-8 relative"
          >
            <div className="absolute inset-0 bg-red-100 dark:bg-red-900/30 rounded-full animate-ping opacity-20 duration-1000"></div>
            <motion.div
              animate={{ rotate: [0, 720, 900] }}
              transition={{
                duration: 5,
                times: [0, 0.4, 1],
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{ willChange: "transform" }}
              className="relative z-10 flex items-center justify-center transform-gpu"
            >
              <Hourglass className="w-10 h-10 text-red-600 dark:text-red-500" />
            </motion.div>
          </motion.div>
          
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-3">
            User Limit Exceeded
          </h2>
          <p className="text-lg md:text-xl font-medium text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Please login tomorrow- the daily user limit has exceeded our current capabilities.
          </p>
          
          <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 text-left">
            <p className="text-sm dark:text-slate-300 text-slate-700 leading-relaxed font-medium">
              <span className="font-bold text-red-700 dark:text-red-400 block mb-2">Thanks for supporting MICompete!</span>
              As a free app, we can only process a limited number of sessions before the user limit needs to refresh. Please login tomorrow to access the app. This issue is being addressed. We sincerely apologize for any inconvenience caused.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b]">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 dark:text-red-500" />
      </div>
    );
  }

  if (isSigningOut) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#09090b]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <Loader2 className="w-12 h-12 text-red-600 animate-spin" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Signing out...
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            You are now being signed out. Please wait.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-slate-900 dark:text-slate-100 font-sans relative transition-colors">
      {/* Mesh Gradient Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 dark:bg-red-900/20 rounded-full blur-[120px] pointer-events-none z-0 transition-colors"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-400/20 dark:bg-red-800/10 rounded-full blur-[120px] pointer-events-none z-0 transition-colors"></div>
      <div className="fixed top-[30%] left-[40%] w-[30%] h-[30%] bg-red-300/10 dark:bg-red-900/10 rounded-full blur-[100px] pointer-events-none z-0 transition-colors"></div>

      {/* Announcement Banners */}
      <div className="relative z-50">
        {visibleAnnouncements.map((announcement) => (
          <div
            key={announcement.id}
            className="bg-red-600 text-white px-4 py-3 sm:px-6 lg:px-8 shadow-md flex items-center justify-center relative"
          >
            <div className="text-sm font-medium text-center pr-8">
              <span className="font-bold uppercase tracking-wider mr-2">
                Announcement:
              </span>
              <ClickableText text={announcement.message} />
            </div>
            {currentUser && announcement.id && (
              <button
                onClick={() =>
                  setAnnouncementToDismiss(announcement.id as string)
                }
                className="absolute right-4 p-1 hover:bg-red-700 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentUser={currentUser}
        userProfile={userProfile}
        hasUnreadMessages={hasUnreadMessages}
        hasConnectionRequests={hasConnectionRequests}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentView === "home" && (
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
                    className="text-center md:text-left md:flex items-center justify-between gap-12 py-12 lg:py-24"
                  >
                    <div className="md:w-1/2 space-y-6">
                      <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none text-slate-900 dark:text-slate-50">
                        Compete. Connect.{" "}
                        <span className="text-red-500">Conquer.</span>
                      </h1>
                      <p className="text-xl text-slate-700 dark:text-slate-300 max-w-lg mx-auto md:mx-0">
                        Welcome to MICompete. The ultimate platform for MICAns
                        to meet the perfect case comp partner, and discover
                        industry-defining case competitions.
                      </p>
                      <div className="flex justify-center md:justify-start">
                        <button
                          onClick={signInWithGoogle}
                          className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center gap-2 group"
                        >
                          Join MICompete{" "}
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: false, margin: "-100px" }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="mt-16 md:mt-0 md:w-1/2 relative"
                    >
                      <div className="absolute -inset-4 bg-gradient-to-r from-red-600 to-red-400 rounded-[2.5rem] blur-2xl opacity-20 animate-pulse"></div>
                      <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 aspect-[4/3] group">
                        <motion.img
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.7 }}
                          src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop"
                          alt="Business teamwork"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex items-end p-6 md:p-8">
                          <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            whileInView={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center gap-4 bg-white/10 dark:bg-[#09090b]/40 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/20 w-full"
                          >
                            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                              <Trophy className="text-red-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-xl">
                                15+ events
                              </div>
                              <div className="text-sm text-slate-200">
                                are ready to be disrupted
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Floating Badges */}
                      <motion.div
                        animate={{ y: [-10, 10, -10] }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="absolute -left-4 md:-left-8 top-1/4 bg-white dark:bg-[#18181b] p-3 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 z-10"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                          <span className="text-sm">JD</span>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-50 leading-tight">
                            Data Analyst
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Looking for a Strategist
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        animate={{ y: [10, -10, 10] }}
                        transition={{
                          duration: 5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="absolute -right-4 md:-right-8 bottom-1/3 bg-white dark:bg-[#18181b] p-3 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 z-10"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold shrink-0">
                          <span className="text-sm">AS</span>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-50 leading-tight">
                            Storyteller
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Connect to win
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="absolute -top-4 -right-4 bg-red-600 text-white rounded-full p-3 shadow-lg z-10"
                      >
                        <Activity className="w-5 h-5" />
                      </motion.div>
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
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
                        Find Perfect Partners
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        Search through diverse profiles to find teammates with
                        complementary skills for your next case competition.
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
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
                        Discover Opportunities
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        Stay updated with the latest ongoing and upcoming
                        B-school competitions across the globe.
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
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
                        Real-time Collab
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        Chat, brainstorm, and plan your strategy with potential
                        teammates seamlessly through our built-in chat.
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
                        Welcome back to{" "}
                        <span className="text-red-600">MICompete</span>
                      </h1>
                      <p className="text-xl text-slate-700 dark:text-slate-300 max-w-lg">
                        Ready to conquer the next challenge? Browse active
                        competitions or find your missing teammate.
                      </p>
                      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <button
                          onClick={() => setCurrentView("competitions")}
                          className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                        >
                          Browse Competitions
                        </button>
                        <button
                          onClick={() => setCurrentView("teammates")}
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
                                <div className="font-bold text-slate-900 dark:text-white text-xl">
                                  15+ events
                                </div>
                                <div className="text-sm text-slate-700 dark:text-slate-300">
                                  are ready to be disrupted
                                </div>
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
                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-50">
                        Direct Host Connection
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">
                        Connect directly with the platforms where events are
                        hosted. Seamlessly jump to the action.
                      </p>
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
                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-50">
                        Detailed Profiles
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">
                        Filter by skills, experience, and education level. Find
                        exactly who your team needs.
                      </p>
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
                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-50">
                        Insta-Chat
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">
                        Found someone? Start chatting immediately within the app
                        to discuss strategy.
                      </p>
                    </motion.div>
                  </div>
                </div>
              )}
              <div className="mt-16 pb-8 text-center text-sm text-slate-500 dark:text-slate-400 font-medium">
                Developed by tushythegoatest. All wrongs reserved.
              </div>
            </motion.div>
          )}

          {currentView === "competitions" && (
            <motion.div
              key="competitions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    Explore Competitions
                  </h2>
                  <p className="text-slate-700 dark:text-slate-300">
                    Discover and participate in top events across these
                    platforms.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    name: "Unstop",
                    url: "https://unstop.com/competitions?oppstatus=open&usertype=corporate",
                    desc: "Discover opportunities, participate in competitions, and get hired.",
                    img: "https://assets.unstop.com/images/favicon.ico",
                  },
                  {
                    name: "Xathon Mettl",
                    url: "https://xathon.mettl.com/",
                    desc: "A leading platform for hackathons and coding challenges.",
                    img: "https://devfolio.co/favicon.ico",
                  },
                  {
                    name: "Devfolio",
                    url: "https://devfolio.co/",
                    desc: "Grow through community and continuous learning with dev projects.",
                    img: "https://devfolio.co/favicon.ico",
                  },
                  {
                    name: "InsideIIM",
                    url: "https://insideiim.com/",
                    desc: "An integral platform for MBA students and aspirants.",
                    img: "https://insideiim.com/favicon.ico",
                  },
                  {
                    name: "HackerEarth",
                    url: "https://www.hackerearth.com/challenges/hackathon/",
                    desc: "Participate in global developer hackathons and hiring challenges.",
                    img: "https://www.hackerearth.com/favicon.ico",
                  },
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
                    <h3 className="font-bold text-2xl mb-2 text-slate-900 dark:text-slate-50">
                      {platform.name}
                    </h3>
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

          {currentView === "teammates" && (
            <motion.div
              key="teammates"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {globalSettings?.matchingEnabled === false ? (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 flex items-center justify-center rounded-2xl mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-2">
                    Matching is Disabled
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 max-w-md">
                    The platform admin has temporarily disabled teammate
                    matching. Please check back later.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                        Find Teammates
                      </h2>
                      <p className="text-slate-700 dark:text-slate-300">
                        Discover and connect with top B-school talent
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button
                        onClick={() => teammatesQuery.refetch()}
                        className="p-2 bg-slate-50 dark:bg-[#18181b] rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-[#27272a] text-slate-700 dark:text-slate-300"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 relative w-full mb-6 max-w-full overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setTeammatesTab("discover")}
                      className={`pb-3 text-sm font-bold tracking-wide uppercase transition-colors whitespace-nowrap relative ${teammatesTab === "discover" ? "text-slate-900 dark:text-slate-50" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                    >
                      Discover
                      {teammatesTab === "discover" && (
                        <motion.div
                          layoutId="teammatesTabLine"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"
                        />
                      )}
                    </button>
                    <button
                      onClick={() => setTeammatesTab("requests")}
                      className={`pb-3 text-sm font-bold tracking-wide uppercase transition-colors whitespace-nowrap relative flex items-center gap-2 ${teammatesTab === "requests" ? "text-slate-900 dark:text-slate-50" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                    >
                      Requests
                      {messageRequests.filter(
                        (r) =>
                          r.receiverId === currentUser?.uid &&
                          r.status === "pending",
                      ).length > 0 && (
                        <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          {
                            messageRequests.filter(
                              (r) =>
                                r.receiverId === currentUser?.uid &&
                                r.status === "pending",
                            ).length
                          }
                        </span>
                      )}
                      {teammatesTab === "requests" && (
                        <motion.div
                          layoutId="teammatesTabLine"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"
                        />
                      )}
                    </button>
                  </div>

                  {teammatesTab === "discover" ? (
                    <>
                      {/* Filters */}
                      <div className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                            Search Skills
                          </label>
                          <input
                            type="text"
                            value={filterSkill}
                            onChange={(e) => setFilterSkill(e.target.value)}
                            placeholder="e.g. Marketing, Finance"
                            className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder-slate-500 focus:ring-1 focus:ring-red-600 outline-none"
                          />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                            Experience / Ed.
                          </label>
                          <input
                            type="text"
                            value={filterExperience}
                            onChange={(e) =>
                              setFilterExperience(e.target.value)
                            }
                            placeholder="e.g. McKinsey, ISB"
                            className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder-slate-500 focus:ring-1 focus:ring-red-600 outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                            Min. Comps
                          </label>
                          <input
                            type="number"
                            value={filterMinComps}
                            onChange={(e) => setFilterMinComps(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder-slate-500 focus:ring-1 focus:ring-red-600 outline-none"
                          />
                        </div>
                        <div className="w-40">
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                            Sort By
                          </label>
                          <select
                            value={sortBy}
                            onChange={(e) =>
                              setSortBy(
                                e.target.value as "relevance" | "active",
                              )
                            }
                            className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:ring-1 focus:ring-red-600 outline-none appearance-none"
                          >
                            <option value="relevance">Relevance (Cases)</option>
                            <option value="active">A-Z Name</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {getFilteredTeammates().map((tm, idx) => (
                          <motion.div
                            key={tm.uid}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, margin: "-50px" }}
                            transition={{
                              duration: 0.4,
                              delay: (idx % 3) * 0.1,
                            }}
                            className="bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 group hover:bg-slate-100 dark:hover:bg-[#0f0f10] transition-colors"
                          >
                            <div
                              className="h-24 bg-gradient-to-br from-red-600/20 to-red-500/20 opacity-50 relative cursor-pointer"
                              onClick={() => openProfileModal(tm)}
                            >
                              <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-xs text-slate-900 dark:text-slate-50 flex items-center gap-1 font-bold">
                                <Trophy className="w-3 h-3 text-yellow-400" />{" "}
                                {tm.competitionCount === 11
                                  ? "10+"
                                  : tm.competitionCount || 0}
                              </div>
                            </div>
                            <div className="px-6 pb-6 -mt-10">
                              <div
                                className="relative mb-4 cursor-pointer"
                                onClick={() => openProfileModal(tm)}
                              >
                                <div className="w-20 h-20 bg-white dark:bg-[#09090b] rounded-2xl border-4 border-[#0d1117] shadow-xl flex items-center justify-center font-bold text-2xl overflow-hidden">
                                  {tm.photoURL ? (
                                    <img
                                      src={tm.photoURL}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span className="text-slate-900 dark:text-slate-50">
                                      {
                                        formatNameForPrivacy(
                                          currentUser?.uid,
                                          tm.uid,
                                          tm.displayName,
                                        )?.[0]
                                      }
                                    </span>
                                  )}
                                </div>
                                <div className="absolute bottom-1 right-0 w-4 h-4 bg-green-500 border-2 border-[#0d1117] rounded-full"></div>
                              </div>
                              <h3
                                className="font-bold text-lg text-slate-900 dark:text-slate-50 cursor-pointer hover:text-red-600"
                                onClick={() => openProfileModal(tm)}
                              >
                                {formatNameForPrivacy(
                                  currentUser?.uid,
                                  tm.uid,
                                  tm.displayName,
                                )}
                              </h3>
                              <p className="text-xs text-slate-700 dark:text-slate-300 mb-0.5 font-medium uppercase tracking-wide truncate">
                                {tm.degree || "Current Program"}
                              </p>
                              <p className="text-xs text-slate-700 dark:text-slate-300 mb-4 font-medium uppercase tracking-wide truncate">
                                {tm.ugDegree || "UG Degree"}
                                {tm.collegeName ? ` @ ${tm.collegeName}` : ""}
                              </p>

                              {tm.isFresher ||
                              !tm.experienceYears ||
                              tm.experienceYears === 0 ? (
                                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium tracking-wide mb-4 bg-slate-100 dark:bg-[#27272a] py-1 px-3 rounded-full w-fit mx-auto">
                                  <Briefcase className="w-3.5 h-3.5" /> Fresher
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium tracking-wide mb-4 bg-slate-100 dark:bg-[#27272a] py-1 px-3 rounded-full w-fit mx-auto truncate max-w-[80%]">
                                  <Briefcase className="w-3.5 h-3.5" />
                                  {(() => {
                                    const yrs = Math.floor(tm.experienceYears!);
                                    const mos = Math.round(
                                      (tm.experienceYears! - yrs) * 12,
                                    );
                                    let parts = [];
                                    if (yrs > 0)
                                      parts.push(
                                        `${yrs} Yr${yrs > 1 ? "s" : ""}`,
                                      );
                                    if (mos > 0)
                                      parts.push(
                                        `${mos} Mo${mos > 1 ? "s" : ""}`,
                                      );
                                    return parts.join(" ");
                                  })()}
                                  {tm.jobRole && tm.companyName && (
                                    <span className="opacity-75 md:inline hidden truncate">
                                      {" "}
                                      - {tm.jobRole} @ {tm.companyName}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex flex-wrap justify-center items-center gap-2 mb-6 min-h-[3rem]">
                                {tm.skills?.slice(0, 3).map((skill) => (
                                  <span
                                    key={skill}
                                    className="text-[10px] bg-slate-50 dark:bg-[#18181b] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md font-bold uppercase tracking-tight text-center"
                                  >
                                    {skill}
                                  </span>
                                ))}
                                {(tm.skills?.length || 0) > 3 && (
                                  <span className="text-[10px] bg-red-500/20 text-red-700 border border-red-200 px-2 py-1 rounded-md font-bold text-center">
                                    +{(tm.skills?.length || 0) - 3}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-stretch justify-between gap-3">
                                <button
                                  onClick={() => openProfileModal(tm)}
                                  className="flex-1 bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-slate-50 px-2 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-100 dark:hover:bg-[#27272a] transition-colors border border-slate-200 dark:border-white/20 flex items-center justify-center leading-tight"
                                >
                                  View Profile
                                </button>
                                {(() => {
                                  const reqStatus = getRequestStatus(tm.uid);
                                  if (
                                    !reqStatus ||
                                    reqStatus.status === "rejected"
                                  ) {
                                    return (
                                      <button
                                        onClick={async () => {
                                          if (currentUser) {
                                            await sendMessageRequest(
                                              currentUser.uid,
                                              tm.uid,
                                            );
                                          }
                                        }}
                                        className="flex-1 bg-red-600 text-white px-2 py-2.5 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2 leading-tight"
                                      >
                                        <Network className="w-4 h-4" /> Connect
                                      </button>
                                    );
                                  } else if (reqStatus.status === "pending") {
                                    if (!reqStatus.isSender) {
                                      return (
                                        <div className="flex-1 flex gap-1">
                                          <button
                                            onClick={() =>
                                              updateMessageRequestStatus(
                                                reqStatus.req.id,
                                                "accepted",
                                              )
                                            }
                                            className="flex-1 bg-green-600 text-white px-1 py-2.5 rounded-lg text-xs font-bold hover:bg-green-500 transition-colors leading-tight"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            onClick={() =>
                                              updateMessageRequestStatus(
                                                reqStatus.req.id,
                                                "rejected",
                                              )
                                            }
                                            className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-2.5 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors leading-tight"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await deleteMessageRequest(
                                              reqStatus.req.id,
                                            );
                                          } catch (e) {
                                            console.error(e);
                                          }
                                        }}
                                        className="flex-1 bg-slate-200 dark:bg-[#27272a] text-slate-500 dark:text-slate-400 px-2 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 leading-tight hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors group border border-transparent dark:border-white/20"
                                      >
                                        <Hourglass className="w-4 h-4 group-hover:hidden" />
                                        <UserMinus className="w-4 h-4 hidden group-hover:block" />
                                        <span className="group-hover:hidden">
                                          Requested
                                        </span>
                                        <span className="hidden group-hover:block">
                                          Cancel Request
                                        </span>
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <button
                                        onClick={() => {
                                          setSelectedPartner(tm);
                                          setCurrentView("chat");
                                        }}
                                        className="flex-1 bg-red-600 text-white px-2 py-2.5 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2 leading-tight"
                                      >
                                        <MessageSquare className="w-4 h-4" />{" "}
                                        Message
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
                            No potential teammates found yet. Be the first to
                            join!
                          </div>
                        )}
                      </div>
                      {/* Infinite Scroll Observer */}
                      {hasMoreTeammates &&
                        teammatesTab === "discover" &&
                        !filterSkill &&
                        !filterExperience &&
                        !filterMinComps && (
                          <div className="flex justify-center mt-8 pb-8">
                            <div
                              ref={(el) => {
                                if (el) {
                                  const observer = new IntersectionObserver(
                                    (entries) => {
                                      if (entries[0].isIntersecting) {
                                        loadMoreTeammates();
                                        observer.disconnect();
                                      }
                                    },
                                  );
                                  observer.observe(el);
                                }
                              }}
                              className="w-8 h-8 relative"
                            >
                              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                            </div>
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
                          Inbox
                          {messageRequests.filter(
                            (r) =>
                              r.receiverId === currentUser?.uid &&
                              r.status === "pending",
                          ).length > 0 && (
                            <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                              {
                                messageRequests.filter(
                                  (r) =>
                                    r.receiverId === currentUser?.uid &&
                                    r.status === "pending",
                                ).length
                              }{" "}
                              New
                            </span>
                          )}
                        </h3>
                        <div className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                          {messageRequests.filter(
                            (r) =>
                              r.receiverId === currentUser?.uid &&
                              r.status === "pending",
                          ).length === 0 ? (
                            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 italic">
                              No incoming requests
                            </p>
                          ) : (
                            messageRequests
                              .filter(
                                (r) =>
                                  r.receiverId === currentUser?.uid &&
                                  r.status === "pending",
                              )
                              .map((req) => {
                                const sender = sidebarTeammates.find(
                                  (tm) => tm.uid === req.senderId,
                                );
                                if (!sender) return null;
                                return (
                                  <div
                                    key={req.id}
                                    className="p-4 flex items-center justify-between gap-4"
                                  >
                                    <div
                                      className="flex items-center gap-3 cursor-pointer"
                                      onClick={() => openProfileModal(sender)}
                                    >
                                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
                                        {sender.photoURL ? (
                                          <img
                                            src={sender.photoURL}
                                            alt={sender.displayName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                                            {sender.displayName?.[0]}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-50 hover:text-red-600">
                                          {formatNameForPrivacy(
                                            currentUser?.uid,
                                            sender.uid,
                                            sender.displayName,
                                          )}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-32 md:w-48">
                                          {sender.degree || "Current Program"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() =>
                                          updateMessageRequestStatus(
                                            req.id,
                                            "accepted",
                                          )
                                        }
                                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-500 transition-colors shadow-sm"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() =>
                                          updateMessageRequestStatus(
                                            req.id,
                                            "rejected",
                                          )
                                        }
                                        className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-4">
                          Sent Requests
                        </h3>
                        <div className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                          {messageRequests.filter(
                            (r) => r.senderId === currentUser?.uid,
                          ).length === 0 ? (
                            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 italic">
                              You haven't sent any requests
                            </p>
                          ) : (
                            messageRequests
                              .filter((r) => r.senderId === currentUser?.uid)
                              .map((req) => {
                                const receiver = sidebarTeammates.find(
                                  (tm) => tm.uid === req.receiverId,
                                );
                                if (!receiver) return null;
                                return (
                                  <div
                                    key={req.id}
                                    className="p-4 flex items-center justify-between gap-4"
                                  >
                                    <div
                                      className="flex items-center gap-3 cursor-pointer"
                                      onClick={() => openProfileModal(receiver)}
                                    >
                                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0  opacity-75">
                                        {receiver.photoURL ? (
                                          <img
                                            src={receiver.photoURL}
                                            alt={receiver.displayName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                                            {receiver.displayName?.[0]}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-50 hover:text-red-600">
                                          {formatNameForPrivacy(
                                            currentUser?.uid,
                                            receiver.uid,
                                            receiver.displayName,
                                          )}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-32 md:w-full">
                                          {receiver.degree || "Current Program"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      {req.status === "pending" && (
                                        <>
                                          <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                            Pending
                                          </span>
                                          <button
                                            onClick={async () => {
                                              await deleteMessageRequest(
                                                req.id,
                                              );
                                            }}
                                            className="bg-red-50 dark:bg-[#27272a] text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-800 hover:bg-red-100 dark:hover:bg-red-900/40 p-1.5 rounded-lg transition-colors"
                                            title="Cancel Request"
                                          >
                                            <UserMinus className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                      {req.status === "accepted" && (
                                        <>
                                          <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-green-500/20 text-green-600 dark:text-green-500 border border-green-500/20">
                                            Accepted
                                          </span>
                                          <button
                                            onClick={() => {
                                              setUnfriendTarget({ id: req.id, profile: receiver });
                                              setShowUnfriendConfirm(true);
                                            }}
                                            className="bg-red-50 dark:bg-[#27272a] text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-800 hover:bg-red-100 dark:hover:bg-red-900/40 p-1.5 rounded-lg transition-colors"
                                            title="Unfriend"
                                          >
                                            <UserMinus className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                      {req.status === "rejected" && (
                                        <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-red-500/20 text-red-600 dark:text-red-500 border border-red-500/20">
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {currentView === "profile" && currentUser && (
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
                      {(
                        isEditingProfile
                          ? profileForm.photoURL
                          : userProfile?.photoURL || currentUser.photoURL
                      ) ? (
                        <img
                          src={
                            (isEditingProfile
                              ? profileForm.photoURL
                              : userProfile?.photoURL ||
                                currentUser.photoURL) || undefined
                          }
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="text-slate-700 dark:text-slate-300 w-8 h-8" />
                      )}
                    </div>
                    {isEditingProfile && (
                      <>
                        <label className="absolute inset-0 bg-black/40 text-white rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity z-10">
                          <Plus className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold">Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                          />
                        </label>
                        <label className="absolute -bottom-2 -right-2 bg-red-600 border-[3px] border-white dark:border-[#18181b] text-white p-2 rounded-full cursor-pointer shadow-lg hover:bg-red-700 transition-colors z-20">
                          <Pencil className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="flex-1 flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                        {isEditingProfile
                          ? userProfile
                            ? "Update Your Profile"
                            : "Complete Your Profile"
                          : "Your Profile"}
                      </h2>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">
                        {isEditingProfile
                          ? "Fill in your details to get noticed by potential teammates."
                          : "Here is how your profile looks to others."}
                      </p>
                    </div>
                    {!isEditingProfile && (
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="px-4 py-2 bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors"
                      >
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
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            value={profileForm.displayName || ""}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                displayName: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            Gender
                          </label>
                          <select
                            value={profileForm.gender || ""}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                gender: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 [&>option]:bg-white dark:bg-[#09090b] [&>option]:text-slate-900 dark:text-slate-50"
                          >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Prefer not to say">
                              Prefer not to say
                            </option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                          Current Program{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={profileForm.degree || ""}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              degree: e.target.value,
                            })
                          }
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
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            UG College Name{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            value={profileForm.collegeName || ""}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                collegeName: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500"
                            placeholder="e.g. IIT Kharagpur"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            UG Degree <span className="text-red-500">*</span>
                          </label>
                          <input
                            value={profileForm.ugDegree || ""}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                ugDegree: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500"
                            placeholder="e.g. B.Tech"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <input
                          type="checkbox"
                          id="isFresher"
                          checked={profileForm.isFresher || false}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              isFresher: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-red-600 bg-slate-100 border-slate-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                        />
                        <label
                          htmlFor="isFresher"
                          className="text-sm font-medium text-slate-900 dark:text-slate-50"
                        >
                          I am a fresher
                        </label>
                      </div>

                      <div className="space-y-4">
                        {!profileForm.isFresher && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="space-y-4 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl relative overflow-hidden bg-white/50 dark:bg-[#09090b]/50 shadow-sm transition-shadow hover:shadow-md"
                          >
                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-red-500/50 to-transparent"></div>
                            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-0">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-2">
                                <Briefcase className="w-4 h-4 text-red-500 shrink-0" />
                                <span>Work Experiences (Max 5)</span>
                                <span className="lowercase font-normal italic text-slate-500 text-[10px]">
                                  {(() => {
                                    const totalMonths =
                                      profileForm.workExperiences.reduce(
                                        (sum, exp) =>
                                          sum +
                                          (exp.durationYears || 0) * 12 +
                                          (exp.durationMonths || 0),
                                        0,
                                      );
                                    if (totalMonths === 0) return "";
                                    const years = Math.floor(totalMonths / 12);
                                    const months = totalMonths % 12;
                                    return `(Total: ${years > 0 ? `${years}y ` : ""}${months > 0 ? `${months}m` : ""})`;
                                  })()}
                                </span>
                              </label>
                              {profileForm.workExperiences.length < 5 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProfileForm({
                                      ...profileForm,
                                      workExperiences: [
                                        ...profileForm.workExperiences,
                                        {
                                          company: "",
                                          role: "",
                                          durationYears: 0,
                                          durationMonths: 0,
                                        },
                                      ],
                                    })
                                  }
                                  className="text-xs bg-red-50 dark:bg-red-500/10 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center gap-1 shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add
                                  Experience
                                </button>
                              )}
                            </div>
                            <div className="space-y-3 relative pl-4 before:absolute before:inset-y-0 before:left-1 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                              <AnimatePresence>
                                {profileForm.workExperiences.map((exp, idx) => (
                                  <motion.div
                                    key={idx}
                                    initial={{
                                      opacity: 0,
                                      x: -20,
                                      scale: 0.95,
                                    }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{
                                      opacity: 0,
                                      scale: 0.95,
                                      height: 0,
                                      marginBottom: 0,
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 200,
                                      damping: 20,
                                    }}
                                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start bg-slate-50 dark:bg-[#18181b] p-5 mt-2 sm:mt-0 rounded-xl border border-slate-200 dark:border-slate-800 relative group overflow-visible shadow-sm"
                                  >
                                    <div className="absolute -left-[17px] top-4 w-3.5 h-3.5 rounded-full bg-white dark:bg-[#09090b] border-2 border-red-400 z-10 transition-transform group-hover:scale-125"></div>
                                    <input
                                      placeholder="Company"
                                      value={exp.company || ""}
                                      onChange={(e) =>
                                        setProfileForm({
                                          ...profileForm,
                                          workExperiences:
                                            profileForm.workExperiences.map(
                                              (we, i) =>
                                                i === idx
                                                  ? {
                                                      ...we,
                                                      company: e.target.value,
                                                    }
                                                  : we,
                                            ),
                                        })
                                      }
                                      className="w-full bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-400"
                                    />
                                    <input
                                      placeholder="Role"
                                      value={exp.role || ""}
                                      onChange={(e) =>
                                        setProfileForm({
                                          ...profileForm,
                                          workExperiences:
                                            profileForm.workExperiences.map(
                                              (we, i) =>
                                                i === idx
                                                  ? {
                                                      ...we,
                                                      role: e.target.value,
                                                    }
                                                  : we,
                                            ),
                                        })
                                      }
                                      className="w-full bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-400"
                                    />
                                    <div className="flex gap-2 w-full">
                                      <select
                                        value={exp.durationYears ?? 0}
                                        onChange={(e) =>
                                          setProfileForm({
                                            ...profileForm,
                                            workExperiences:
                                              profileForm.workExperiences.map(
                                                (we, i) =>
                                                  i === idx
                                                    ? {
                                                        ...we,
                                                        durationYears: parseInt(
                                                          e.target.value,
                                                        ),
                                                      }
                                                    : we,
                                              ),
                                          })
                                        }
                                        className="w-1/2 bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50"
                                      >
                                        {Array.from({ length: 16 }, (_, i) => (
                                          <option key={i} value={i}>
                                            {i} Yrs
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={exp.durationMonths ?? 0}
                                        onChange={(e) =>
                                          setProfileForm({
                                            ...profileForm,
                                            workExperiences:
                                              profileForm.workExperiences.map(
                                                (we, i) =>
                                                  i === idx
                                                    ? {
                                                        ...we,
                                                        durationMonths:
                                                          parseInt(
                                                            e.target.value,
                                                          ),
                                                      }
                                                    : we,
                                              ),
                                          })
                                        }
                                        className="w-1/2 bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50"
                                      >
                                        {Array.from({ length: 12 }, (_, i) => (
                                          <option key={i} value={i}>
                                            {i} Mos
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setProfileForm({
                                          ...profileForm,
                                          workExperiences:
                                            profileForm.workExperiences.filter(
                                              (_, i) => i !== idx,
                                            ),
                                        })
                                      }
                                      className="absolute -top-2.5 -right-2.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 w-7 h-7 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl text-xs border-2 border-white dark:border-[#18181b] hover:bg-red-200 dark:hover:bg-red-900/60 transition-all hover:scale-110 z-20"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                            {profileForm.workExperiences.length === 0 && (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-dashed border-slate-200 dark:border-slate-800"
                              >
                                Add at least one experience to get better
                                visibility.
                              </motion.p>
                            )}
                          </motion.div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                          Skills (Comma separated){" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={profileForm.skills || ""}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              skills: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500"
                          placeholder="e.g. Strategy, Valuation, Design"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                          Case Competitions Done{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={profileForm.competitionCount || 0}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              competitionCount: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 [&>option]:bg-white dark:bg-[#09090b] [&>option]:text-slate-900 dark:text-slate-50"
                        >
                          {Array.from({ length: 11 }, (_, i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                          <option value={11}>10+</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            Bio <span className="text-red-500">*</span>
                          </label>
                        </div>
                        <textarea
                          value={profileForm.bio || ""}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              bio: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500"
                          placeholder="Tell us about yourself..."
                          rows={4}
                        ></textarea>
                      </div>
                    </div>
                    {profileError && (
                      <div className="text-red-500 font-medium text-sm mt-4 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-200 dark:border-red-800">
                        {profileError}
                      </div>
                    )}
                    <div className="flex gap-4 mt-8">
                      {userProfile && (
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            setProfileForm({
                              displayName: userProfile.displayName || "",
                              degree: userProfile.degree || "",
                              ugDegree: userProfile.ugDegree || "",
                              collegeName: userProfile.collegeName || "",
                              experienceYears: userProfile.experienceYears || 0,
                              isFresher: userProfile.isFresher || false,
                              companyName: userProfile.companyName || "",
                              role: userProfile.role || "",
                              skills: userProfile.skills?.join(", ") || "",
                              competitionCount:
                                userProfile.competitionCount || 0,
                              bio: userProfile.bio || "",
                            });
                          }}
                          className="flex-1 bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-slate-50 py-4 rounded-xl font-bold tracking-widest text-xs hover:bg-slate-100 dark:bg-[#27272a] transition-colors uppercase border border-slate-200 dark:border-slate-800"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold tracking-widest text-xs hover:bg-red-500 transition-colors uppercase disabled:opacity-50"
                      >
                        {isSavingProfile ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          Full Name
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {userProfile?.displayName}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          Google Email
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {currentUser.email}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          Gender
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {userProfile?.gender || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          Current Program
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {userProfile?.degree || "-"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          UG College Name
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {userProfile?.collegeName || "-"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          UG Degree
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {userProfile?.ugDegree || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                          Total Work Experience
                        </h3>
                        <p className="text-slate-900 dark:text-slate-50">
                          {userProfile?.isFresher
                            ? "Fresher"
                            : userProfile?.experienceYears !== undefined &&
                                userProfile.experienceYears > 0
                              ? (() => {
                                  const yrs = Math.floor(
                                    userProfile.experienceYears,
                                  );
                                  const mos = Math.round(
                                    (userProfile.experienceYears - yrs) * 12,
                                  );
                                  let parts = [];
                                  if (yrs > 0)
                                    parts.push(
                                      `${yrs} Yr${yrs > 1 ? "s" : ""}`,
                                    );
                                  if (mos > 0)
                                    parts.push(
                                      `${mos} Mo${mos > 1 ? "s" : ""}`,
                                    );
                                  return parts.join(" ");
                                })()
                              : "Fresher"}
                        </p>
                      </div>
                      {!userProfile?.isFresher &&
                      userProfile?.experienceYears &&
                      userProfile.experienceYears > 0 &&
                      (!userProfile.workExperiences ||
                        userProfile.workExperiences.length === 0) ? (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                            Role @ Company
                          </h3>
                          <p className="text-slate-900 dark:text-slate-50">
                            {userProfile?.jobRole} @ {userProfile?.companyName}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {userProfile?.workExperiences &&
                      userProfile.workExperiences.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          className="mt-6"
                        >
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-4">
                            Work Experiences
                          </h3>
                          <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent dark:before:from-slate-800 dark:before:via-slate-800 before:opacity-50 pl-8">
                            {userProfile.workExperiences.map((exp, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{
                                  delay: idx * 0.15,
                                  type: "spring",
                                  damping: 20,
                                  stiffness: 100,
                                }}
                                className="relative group cursor-default"
                              >
                                <div className="absolute -left-[37px] top-1 w-6 h-6 bg-slate-50 dark:bg-[#18181b] rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-800 group-hover:border-red-500/50 dark:group-hover:border-red-500/50 transition-colors shadow-sm z-10">
                                  <div className="w-2 h-2 bg-slate-300 dark:bg-slate-700 rounded-full group-hover:bg-red-500 transition-colors group-hover:scale-125 duration-300"></div>
                                </div>
                                <div className="bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group-hover:-translate-y-0.5">
                                  <div className="flex flex-col md:flex-row md:justify-between items-start gap-2 md:gap-4">
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-slate-50 text-base">
                                        {exp.role}
                                      </div>
                                      <div className="text-red-600 dark:text-red-400 font-medium text-sm mt-0.5">
                                        {exp.company}
                                      </div>
                                    </div>
                                    {(exp.durationYears !== undefined ||
                                      exp.durationMonths !== undefined ||
                                      exp.duration) && (
                                      <div className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                                        {exp.durationYears !== undefined ||
                                        exp.durationMonths !== undefined
                                          ? `${exp.durationYears || 0} Y ${exp.durationMonths || 0} M`
                                          : exp.duration}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">
                        Skills
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {userProfile?.skills &&
                        userProfile.skills.length > 0 ? (
                          userProfile.skills.map((skill, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-slate-100 dark:bg-[#27272a] text-slate-900 dark:text-slate-50 text-sm rounded-full"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">
                            -
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                        Case Competitions Done
                      </h3>
                      <p className="text-slate-900 dark:text-slate-50">
                        {userProfile?.competitionCount === 11
                          ? "10+"
                          : userProfile?.competitionCount || 0}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1">
                        Bio
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {userProfile?.bio || "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {!isEditingProfile && (
                <div className="bg-white dark:bg-[#09090b] backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-[#27272a] p-8 md:p-12 shadow-sm mt-8">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-6">
                    Preferences & Settings
                  </h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#27272a]">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-50">
                          Dark Mode
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          Switch the app to a dark theme.
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const newMode = !userProfile?.darkMode;
                          if (newMode)
                            document.documentElement.classList.add("dark");
                          else
                            document.documentElement.classList.remove("dark");
                          if (currentUser && userProfile) {
                            const updated = {
                              ...userProfile,
                              darkMode: newMode,
                            };
                            setUserProfile(updated);
                            await saveUserProfile({ uid: userProfile.uid, darkMode: newMode });
                          }
                        }}
                        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative duration-200 ease-in-out flex items-center px-0.5 ${userProfile?.darkMode ? "bg-red-600" : "bg-slate-300 dark:bg-slate-700"}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full shadow-sm bg-white transition-transform duration-200 ease-in-out ${userProfile?.darkMode ? "translate-x-5" : "translate-x-0"}`}
                        ></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#27272a]">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-50">
                          Pause Account
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          Temporarily hide your profile from others on Connect.
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!userProfile?.isPaused) {
                            setShowPauseConfirmDialog(true);
                          } else {
                            if (currentUser && userProfile) {
                              const updated = {
                                ...userProfile,
                                isPaused: false,
                              };
                              setUserProfile(updated);
                              await saveUserProfile({ uid: userProfile.uid, isPaused: false });
                            }
                          }
                        }}
                        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative duration-200 ease-in-out flex items-center px-0.5 ${userProfile?.isPaused ? "bg-red-600" : "bg-slate-300 dark:bg-slate-700"}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full shadow-sm bg-white transition-transform duration-200 ease-in-out ${userProfile?.isPaused ? "translate-x-5" : "translate-x-0"}`}
                        ></div>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-[#27272a]">
                      <button
                        onClick={() => setShowSignOutConfirmDialog(true)}
                        className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#18181b] transition-colors flex items-center justify-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirmDialog(true)}
                        className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Account
                      </button>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-[#27272a]">
                      <button
                        onClick={() => setShowSupportDialog(true)}
                        className="w-full py-3 bg-[#18181b] dark:bg-slate-50 text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" /> Raise Ticket/Submit Bug
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentView === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-12rem)] flex bg-slate-50 dark:bg-[#18181b] backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl"
            >
              {/* Contacts Sidebar */}
              <div
                className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 ${selectedPartner ? "hidden md:block" : "block"}`}
              >
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-black dark:text-slate-50">
                    Connections & Requests
                  </h3>
                </div>
                <div className="overflow-y-auto h-full pb-32">
                  {sidebarTeammates
                    .filter((t) => {
                      const req = getRequestStatus(t.uid);
                      const hasActiveChat = activeChatUserIds.includes(t.uid);

                      if (!req) return hasActiveChat;
                      return (
                        req.status === "accepted" ||
                        (!req.isSender && req.status === "pending") ||
                        hasActiveChat
                      );
                    })
                    .map((t) => {
                      const chatMsgs = [
                        ...receivedMessages.filter((m) => m.senderId === t.uid),
                        ...sentMessages.filter((m) => m.receiverId === t.uid),
                      ];
                      const latestMessage =
                        chatMsgs.length > 0
                          ? chatMsgs.sort((a, b) => {
                              const timeA =
                                typeof a.createdAt?.toMillis === "function"
                                  ? a.createdAt.toMillis()
                                  : new Date(a.createdAt).getTime();
                              const timeB =
                                typeof b.createdAt?.toMillis === "function"
                                  ? b.createdAt.toMillis()
                                  : new Date(b.createdAt).getTime();
                              return timeB - timeA;
                            })[0]
                          : null;

                      const receivedFromT = receivedMessages.filter(
                        (m) => m.senderId === t.uid,
                      );
                      const latestReceivedMessage =
                        receivedFromT.length > 0
                          ? receivedFromT.sort((a, b) => {
                              const timeA =
                                typeof a.createdAt?.toMillis === "function"
                                  ? a.createdAt.toMillis()
                                  : new Date(a.createdAt).getTime();
                              const timeB =
                                typeof b.createdAt?.toMillis === "function"
                                  ? b.createdAt.toMillis()
                                  : new Date(b.createdAt).getTime();
                              return timeB - timeA;
                            })[0]
                          : null;

                      const hasUnread = receivedFromT.some(
                        (m) => m.isRead !== true,
                      );
                      const latestMillis = latestMessage
                        ? typeof latestMessage.createdAt?.toMillis ===
                          "function"
                          ? latestMessage.createdAt.toMillis()
                          : new Date(latestMessage.createdAt).getTime()
                        : 0;
                      return { t, latestMessage, hasUnread, latestMillis };
                    })
                    .sort((a, b) => b.latestMillis - a.latestMillis)
                    .map(({ t, latestMessage, hasUnread }) => {
                      const timeAgoLabel = latestMessage
                        ? formatTimeAgo(latestMessage.createdAt)
                        : null;
                      const isConnectionPending =
                        getRequestStatus(t.uid)?.status === "pending" &&
                        !getRequestStatus(t.uid)?.isSender;

                      return (
                        <button
                          key={t.uid}
                          onClick={() => setSelectedPartner(t)}
                          className={`w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:bg-[#18181b] transition-colors ${selectedPartner?.uid === t.uid ? "bg-slate-100 dark:bg-[#27272a] border-r-2 border-red-500" : ""}`}
                        >
                          <div className="flex items-center gap-3 w-full overflow-hidden">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 text-xs flex items-center justify-center font-bold text-black dark:text-slate-50">
                                {t.photoURL ? (
                                  <img
                                    src={t.photoURL}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  formatNameForPrivacy(
                                    currentUser?.uid,
                                    t.uid,
                                    t.displayName,
                                  )?.[0]
                                )}
                              </div>
                              {hasUnread && (
                                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-[#18181b] rounded-full"></div>
                              )}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="font-bold text-sm text-black dark:text-slate-50 truncate w-full">
                                {formatNameForPrivacy(
                                  currentUser?.uid,
                                  t.uid,
                                  t.displayName,
                                )}
                              </div>
                              <div className="text-xs text-black dark:text-slate-400 truncate w-full">
                                {hasUnread ? (
                                  <span className="font-bold text-red-600 dark:text-red-400">
                                    New message
                                  </span>
                                ) : (
                                  t.degree || "Current Program"
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            {timeAgoLabel && (
                              <span
                                className={`text-[10px] font-bold ${hasUnread ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-500 font-normal"}`}
                              >
                                {timeAgoLabel}
                              </span>
                            )}
                            {isConnectionPending && (
                              <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 animate-pulse mt-1"></div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  {allTeammates.filter((t) => {
                    const req = getRequestStatus(t.uid);
                    const hasActiveChat = activeChatUserIds.includes(t.uid);
                    if (!req) return hasActiveChat;
                    return (
                      req.status === "accepted" ||
                      (!req.isSender && req.status === "pending") ||
                      hasActiveChat
                    );
                  }).length === 0 && (
                    <p className="p-4 text-xs text-slate-700 dark:text-slate-300">
                      No connections yet
                    </p>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div
                className={`flex-1 flex-col h-full relative ${selectedPartner ? "flex" : "hidden md:flex"}`}
              >
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
                          {selectedPartner.photoURL ? (
                            <img
                              src={selectedPartner.photoURL}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            formatNameForPrivacy(
                              currentUser?.uid,
                              selectedPartner.uid,
                              selectedPartner.displayName,
                            )?.[0]
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="font-bold text-sm text-black dark:text-slate-50">
                            {formatNameForPrivacy(
                              currentUser?.uid,
                              selectedPartner.uid,
                              selectedPartner.displayName,
                            )}
                          </div>
                          <div className="text-xs text-black dark:text-slate-400">
                            {selectedPartner.degree || "Current Program"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() =>
                            setReportTarget({
                              userId: selectedPartner.uid,
                              displayName:
                                selectedPartner.displayName || "Unknown User",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          title="Report User"
                        >
                          <Flag className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openProfileModal(selectedPartner)}
                          className="p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 transition-colors"
                        >
                          <ChevronRight />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={chatContainerRef}
                      className="flex-1 overflow-y-auto p-6 space-y-4 bg-transparent min-h-0 relative z-10"
                    >
                      {isMessagesLoading ? (
                        <div className="h-full flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                        </div>
                      ) : (
                        (() => {
                          const req = getRequestStatus(selectedPartner.uid);
                          if (req?.status === "pending") {
                            if (!req.isSender) {
                              return (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-4">
                                  <p className="text-sm">
                                    You have a connection request from{" "}
                                    {formatNameForPrivacy(
                                      currentUser?.uid,
                                      selectedPartner.uid,
                                      selectedPartner.displayName,
                                    )}
                                    .
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        updateMessageRequestStatus(
                                          req.req.id,
                                          "accepted",
                                        )
                                      }
                                      className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-green-500"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => {
                                        updateMessageRequestStatus(
                                          req.req.id,
                                          "rejected",
                                        );
                                        setSelectedPartner(null);
                                      }}
                                      className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-4">
                                  <Network className="w-8 h-8 opacity-20 text-slate-700 dark:text-slate-300" />
                                  <p className="text-sm">
                                    Waiting for{" "}
                                    {formatNameForPrivacy(
                                      currentUser?.uid,
                                      selectedPartner.uid,
                                      selectedPartner.displayName,
                                    )}{" "}
                                    to accept your request.
                                  </p>
                                  <button
                                    onClick={async () => {
                                      await deleteMessageRequest(req.req.id);
                                      setSelectedPartner(null);
                                    }}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 flex flex-row items-center gap-2"
                                  >
                                    <Hourglass className="w-4 h-4" /> Cancel
                                    Request
                                  </button>
                                </div>
                              );
                            }
                          }
                          return (
                            <>
                              {chatMessages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col ${msg.senderId === currentUser?.uid ? "items-end" : "items-start"}`}
                                >
                                  <div
                                    className={`${msg.senderId === currentUser?.uid ? "bg-red-600 text-white rounded-tr-none shadow-sm" : "bg-slate-100 dark:bg-[#27272a] text-black dark:text-slate-50 border border-slate-200 dark:border-slate-800 rounded-tl-none shadow-sm"} px-4 py-2.5 rounded-2xl max-w-[85%] relative w-fit min-w-[80px]`}
                                  >
                                    <div className="text-[15px] break-words whitespace-pre-wrap pb-3 pr-8 leading-relaxed">
                                      {msg.text}
                                    </div>
                                    <span
                                      className={`text-[10px] absolute bottom-1.5 right-3 font-medium opacity-75 flex items-center gap-1 ${msg.senderId === currentUser?.uid ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}
                                    >
                                      {formatMessageTime(msg.createdAt)}
                                    </span>
                                  </div>
                                  {msg.senderId === currentUser?.uid &&
                                    msg.id ===
                                      chatMessages[chatMessages.length - 1]?.id &&
                                    msg.isRead && (
                                      <div className="mr-1 mt-1 text-[10px] font-bold lowercase text-slate-500 dark:text-slate-400">
                                        Read
                                      </div>
                                    )}
                                </div>
                              ))}
                              {chatMessages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-2">
                                  <MessageSquare className="w-8 h-8 opacity-10 text-slate-700 dark:text-slate-300" />
                                  <p className="text-sm">
                                    Start a conversation with{" "}
                                    {formatNameForPrivacy(
                                      currentUser?.uid,
                                      selectedPartner.uid,
                                      selectedPartner.displayName,
                                    )}
                                  </p>
                                </div>
                              )}
                              {isPartnerTyping && (
                                <div className="flex justify-start w-full mb-4">
                                  <div className="bg-slate-100 dark:bg-[#27272a] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                  </div>
                                </div>
                              )}
                              <div ref={messagesEndRef} />
                            </>
                          );
                        })()
                      )}
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-4 items-center bg-slate-50 dark:bg-[#18181b] backdrop-blur-lg relative z-10">
                      {(() => {
                        const req = getRequestStatus(selectedPartner.uid);
                        if (req?.status === "accepted" || !req) {
                          return (
                            <>
                              <input
                                value={newMessage}
                                onChange={handleTyping}
                                onKeyDown={(e) =>
                                  e.key === "Enter" && handleSendMessage()
                                }
                                placeholder="Type a message..."
                                readOnly={isSendingMessage}
                                className="flex-1 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-red-600 text-slate-900 dark:text-slate-50 placeholder-slate-600 dark:placeholder-slate-400 transition-all"
                              />
                              <button
                                onClick={handleSendMessage}
                                disabled={
                                  !newMessage.trim() || isSendingMessage
                                }
                                className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 transition-colors shadow-lg"
                              >
                                {isSendingMessage ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Send className="w-5 h-5 -ml-1" />
                                )}
                              </button>
                            </>
                          );
                        } else if (req.status === "pending") {
                          return (
                            <p className="text-sm text-slate-600 dark:text-slate-400 w-full text-center py-2 italic">
                              {req.isSender
                                ? "Waiting for connection to be accepted..."
                                : "Accept request in the chat area to start messaging"}
                            </p>
                          );
                        } else {
                          return (
                            <p className="text-sm text-slate-600 dark:text-slate-400 w-full text-center py-2">
                              Connection request rejected
                            </p>
                          );
                        }
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 space-y-4 relative z-10">
                    <MessageSquare className="w-12 h-12 opacity-20 text-slate-700 dark:text-slate-300" />
                    <p>Select a partner to start chatting</p>
                    <button
                      onClick={() => setCurrentView("teammates")}
                      className="text-red-600 text-sm font-bold underline hover:text-red-700"
                    >
                      Find partners
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentView === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminDashboard
                currentUser={currentUser}
                currentUserProfile={userProfile}
                showToast={showToast}
              />
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
              currentView === item.id
                ? "text-red-600"
                : "text-slate-700 dark:text-slate-300"
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
              className="relative bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8"
            >
              <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
                {currentUser &&
                  currentUser.uid !== selectedProfileModal.uid && (
                    <button
                      onClick={() =>
                        setReportTarget({
                          userId: selectedProfileModal.uid,
                          displayName:
                            selectedProfileModal.displayName || "Unknown User",
                        })
                      }
                      title="Report User"
                      className="text-slate-500 hover:text-red-500 bg-slate-50 dark:bg-[#18181b] p-2 rounded-full transition-colors"
                    >
                      <Flag className="w-5 h-5" />
                    </button>
                  )}
                <button
                  onClick={() => setSelectedProfileModal(null)}
                  className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-50 bg-slate-50 dark:bg-[#18181b] p-2 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start mt-8 md:mt-0">
                <div className="w-32 h-32 rounded-3xl bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 flex items-center justify-center text-4xl font-bold overflow-hidden shrink-0">
                  {selectedProfileModal.photoURL ? (
                    <img
                      src={selectedProfileModal.photoURL}
                      alt={formatNameForPrivacy(
                        currentUser?.uid,
                        selectedProfileModal.uid,
                        selectedProfileModal.displayName,
                      )}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-900 dark:text-slate-50">
                      {
                        formatNameForPrivacy(
                          currentUser?.uid,
                          selectedProfileModal.uid,
                          selectedProfileModal.displayName,
                        )?.[0]
                      }
                    </span>
                  )}
                </div>
                <div className="space-y-4 flex-1 w-full">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                      {formatNameForPrivacy(
                        currentUser?.uid,
                        selectedProfileModal.uid,
                        selectedProfileModal.displayName,
                      )}
                    </h2>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider flex flex-wrap gap-2 items-center">
                      <span>
                        {selectedProfileModal.degree || "Current Program"}
                      </span>
                      <span className="opacity-50">•</span>
                      <span>
                        {selectedProfileModal.ugDegree || "UG Degree"}
                        {selectedProfileModal.collegeName
                          ? ` @ ${selectedProfileModal.collegeName}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 px-3 py-1.5 rounded-lg w-fit text-sm font-bold">
                      <Trophy className="w-4 h-4" />{" "}
                      {selectedProfileModal.competitionCount === 11
                        ? "10+"
                        : selectedProfileModal.competitionCount || 0}{" "}
                      Case Competitions
                    </div>

                    {selectedProfileModal.experienceYears &&
                    selectedProfileModal.experienceYears > 0 ? (
                      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg w-fit text-sm font-bold">
                        <Briefcase className="w-4 h-4" />
                        {(() => {
                          const yrs = Math.floor(
                            selectedProfileModal.experienceYears,
                          );
                          const mos = Math.round(
                            (selectedProfileModal.experienceYears - yrs) * 12,
                          );
                          let parts = [];
                          if (yrs > 0)
                            parts.push(`${yrs} Yr${yrs > 1 ? "s" : ""}`);
                          if (mos > 0)
                            parts.push(`${mos} Mo${mos > 1 ? "s" : ""}`);
                          return parts.join(" ");
                        })()}{" "}
                        Exp
                        {selectedProfileModal.jobRole &&
                        selectedProfileModal.companyName
                          ? ` (${selectedProfileModal.jobRole} @ ${selectedProfileModal.companyName})`
                          : ""}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-slate-500/10 border border-slate-500/20 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg w-fit text-sm font-bold">
                        <Briefcase className="w-4 h-4" /> Fresher
                      </div>
                    )}
                  </div>

                  {currentUser &&
                    currentUser.uid !== selectedProfileModal.uid &&
                    (() => {
                      const reqStatus = getRequestStatus(
                        selectedProfileModal.uid,
                      );

                      if (!reqStatus || reqStatus.status === "rejected") {
                        return (
                          <button
                            onClick={async () =>
                              await sendMessageRequest(
                                currentUser.uid,
                                selectedProfileModal.uid,
                              )
                            }
                            className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:scale-105 transition-all flex items-center gap-2 w-fit"
                          >
                            <UserPlus className="w-4 h-4" /> Connect
                          </button>
                        );
                      } else if (reqStatus.status === "pending") {
                        if (!reqStatus.isSender) {
                          return (
                            <div className="flex gap-3">
                              <button
                                onClick={async () =>
                                  await updateMessageRequestStatus(
                                    reqStatus.req.id,
                                    "accepted",
                                  )
                                }
                                className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:scale-105 transition-all flex items-center gap-2 w-fit"
                              >
                                <UserCheck className="w-4 h-4" /> Accept Request
                              </button>
                              <button
                                onClick={async () =>
                                  await updateMessageRequestStatus(
                                    reqStatus.req.id,
                                    "rejected",
                                  )
                                }
                                className="bg-slate-200 dark:bg-[#18181b] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-300 dark:hover:bg-[#27272a] transition-all flex items-center gap-2 w-fit"
                              >
                                Reject
                              </button>
                            </div>
                          );
                        } else {
                          return (
                            <button
                              onClick={async () =>
                                await deleteMessageRequest(reqStatus.req.id)
                              }
                              className="bg-slate-200 dark:bg-[#18181b] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-300 dark:hover:bg-[#27272a] transition-all flex items-center gap-2 w-fit"
                            >
                              <Hourglass className="w-4 h-4" /> Cancel Request
                            </button>
                          );
                        }
                      } else if (reqStatus.status === "accepted") {
                        return (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setSelectedPartner(selectedProfileModal);
                                setCurrentView("chat");
                                setSelectedProfileModal(null);
                              }}
                              className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:scale-105 transition-all flex items-center gap-2 w-fit"
                            >
                              <MessageSquare className="w-4 h-4" /> Message
                            </button>
                            <button
                              onClick={() => {
                                setUnfriendTarget({ id: reqStatus.req.id, profile: selectedProfileModal });
                                setShowUnfriendConfirm(true);
                              }}
                              className="bg-slate-200 dark:bg-[#18181b] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-300 dark:hover:bg-[#27272a] transition-all flex items-center gap-2 w-fit"
                            >
                              <UserMinus className="w-4 h-4" /> Unfriend
                            </button>
                          </div>
                        );
                      }
                    })()}

                  <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedProfileModal.bio || "No bio provided."}
                  </div>

                  {selectedProfileModal.workExperiences &&
                    selectedProfileModal.workExperiences.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="py-4 border-t border-slate-200 dark:border-slate-800"
                      >
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider mb-6">
                          Work Experiences
                        </h3>
                        <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent dark:before:from-slate-800 dark:before:via-slate-800 before:opacity-50 pl-8">
                          {selectedProfileModal.workExperiences.map(
                            (exp, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{
                                  delay: idx * 0.15,
                                  type: "spring",
                                  damping: 20,
                                  stiffness: 100,
                                }}
                                className="relative group cursor-default"
                              >
                                <div className="absolute -left-[37px] top-1 w-6 h-6 bg-slate-50 dark:bg-[#18181b] rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-800 group-hover:border-red-500/50 dark:group-hover:border-red-500/50 transition-colors shadow-sm z-10">
                                  <div className="w-2 h-2 bg-slate-300 dark:bg-slate-700 rounded-full group-hover:bg-red-500 transition-colors group-hover:scale-125 duration-300"></div>
                                </div>
                                <div className="bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group-hover:-translate-y-0.5">
                                  <div className="flex flex-col md:flex-row md:justify-between items-start gap-2 md:gap-4">
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-slate-50 text-base">
                                        {exp.role}
                                      </div>
                                      <div className="text-red-600 dark:text-red-400 font-medium text-sm mt-0.5">
                                        {exp.company}
                                      </div>
                                    </div>
                                    {(exp.durationYears !== undefined ||
                                      exp.durationMonths !== undefined ||
                                      exp.duration) && (
                                      <div className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                                        {exp.durationYears !== undefined ||
                                        exp.durationMonths !== undefined
                                          ? `${exp.durationYears || 0} Y ${exp.durationMonths || 0} M`
                                          : exp.duration}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ),
                          )}
                        </div>
                      </motion.div>
                    )}

                  {selectedProfileModal.skills &&
                    selectedProfileModal.skills.length > 0 && (
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider mb-4">
                          Skills & Endorsements
                        </h3>
                        <div className="flex flex-col gap-3">
                          {selectedProfileModal.skills.map((skill) => {
                            const skillEndorsements = modalEndorsements.filter(
                              (e) => e.skill === skill,
                            );
                            const isEndorsedByMe = skillEndorsements.some(
                              (e) => e.endorserId === currentUser?.uid,
                            );
                            return (
                              <div
                                key={skill}
                                className="flex items-center justify-between bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-xl p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-slate-900 dark:text-slate-50 font-medium">
                                    {skill}
                                  </span>
                                  {skillEndorsements.length > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold bg-red-500/20 text-red-600 px-2 py-0.5 rounded-md">
                                      <ThumbsUp className="w-3 h-3" />{" "}
                                      {skillEndorsements.length}
                                    </span>
                                  )}
                                </div>
                                {currentUser &&
                                  currentUser.uid !==
                                    selectedProfileModal.uid &&
                                  (getRequestStatus(selectedProfileModal.uid)
                                    ?.status === "accepted" ||
                                    activeChatUserIds.includes(
                                      selectedProfileModal.uid,
                                    )) && (
                                    <button
                                      onClick={() => handleEndorse(skill)}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        isEndorsedByMe
                                          ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                                          : "bg-slate-50 dark:bg-[#18181b] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-[#27272a] border border-slate-200 dark:border-slate-800"
                                      }`}
                                    >
                                      {isEndorsedByMe ? (
                                        <>
                                          <ThumbsUp className="w-3 h-3 fill-current" />{" "}
                                          Endorsed
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3 h-3" /> Endorse
                                        </>
                                      )}
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
              transition={{ type: "spring", bounce: 0.5 }}
              className="relative bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl overflow-hidden"
            >
              {/* Glowing effect behind icon */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-500/20 blur-[50px] rounded-full pointer-events-none" />

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", bounce: 0.6 }}
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

              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2 z-10">
                Profile Saved!
              </h2>
              <p className="text-slate-700 dark:text-slate-300 text-sm z-10 text-center max-w-[200px]">
                Your information has been updated successfully.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sign Out Confirmation Dialog */}
      <AnimatePresence>
        {showSignOutConfirmDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignOutConfirmDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300">
                  <LogOut className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                    Sign Out
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Are you sure you want to sign out of your account?
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setShowSignOutConfirmDialog(false)}
                    className="flex-1 py-2 bg-slate-200 dark:bg-[#27272a] text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-300 dark:hover:bg-[#3f3f46] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowSignOutConfirmDialog(false);
                      handleSignOut();
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed top-1/2 md:top-auto bottom-auto md:bottom-6 left-1/2 -translate-y-1/2 md:-translate-y-0 -translate-x-1/2 z-[300] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-5 md:px-6 md:py-3 rounded-2xl md:rounded-full shadow-2xl md:shadow-lg font-medium text-lg md:text-sm flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2 w-[85%] max-w-[320px] md:max-w-none md:w-auto text-center md:text-left"
          >
            <div className="w-3 h-3 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse shrink-0"></div>
            {toastMessage}
          </motion.div>
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
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                    Delete Account
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 mt-2 text-sm">
                    Are you sure you want to delete your account? This action
                    cannot be undone.
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
                        if (currentUser) {
                          if (userProfile) {
                            await saveUserProfile({
                              uid: userProfile.uid,
                              isDeleted: true,
                            });
                          }
                          await logout();
                        }
                        setCurrentUser(null);
                        setUserProfile(null);
                        setCurrentView("home");
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 text-center">
                Account deletion in progress...
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 text-center">
                Please wait while we remove your data.
              </p>
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
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                    Pause Account?
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 mt-2 text-sm">
                    Are you sure you want to pause your account? Your profile
                    will be hidden from everyone in the Connect section.
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
                        await saveUserProfile({ uid: userProfile.uid, isPaused: true });
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

      {/* Report User Dialog */}
      <AnimatePresence>
        {reportTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isReportingSubmitting) {
                  setReportTarget(null);
                  setReportReason("");
                }
              }}
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
                  <Flag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                    Report User
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 mt-2 text-sm">
                    You are reporting{" "}
                    <span className="font-bold">
                      {reportTarget.displayName}
                    </span>
                    . Please provide a reason for this report.
                  </p>
                </div>

                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  disabled={isReportingSubmitting}
                  className="w-full bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-600 transition-all text-slate-900 dark:text-slate-50 placeholder-slate-500 mt-2"
                  placeholder="Tell us what happened..."
                  rows={3}
                ></textarea>

                <div className="flex gap-3 w-full mt-4">
                  <button
                    disabled={isReportingSubmitting}
                    onClick={() => {
                      setReportTarget(null);
                      setReportReason("");
                    }}
                    className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 font-medium rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!reportReason.trim() || isReportingSubmitting}
                    onClick={async () => {
                      if (!currentUser || !reportReason.trim() || !reportTarget)
                        return;
                      setIsReportingSubmitting(true);
                      try {
                        await reportUser(
                          currentUser.uid,
                          reportTarget.userId,
                          reportReason.trim(),
                        );
                        showToast(
                          `Your report against ${reportTarget.displayName} has been submitted.`,
                        );
                      } catch (error) {
                        showToast("Failed to submit report. Please try again.");
                      } finally {
                        setIsReportingSubmitting(false);
                        setReportTarget(null);
                        setReportReason("");
                      }
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isReportingSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Report"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Support Dialog */}
      <AnimatePresence>
        {showSupportDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSupportDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl z-10"
            >
              <button
                onClick={() => setShowSupportDialog(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                    Help & Support
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Describe your query or report a bug.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={supportForm.type === "query"}
                          onChange={() =>
                            setSupportForm({ ...supportForm, type: "query" })
                          }
                          className="accent-red-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          General Query
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={supportForm.type === "bug"}
                          onChange={() =>
                            setSupportForm({ ...supportForm, type: "bug" })
                          }
                          className="accent-red-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Report a Bug
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={supportForm.title}
                      onChange={(e) =>
                        setSupportForm({
                          ...supportForm,
                          title: e.target.value,
                        })
                      }
                      className="w-full bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-50"
                      placeholder="Brief summary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={supportForm.description}
                      onChange={(e) =>
                        setSupportForm({
                          ...supportForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full bg-white dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-50 h-32 resize-none"
                      placeholder="Details..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 w-full pt-4">
                  <button
                    disabled={isSubmittingSupport}
                    onClick={() => setShowSupportDialog(false)}
                    className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 font-medium rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={
                      !supportForm.title.trim() ||
                      !supportForm.description.trim() ||
                      isSubmittingSupport
                    }
                    onClick={async () => {
                      if (!currentUser) return;
                      setIsSubmittingSupport(true);
                      try {
                        const { createSupportTicket } =
                          await import("./services/firebaseService");
                        await createSupportTicket({
                          userId: currentUser.uid,
                          title: supportForm.title,
                          description: supportForm.description,
                          type: supportForm.type,
                        });
                        showToast("Ticket submitted successfully!");
                        setShowSupportDialog(false);
                        setSupportForm({
                          title: "",
                          description: "",
                          type: "query",
                        });
                      } catch (e) {
                        showToast("Failed to submit ticket.");
                      } finally {
                        setIsSubmittingSupport(false);
                      }
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSubmittingSupport ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Announcement Dismissal Confirmation Dialog */}
      <AnimatePresence>
        {announcementToDismiss && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAnnouncementToDismiss(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#18181b] p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 relative z-10 max-w-sm w-full text-center"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                Dismiss Announcement
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to dismiss this announcement? You won't
                see it again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAnnouncementToDismiss(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (currentUser && userProfile) {
                      const newAnnouncements = [
                        ...(userProfile.dismissedAnnouncements || []),
                        announcementToDismiss,
                      ];
                      const updatedProfile = {
                        ...userProfile,
                        dismissedAnnouncements: newAnnouncements,
                      };
                      setUserProfile(updatedProfile);
                      await saveUserProfile({ uid: userProfile.uid, dismissedAnnouncements: newAnnouncements });
                    }
                    setAnnouncementToDismiss(null);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unfriend Confirmation Dialog */}
      <AnimatePresence>
        {showUnfriendConfirm && unfriendTarget && currentUser && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-sm"
              onClick={() => {
                setShowUnfriendConfirm(false);
                setUnfriendTarget(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#18181b] p-8 rounded-3xl border border-slate-200 dark:border-[#27272a] shadow-2xl relative z-10 max-w-sm w-full"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 mx-auto flex items-center justify-center rounded-2xl mb-6">
                <UserMinus className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-3 text-center">
                Unfriend {unfriendTarget.profile.displayName}?
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8 text-center text-sm leading-relaxed">
                Are you sure you want to unfriend{" "}
                <span className="font-bold text-slate-900 dark:text-slate-50">
                  {unfriendTarget.profile.displayName}
                </span>
                ? If you change your mind, you’ll have to request to connect
                with{" "}
                <span className="font-bold text-slate-900 dark:text-slate-50">
                  {unfriendTarget.profile.displayName}
                </span>{" "}
                again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUnfriendConfirm(false);
                    setUnfriendTarget(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (unfriendTarget && currentUser) {
                      try {
                        await deleteMessageRequest(unfriendTarget.id);
                        await deleteChatHistory(
                          currentUser.uid,
                          unfriendTarget.profile.uid,
                        );
                        if (
                          selectedPartner?.uid === unfriendTarget.profile.uid
                        ) {
                          setSelectedPartner(null);
                          if (currentView === "chat")
                            setCurrentView("teammates");
                        }
                        showToast(
                          `Unfriended ${unfriendTarget.profile.displayName}`,
                        );
                      } catch (e) {
                        console.error(e);
                        showToast("Failed to unfriend.");
                      }
                    }
                    setShowUnfriendConfirm(false);
                    setUnfriendTarget(null);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition"
                >
                  Unfriend
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Targeted Campaign Popup */}
      {visibleCampaigns.length > 0 && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <AnimatePresence mode="wait">
            {visibleCampaigns.slice(0, 1).map((campaign) => {
              const millis = typeof campaign.createdAt?.toMillis === "function" ? campaign.createdAt.toMillis() : new Date(campaign.createdAt).getTime();
              const days = millis ? Math.floor((new Date().getTime() - millis) / (1000 * 60 * 60 * 24)) : 0;
              const dateStr = millis ? new Date(millis).toLocaleDateString('en-GB') : '';
              const timestampStr = millis ? `Sent on ${days} days ago (${dateStr})` : '';

              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  className="bg-white dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-blue-500"></div>

                  <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mb-6 shadow-sm border border-teal-100 dark:border-teal-800/50">
                    <Send className="w-8 h-8 ml-1" />
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight">
                    {campaign.title}
                  </h2>

                  <ClickableText 
                    className="text-slate-600 dark:text-slate-400 mb-2 max-w-sm whitespace-pre-wrap relaxed-leading text-sm block"
                    text={campaign.message}
                  />

                  {timestampStr && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-8">
                      {timestampStr}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button
                      onClick={async () => {
                        const id = campaign.id;
                        if (id && currentUser && userProfile) {
                          const newCampaigns = [...(userProfile.dismissedCampaigns || []), id];
                          const updatedProfile = {
                             ...userProfile,
                             dismissedCampaigns: newCampaigns
                          };
                          setUserProfile(updatedProfile);
                          await saveUserProfile({ uid: userProfile.uid, dismissedCampaigns: newCampaigns });
                          // Read count increment
                          await import('./services/firebaseService').then((m) => m.incrementCampaignReadCount?.(id));
                        }
                      }}
                      className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition shadow-lg flex-1"
                    >
                      Got it, Thanks!
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Maintenance Popup */}
      <AnimatePresence>
        {showMaintenancePopup && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-sm"
              onClick={() => setShowMaintenancePopup(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#18181b] p-8 rounded-3xl border border-slate-200 dark:border-[#27272a] shadow-2xl relative z-10 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 mx-auto flex items-center justify-center rounded-2xl mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-2">
                Under Maintenance
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                MICompete is currently under maintenance. Please check back
                later!
              </p>
              <button
                onClick={() => setShowMaintenancePopup(false)}
                className="w-full bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 py-3 rounded-xl font-bold transition-colors"
              >
                Okay
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

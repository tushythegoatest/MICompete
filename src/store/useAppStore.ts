import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, GlobalSettings, Announcement } from '../types.ts';

interface AppState {
  currentUser: FirebaseUser | null;
  setCurrentUser: (user: FirebaseUser | null) => void;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  globalSettings: GlobalSettings | null;
  setGlobalSettings: (settings: GlobalSettings | null) => void;
  activeChatUserIds: string[];
  setActiveChatUserIds: (idsOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  selectedPartner: UserProfile | null;
  setSelectedPartner: (partner: UserProfile | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  userProfile: null,
  setUserProfile: (profile) => set({ userProfile: profile }),
  globalSettings: null,
  setGlobalSettings: (settings) => set({ globalSettings: settings }),
  activeChatUserIds: [],
  setActiveChatUserIds: (idsOrUpdater) => set((state) => ({
    activeChatUserIds: typeof idsOrUpdater === 'function' ? idsOrUpdater(state.activeChatUserIds) : idsOrUpdater
  })),
  selectedPartner: null,
  setSelectedPartner: (partner) => set({ selectedPartner: partner }),
}));

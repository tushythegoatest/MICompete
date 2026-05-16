export interface WorkExperience {
  company: string;
  role: string;
  duration?: string;
  durationYears?: number;
  durationMonths?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  skills: string[];
  degree: string;
  ugDegree?: string;
  collegeName: string;
  experienceYears: number;
  isFresher?: boolean;
  companyName?: string;
  role?: string;
  workExperiences?: WorkExperience[];
  gender?: string;
  darkMode?: boolean;
  competitionCount: number;
  bio: string;
  createdAt: any;
  isPaused?: boolean;
  isDeleted?: boolean;
  isBlocked?: boolean;
  lastActiveAt?: any;
  dismissedAnnouncements?: string[];
}

export interface Competition {
  title: string;
  organization: string;
  date: string;
  url: string;
}

export interface Endorsement {
  id?: string;
  endorserId: string;
  endorseeId: string;
  skill: string;
  createdAt: any;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  isRead?: boolean;
  createdAt: any;
}

export interface Report {
  id?: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  createdAt: any;
  status: 'pending' | 'reviewed';
}

export interface Announcement {
  id?: string;
  message: string;
  senderId?: string;
  createdAt: any;
  active: boolean;
}

export interface SupportTicket {
  id?: string;
  userId: string;
  title: string;
  description: string;
  type: 'bug' | 'query';
  status: 'open' | 'closed';
  createdAt: any;
}

export interface GlobalSettings {
  maintenanceMode: boolean;
  matchingEnabled: boolean;
  allowedDomains: string[];
  maxUsers: number;
}

export type View = 'home' | 'profile' | 'competitions' | 'teammates' | 'chat' | 'admin' | 'support';

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

export type View = 'home' | 'profile' | 'competitions' | 'teammates' | 'chat';

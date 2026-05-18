import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  addDoc,
  deleteDoc,
  limit,
  collectionGroup,
  writeBatch,
  startAfter,
  QueryDocumentSnapshot,
  updateDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { db, auth } from '../lib/firebase.ts';
import { UserProfile, Message } from '../types.ts';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (errorMessage.includes('Quota limit exceeded') || errorMessage.includes('Quota exceeded')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quotaExceeded'));
    }
  }

  throw new Error(JSON.stringify(errInfo));
}

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      return null;
    }
    console.error("Auth Error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

const profileCache = new Map<string, { data: UserProfile | null, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const path = `users/${uid}`;
  if (profileCache.has(uid)) {
    const cached = profileCache.get(uid)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    let result: UserProfile | null = null;
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      if (!data.isDeleted) {
         result = data;
      }
    }
    
    profileCache.set(uid, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const listenToUserProfile = (uid: string, callback: (profile: UserProfile | null) => void) => {
  const path = `users/${uid}`;
  return onSnapshot(doc(db, 'users', uid), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      callback(data.isDeleted ? null : data);
    } else {
      callback(null);
    }
  }, (error) => handleFirestoreError(error, OperationType.GET, path));
};

export const saveUserProfile = async (profile: Partial<UserProfile> & { uid: string }) => {
  const path = `users/${profile.uid}`;
  try {
    const docRef = doc(db, 'users', profile.uid);
    const docSnap = await getDoc(docRef);
    
    // Strip createdAt to avoid rule violations on update
    const { createdAt, ...profileToSave } = profile as any;
    
    if (docSnap.exists()) {
      // Update
      await setDoc(docRef, {
        ...profileToSave,
      }, { merge: true });
    } else {
      // Create
      await setDoc(docRef, {
        ...profileToSave,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const path = 'users';
  try {
    const q = query(collection(db, 'users'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as UserProfile).filter(user => !user.isPaused && !user.isDeleted);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getPaginatedUsers = async (
  pageSize: number,
  lastDoc: QueryDocumentSnapshot | null = null,
  filters: { minComps?: number } = {}
): Promise<{ users: UserProfile[], lastDoc: QueryDocumentSnapshot | null }> => {
  const path = 'users';
  try {
    let q = query(collection(db, 'users'));
    
    // We cannot easily do where('isDeleted', '==', false) and where('isPaused', '==', false) 
    // without composite indexes, which might fail dynamically.
    // Assuming filters minComps is the main one requiring order
    if (filters.minComps) {
      q = query(q, where('competitionCount', '>=', filters.minComps), orderBy('competitionCount', 'desc'));
    } else {
      q = query(q, orderBy('uid')); // default ordering
    }
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    q = query(q, limit(pageSize));
    
    const querySnapshot = await getDocs(q);
    // Since we can't filter out deleted/paused without indexes, we do it in-memory for the fetched page,
    // Note: this means a page might return fewer than pageSize users.
    const users = querySnapshot.docs.map(doc => doc.data() as UserProfile).filter(user => !user.isPaused && !user.isDeleted);
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
    
    return { users, lastDoc: newLastDoc };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return { users: [], lastDoc: null };
  }
};

export const checkChatExists = async (userId1: string, userId2: string): Promise<boolean> => {
  const chatId = [userId1, userId2].sort().join('_');
  const path = `chats/${chatId}/messages`;
  try {
    const q = query(collection(db, 'chats', chatId, 'messages'), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking chat:", error);
    return false;
  }
};

export const sendMessage = async (senderId: string, receiverId: string, text: string) => {
  const chatId = [senderId, receiverId].sort().join('_');
  const path = `chats/${chatId}/messages`;
  try {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text,
      senderId,
      receiverId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const markMessagesAsRead = async (senderId: string, receiverId: string) => {
  const chatId = [senderId, receiverId].sort().join('_');
  const path = `chats/${chatId}/messages`;
  try {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      where('receiverId', '==', receiverId)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;
    snapshot.docs.forEach((messageDoc) => {
      if (messageDoc.data().isRead !== true) {
        batch.update(messageDoc.ref, { isRead: true });
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const listenToAllReceivedMessages = (userId: string, callback: (messages: Message[]) => void) => {
  const path = `messages`;
  try {
    const q = query(
      collectionGroup(db, 'messages'),
      where('receiverId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (err) {
    return () => {};
  }
};

export const listenToAllSentMessages = (userId: string, callback: (messages: Message[]) => void) => {
  const path = `messages`;
  try {
    const q = query(
      collectionGroup(db, 'messages'),
      where('senderId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (err) {
    return () => {};
  }
};

export const listenToTotalUnreadMessages = (userId: string, callback: (count: number) => void) => {
  const path = `messages`;
  try {
    const q = query(
      collectionGroup(db, 'messages'),
      where('receiverId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const unreadCount = snapshot.docs.filter(doc => doc.data().isRead === false).length;
      callback(unreadCount);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (err) {
    return () => {};
  }
};

export const listenToMessages = (senderId: string, receiverId: string, callback: (messages: Message[]) => void) => {
  const chatId = [senderId, receiverId].sort().join('_');
  const path = `chats/${chatId}/messages`;
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
    callback(messages);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const setTypingStatus = async (senderId: string, receiverId: string, isTyping: boolean) => {
  const chatId = [senderId, receiverId].sort().join('_');
  const path = `typing/${chatId}`;
  try {
    await setDoc(doc(db, 'typing', chatId), {
      [senderId]: isTyping,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error setting typing status:", error);
  }
};

export const listenToTypingStatus = (senderId: string, receiverId: string, callback: (isTyping: boolean) => void) => {
  const chatId = [senderId, receiverId].sort().join('_');
  return onSnapshot(doc(db, 'typing', chatId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(!!data[receiverId]); // Check if the receiver of our messages is typing
    } else {
      callback(false);
    }
  });
};

export const endorseSkill = async (endorserId: string, endorseeId: string, skill: string) => {
  const endorsementId = `${endorserId}_${endorseeId}_${skill.replace(/\s+/g, '_')}`;
  const path = `endorsements/${endorsementId}`;
  try {
    const docRef = doc(db, 'endorsements', endorsementId);
    await setDoc(docRef, {
      endorserId,
      endorseeId,
      skill,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const removeEndorsement = async (endorserId: string, endorseeId: string, skill: string) => {
  const endorsementId = `${endorserId}_${endorseeId}_${skill.replace(/\s+/g, '_')}`;
  const path = `endorsements/${endorsementId}`;
  try {
    const docRef = doc(db, 'endorsements', endorsementId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getEndorsementsForUser = async (userId: string) => {
  const path = 'endorsements';
  try {
    const q = query(collection(db, 'endorsements'), where('endorseeId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export interface MessageRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export const sendMessageRequest = async (senderId: string, receiverId: string) => {
  const path = 'messageRequests';
  const id = `${senderId}_${receiverId}`;
  try {
    await setDoc(doc(db, path, id), {
      senderId,
      receiverId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateMessageRequestStatus = async (requestId: string, status: 'accepted' | 'rejected') => {
  const path = `messageRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'messageRequests', requestId), {
      status
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteMessageRequest = async (requestId: string) => {
  const path = `messageRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'messageRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const deleteChatHistory = async (userId1: string, userId2: string) => {
  const chatId = [userId1, userId2].sort().join('_');
  const path = `chats/${chatId}/messages`;
  try {
    const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
    const deletePromises = messagesSnap.docs.map(messageDoc => deleteDoc(messageDoc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToMessageRequests = (userId: string, callback: (requests: MessageRequest[]) => void) => {
  const path = 'messageRequests';
  const q1 = query(collection(db, 'messageRequests'), where('senderId', '==', userId));
  const q2 = query(collection(db, 'messageRequests'), where('receiverId', '==', userId));

  const requestsMap = new Map<string, MessageRequest>();

  const updateCallback = () => {
    callback(Array.from(requestsMap.values()).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
  };

  const unsub1 = onSnapshot(q1, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') requestsMap.delete(change.doc.id);
      else requestsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as MessageRequest);
    });
    updateCallback();
  }, (error) => handleFirestoreError(error, OperationType.GET, path));

  const unsub2 = onSnapshot(q2, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') requestsMap.delete(change.doc.id);
      else requestsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as MessageRequest);
    });
    updateCallback();
  }, (error) => handleFirestoreError(error, OperationType.GET, path));

  return () => { unsub1(); unsub2(); };
};

export const reportUser = async (reporterId: string, reportedId: string, reason: string) => {
  const path = 'reports';
  try {
    await addDoc(collection(db, 'reports'), {
      reporterId,
      reportedId,
      reason,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getAllReports = async (): Promise<any[]> => {
  const path = 'reports';
  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const updateReportStatus = async (reportId: string, status: 'pending' | 'reviewed') => {
  const path = `reports/${reportId}`;
  try {
    await setDoc(doc(db, 'reports', reportId), {
      status
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteReport = async (reportId: string) => {
  const path = `reports/${reportId}`;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'reports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const createAnnouncement = async (announcement: Partial<import('../types.ts').Announcement>) => {
  const path = 'announcements';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...announcement,
      createdAt: serverTimestamp(),
      active: true
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateAnnouncement = async (announcementId: string, updates: Partial<import('../types.ts').Announcement>) => {
  const path = `announcements/${announcementId}`;
  try {
    await setDoc(doc(db, 'announcements', announcementId), updates, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getAllAnnouncements = async () => {
  const path = 'announcements';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as import('../types.ts').Announcement));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const deleteAnnouncement = async (announcementId: string) => {
  const path = `announcements/${announcementId}`;
  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToAnnouncements = (callback: (announcements: import('../types.ts').Announcement[]) => void) => {
  const path = 'announcements';
  const q = query(collection(db, path), where('active', '==', true), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as import('../types.ts').Announcement)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, path));
};

export const listenToTargetedCampaigns = (userId: string, callback: (campaigns: import('../types.ts').Campaign[]) => void) => {
  const path = 'campaigns';
  const q = query(collection(db, path), where('status', '==', 'active'), where('targetUserIds', 'array-contains', userId));
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as import('../types.ts').Campaign)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, path));
};

let globalSettingsCache: { data: import('../types.ts').GlobalSettings | null, timestamp: number } | null = null;

export const getGlobalSettings = async (): Promise<import('../types.ts').GlobalSettings | null> => {
  const path = 'settings/global';
  if (globalSettingsCache && Date.now() - globalSettingsCache.timestamp < CACHE_TTL) {
    return globalSettingsCache.data;
  }

  try {
    const docSnap = await getDoc(doc(db, 'settings', 'global'));
    let result: import('../types.ts').GlobalSettings | null = null;
    if (docSnap.exists()) {
      result = docSnap.data() as import('../types.ts').GlobalSettings;
    }
    
    globalSettingsCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveGlobalSettings = async (settings: Partial<import('../types.ts').GlobalSettings>) => {
  const path = 'settings/global';
  try {
    await setDoc(doc(db, 'settings', 'global'), settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const createSupportTicket = async (ticket: Partial<import('../types.ts').SupportTicket>) => {
  const path = 'supportTickets';
  try {
    await addDoc(collection(db, path), {
      ...ticket,
      status: 'open',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getAllSupportTickets = async (): Promise<import('../types.ts').SupportTicket[]> => {
  const path = 'supportTickets';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as import('../types.ts').SupportTicket));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const updateSupportTicketStatus = async (ticketId: string, status: 'open' | 'closed') => {
  const path = `supportTickets/${ticketId}`;
  try {
    await setDoc(doc(db, 'supportTickets', ticketId), { status }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteSupportTicket = async (ticketId: string) => {
  const path = `supportTickets/${ticketId}`;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'supportTickets', ticketId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const updateUserRole = async (userId: string, role: string) => {
  const path = `users/${userId}`;
  try {
    await setDoc(doc(db, 'users', userId), { role }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --- Audit Logs ---
export const logAuditAction = async (auditLog: Partial<import('../types.ts').AuditLog>) => {
  try {
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
    const docRef = await addDoc(collection(db, 'auditLogs'), {
      ...auditLog,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'auditLogs');
  }
};

export const getAuditLogs = async (): Promise<import('../types.ts').AuditLog[]> => {
  try {
    const { getDocs, collection, query, orderBy, limit } = await import('firebase/firestore');
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as import('../types.ts').AuditLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'auditLogs');
    return [];
  }
};

// --- Campaigns ---
export const createCampaign = async (campaign: Partial<import('../types.ts').Campaign>) => {
  try {
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
    const docRef = await addDoc(collection(db, 'campaigns'), {
      ...campaign,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'campaigns');
  }
};

export const getCampaigns = async (): Promise<import('../types.ts').Campaign[]> => {
  try {
    const { getDocs, collection, query, orderBy } = await import('firebase/firestore');
    const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as import('../types.ts').Campaign));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'campaigns');
    return [];
  }
};

export const updateCampaignStatus = async (campaignId: string, status: 'active' | 'completed' | 'draft' | 'paused') => {
  try {
    const { updateDoc, doc } = await import('firebase/firestore');
    const campaignRef = doc(db, 'campaigns', campaignId);
    await updateDoc(campaignRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}`);
  }
};

export const deleteCampaign = async (campaignId: string) => {
  try {
    const { deleteDoc, doc } = await import('firebase/firestore');
    const campaignRef = doc(db, 'campaigns', campaignId);
    await deleteDoc(campaignRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `campaigns/${campaignId}`);
  }
};

export const incrementCampaignReadCount = async (campaignId: string) => {
  try {
    const { updateDoc, doc, increment } = await import('firebase/firestore');
    await updateDoc(doc(db, 'campaigns', campaignId), {
      readCount: increment(1)
    });
  } catch(error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}`);
  }
};


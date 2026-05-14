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
  writeBatch
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveUserProfile = async (profile: Omit<UserProfile, 'createdAt'>) => {
  const path = `users/${profile.uid}`;
  try {
    const docRef = doc(db, 'users', profile.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update
      await setDoc(docRef, {
        ...profile,
      }, { merge: true });
    } else {
      // Create
      await setDoc(docRef, {
        ...profile,
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
    return querySnapshot.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
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
      where('receiverId', '==', receiverId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((messageDoc) => {
      batch.update(messageDoc.ref, { isRead: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const listenToTotalUnreadMessages = (userId: string, callback: (count: number) => void) => {
  const path = `messages`;
  try {
    const q = query(
      collectionGroup(db, 'messages'),
      where('receiverId', '==', userId),
      where('isRead', '==', false)
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.length);
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

export const searchCompetitions = async () => {
  try {
    const response = await fetch('/api/competitions/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Search failed');
    return await response.json();
  } catch (error) {
    console.error("Competition Search Error:", error);
    return { competitions: [] };
  }
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
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'messageRequests', requestId), {
      status
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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

import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

export const Collections = {
  categories: 'categories',
  questions: 'questions',
  exams: 'exams',
  attempts: 'attempts',
} as const;
export type CollectionName = (typeof Collections)[keyof typeof Collections];

type WithoutId<T> = Omit<T, 'id'>;

/**
 * The only class that talks to Firebase. Everything else goes through AppState,
 * which calls these methods and keeps the results in signals.
 */
@Injectable({ providedIn: 'root' })
export class Infrastructure {
  readonly isConfigured = !!environment.firebase.apiKey && !!environment.firebase.projectId;

  private readonly app?: FirebaseApp;
  private readonly auth?: Auth;
  private readonly db?: Firestore;

  constructor() {
    if (!this.isConfigured) return;
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    // Offline cache: pages load instantly and keep working without internet.
    this.db = initializeFirestore(this.app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }

  // ---------- Auth ----------

  async authReady(): Promise<void> {
    await this.auth?.authStateReady();
  }

  isSignedIn(): boolean {
    return !!this.auth?.currentUser;
  }

  onAuthChange(callback: (user: User | null) => void): Unsubscribe {
    if (!this.auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(this.auth, callback);
  }

  async signIn(email: string, pin: string): Promise<void> {
    await signInWithEmailAndPassword(this.requireAuth(), email, pin);
  }

  async signOut(): Promise<void> {
    await signOut(this.requireAuth());
  }

  // ---------- Firestore ----------

  /** Live-subscribes to a whole collection; the callback runs on every change. */
  watch<T extends { id: string }>(
    name: CollectionName,
    callback: (items: T[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.requireDb(), name),
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as WithoutId<T>), id: d.id }) as T)),
      onError,
    );
  }

  async add<T extends { id: string }>(name: CollectionName, data: WithoutId<T>): Promise<string> {
    const ref = await addDoc(collection(this.requireDb(), name), clean(data));
    return ref.id;
  }

  async set<T extends { id: string }>(name: CollectionName, id: string, data: WithoutId<T>): Promise<void> {
    await setDoc(doc(this.requireDb(), name, id), clean(data));
  }

  async update<T extends { id: string }>(
    name: CollectionName,
    id: string,
    changes: Partial<WithoutId<T>>,
  ): Promise<void> {
    await updateDoc(doc(this.requireDb(), name, id), clean(changes));
  }

  async remove(name: CollectionName, id: string): Promise<void> {
    await deleteDoc(doc(this.requireDb(), name, id));
  }

  /** Bulk insert (used by Excel upload). Firestore batches hold at most 500 writes. */
  async addMany<T extends { id: string }>(name: CollectionName, items: WithoutId<T>[]): Promise<string[]> {
    const db = this.requireDb();
    const ids: string[] = [];
    for (let i = 0; i < items.length; i += 500) {
      const batch = writeBatch(db);
      for (const item of items.slice(i, i + 500)) {
        const ref = doc(collection(db, name));
        batch.set(ref, clean(item));
        ids.push(ref.id);
      }
      await batch.commit();
    }
    return ids;
  }

  private requireAuth(): Auth {
    if (!this.auth) throw new Error('Firebase is not configured. Fill in src/environments/environment.ts.');
    return this.auth;
  }

  private requireDb(): Firestore {
    if (!this.db) throw new Error('Firebase is not configured. Fill in src/environments/environment.ts.');
    return this.db;
  }
}

/** Firestore rejects `undefined` values; drop them. */
function clean<T extends object>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const configModules = import.meta.glob<{ default?: FirebaseWebConfig } & FirebaseWebConfig>(
  '../../firebase-applet-config.json',
  { eager: true }
);
const localConfigModule = Object.values(configModules)[0];
const localConfig: FirebaseWebConfig = localConfigModule?.default ?? localConfigModule ?? {};

const envVal = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '');

const resolvedConfig: FirebaseWebConfig = {
  apiKey: envVal(import.meta.env.VITE_FIREBASE_API_KEY) || localConfig.apiKey,
  authDomain: envVal(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || localConfig.authDomain,
  projectId: envVal(import.meta.env.VITE_FIREBASE_PROJECT_ID) || localConfig.projectId,
  firestoreDatabaseId:
    envVal(import.meta.env.VITE_FIREBASE_DATABASE_ID) || localConfig.firestoreDatabaseId,
  storageBucket: envVal(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || localConfig.storageBucket,
  messagingSenderId:
    envVal(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || localConfig.messagingSenderId,
  appId: envVal(import.meta.env.VITE_FIREBASE_APP_ID) || localConfig.appId,
};

const hasValidConfig = Boolean(resolvedConfig.apiKey && resolvedConfig.projectId);

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
let initErrorCode: string | null = null;

if (hasValidConfig) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp(resolvedConfig);
    auth = getAuth(app);
    db = resolvedConfig.firestoreDatabaseId
      ? getFirestore(app, resolvedConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch (err: unknown) {
    console.error('Firebase initialization failed:', err);
    initErrorCode =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : 'auth/invalid-api-key';
    auth = null;
    db = null;
  }
}

async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
// Store the OAuth access token strictly in memory (never in localStorage/sessionStorage).
let cachedAccessToken: string | null = null;

export interface GoogleSessionUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthSignedOut?: () => void
) => {
  if (!auth) {
    onAuthSignedOut?.();
    return () => {};
  }

  getRedirectResult(auth)
    .then((result) => {
      if (result?.user && result.user.emailVerified) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        cachedAccessToken = credential?.accessToken ?? null;
        onAuthSuccess?.(result.user, cachedAccessToken);
      }
    })
    .catch((err) => {
      console.error('Google redirect sign-in check:', err);
    });

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && user.emailVerified) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthSignedOut?.();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string | null;
}> => {
  if (!auth) {
    const err = new Error(
      initErrorCode
        ? `Firebase Auth failed to initialize (${initErrorCode}).`
        : 'Firebase Auth configuration is missing.'
    );
    (err as Error & { code?: string }).code = initErrorCode || 'auth/missing-config';
    throw err;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    const isStandaloneTopWindow = typeof window !== 'undefined' && window.self === window.top;
    if (
      isStandaloneTopWindow &&
      (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
    ) {
      await signInWithRedirect(auth, provider);
      return new Promise(() => {});
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignIn = async (
  email: string,
  password: string
): Promise<User> => {
  if (!auth) {
    const err = new Error(
      initErrorCode
        ? `Firebase Auth failed to initialize (${initErrorCode}).`
        : 'Firebase Auth configuration is missing.'
    );
    (err as Error & { code?: string }).code = initErrorCode || 'auth/missing-config';
    throw err;
  }
  try {
    isSigningIn = true;
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (!result.user.emailVerified) {
      await sendEmailVerification(result.user);
      await signOut(auth);
      const err = new Error('Please verify your email address before signing in.');
      (err as Error & { code?: string }).code = 'auth/email-not-verified';
      throw err;
    }
    return result.user;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignUp = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<void> => {
  if (!auth) {
    const err = new Error(
      initErrorCode
        ? `Firebase Auth failed to initialize (${initErrorCode}).`
        : 'Firebase Auth configuration is missing.'
    );
    (err as Error & { code?: string }).code = initErrorCode || 'auth/missing-config';
    throw err;
  }
  try {
    isSigningIn = true;
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (fullName) {
      await updateProfile(result.user, { displayName: fullName });
    }
    await sendEmailVerification(result.user);
    await signOut(auth);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  if (auth) {
    await signOut(auth);
  }
};

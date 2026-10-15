/**
 * Mobile auth provider — Google sign-in via expo-auth-session,
 * custom JWT persisted in SecureStore, sent as Bearer by the API client.
 *
 * Setup: fill EXPO_PUBLIC_GOOGLE_*_CLIENT_ID in apps/mobile/.env
 * (Google Cloud Console → Credentials → OAuth client IDs).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as SecureStore from "expo-secure-store";
import { JWT_KEY, mobileLogin } from "../api/client";

WebBrowser.maybeCompleteAuthSession();

interface AuthValue {
  jwt: string | null;
  loading: boolean;
  authLoading: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function configured(id: string | undefined): string | undefined {
  return id && !id.startsWith("your-") ? id : undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [jwt, setJwt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Explicit redirect URI (no Expo login needed — whitelist THIS in
  // Google Cloud Console → Credentials → OAuth client → Authorized
  // redirect URIs). NOTE: if this logs an https://auth.expo.io proxy URI
  // instead of an exp:// URI, switch to
  // makeRedirectUri({ useProxy: false, scheme: "reflex-mobile" }).
  // const redirectUri = "https://auth.expo.io/@vudemrishik/reflex-mobile";
  // By setting useProxy to true, the hook automatically builds the 
// https://auth.expo.io URL AND attaches your local USB address to it.
const redirectUri = AuthSession.makeRedirectUri();
  // Log once (guard against re-render spam).
  const loggedUriRef = useRef<string | null>(null);
  if (loggedUriRef.current !== redirectUri) {
    loggedUriRef.current = redirectUri;
    console.log(
      "\n========================\nMY EXACT REDIRECT URI IS:\n",
      redirectUri,
      "\n========================\n"
    );
  }

  // EXPO_PUBLIC_GOOGLE_CLIENT_ID is primary; the older _WEB_ name still works.
  const webClientId = configured(
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: webClientId,
    androidClientId: configured(
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    ),
    iosClientId: configured(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    webClientId,
    redirectUri,
  });

  // Restore persisted session.
  useEffect(() => {
    SecureStore.getItemAsync(JWT_KEY)
      .then(setJwt)
      .finally(() => setLoading(false));
  }, []);

  // Handle the Google redirect back into the app.
  useEffect(() => {
    if (response?.type !== "success") return;
    const { authentication } = response;
    if (!authentication?.accessToken) return;
    setAuthLoading(true);
    mobileLogin({
      accessToken: authentication.accessToken,
      idToken: authentication.idToken ?? undefined,
    })
      .then(setJwt)
      .catch((e) =>
        console.log("[auth] mobileLogin failed:", e?.message ?? e)
      )
      .finally(() => setAuthLoading(false));
  }, [response]);

  const signIn = useCallback(() => {
    if (!webClientId || !request) {
      console.log(
        "[auth] Google sign-in not configured — set a real EXPO_PUBLIC_GOOGLE_CLIENT_ID in apps/mobile/.env and restart with -c"
      );
      return;
    }
    void promptAsync();
  }, [webClientId, request, promptAsync]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(JWT_KEY);
    setJwt(null);
  }, []);

  const value = useMemo(
    () => ({ jwt, loading, authLoading, signIn, signOut }),
    [jwt, loading, authLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

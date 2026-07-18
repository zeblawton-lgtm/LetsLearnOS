import React, { createContext, useContext, useState, useCallback } from "react";
import { api, type Profile, type SessionInfo } from "@/lib/api";
import * as music from "@/lib/music";

interface SessionState {
  profile: Profile | null;
  session: SessionInfo | null;
  isParentOverlayOpen: boolean;
  isLoading: boolean;
}

interface SessionActions {
  startSession: (profile: Profile) => Promise<void>;
  endSession: () => Promise<void>;
  openParentOverlay: () => void;
  closeParentOverlay: () => void;
  logAttempt: (module: string, questionId: string, correct: boolean) => Promise<void>;
}

const SessionContext = createContext<(SessionState & SessionActions) | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isParentOverlayOpen, setIsParentOverlayOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startSession = useCallback(async (p: Profile) => {
    music.playScene("menu"); // begin music within the user gesture (autoplay unlock)
    setIsLoading(true);
    try {
      const sess = await api.startSession(p.id);
      setProfile(p);
      setSession(sess);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const endSession = useCallback(async () => {
    music.stop();
    if (session) {
      await api.endSession(session.id).catch(() => {});
    }
    setProfile(null);
    setSession(null);
    setIsParentOverlayOpen(false);
  }, [session]);

  const logAttempt = useCallback(async (module: string, questionId: string, correct: boolean) => {
    if (!session || !profile) return;
    await api.logAttempt({ sessionId: session.id, profileId: profile.id, module, questionId, correct }).catch(() => {});
  }, [session, profile]);

  return (
    <SessionContext.Provider value={{
      profile, session, isParentOverlayOpen, isLoading,
      startSession, endSession,
      openParentOverlay: () => setIsParentOverlayOpen(true),
      closeParentOverlay: () => setIsParentOverlayOpen(false),
      logAttempt,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

import { useSyncExternalStore } from 'react';
import { anonymousSession } from '../services/anonymousSession';

export function useAnonymousSession(source = anonymousSession) {
  const state = useSyncExternalStore(
    source.subscribe, source.getSnapshot, source.getSnapshot,
  );
  // Neither Session/User objects nor access/refresh tokens leave the service.
  return { ...state, ensureSession: source.ensureSession, getSnapshot: source.getSnapshot };
}

import { supabase } from '../../../lib/supabase/client';
import { createAnonymousSessionStore } from './anonymousSessionStore';

// No Auth calls during module evaluation. getSession is deferred to subscription/action.
export const anonymousSession = createAnonymousSessionStore(supabase?.auth ?? null);

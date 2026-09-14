import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase environment variables are missing.');
}

const safeSupabaseFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input as any, init as any);
  try {
    const url = typeof input === 'string' ? input : String((input as Request)?.url || '');
    if ((response.status === 401 || response.status === 403) && (url.includes('/auth/v1/user') || url.includes('/settings'))) {
      localStorage.removeItem('moldatk_session');
      window.dispatchEvent(new CustomEvent('moldatk-auth-expired'));
    }
  } catch (e) {}
  return response;
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: safeSupabaseFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

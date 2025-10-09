import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
}

let browserClient: SupabaseClient | undefined;
let serviceClient: SupabaseClient | undefined;

export const getBrowserSupabaseClient = () => {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
};

export const getServiceSupabaseClient = () => {
  if (typeof window !== "undefined") {
    throw new Error("Service role client should only be created on the server");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
};

export type BrowserSupabaseClient = ReturnType<typeof getBrowserSupabaseClient>;
export type ServiceSupabaseClient = ReturnType<typeof getServiceSupabaseClient>;


import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string, role?: "user" | "admin") => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {


    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string, role: "user" | "admin" = "user") => {
    const redirectUrl = `${window.location.origin}/`;

    // Create auth user with role in metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role, // Store role in metadata for trigger
        },
      },
    });

    if (authError) {
      return { error: authError as Error | null };
    }

    // Wait for user to be created and trigger to run
    if (authData.user) {
      // Wait for the trigger to create the profile and set initial role
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Manually set role as fallback (in case trigger doesn't work or sets wrong role)
      // This ensures role is always set correctly based on user selection
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: authData.user.id,
          role: role,
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.error('Error setting user role:', roleError);
        // Try alternative: delete existing and insert new
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', authData.user.id);

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: authData.user.id, role: role });

        if (insertError) {
          console.error('Failed to set role even after retry:', insertError);
        } else {
          console.log(`Role '${role}' set for user ${authData.user.id} (after retry)`);
        }
      } else {
        console.log(`Role '${role}' successfully set for user ${authData.user.id}`);
      }
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        return { error: error as Error | null };
      }

      // OAuth redirect will happen automatically
      // The error will be null if redirect is successful
      return { error: null };
    } catch (err) {
      console.error('Google sign-in exception:', err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

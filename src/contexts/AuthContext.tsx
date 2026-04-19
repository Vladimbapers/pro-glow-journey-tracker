import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { AuthUser, UserRole, AuthContextType } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { migrateLocalStorageToSupabase } from '@/services/localToSupabaseMigration';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const buildAuthUser = async (sessionUser: User): Promise<AuthUser | null> => {
  // Fetch profile + role in parallel
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', sessionUser.id).order('role', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!profile) return null;

  return {
    id: sessionUser.id,
    email: profile.email,
    name: profile.name,
    role: (roleRow?.role as UserRole) ?? 'user',
    avatar: profile.avatar,
    height: profile.height,
    weight: profile.weight,
    gender: profile.gender,
    age: profile.age,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const refreshUsers = useCallback(async () => {
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    const { data: roles, error: rErr } = await supabase.from('user_roles').select('user_id, role');
    if (pErr || rErr || !profiles) return;

    const roleMap = new Map<string, UserRole>();
    (roles ?? []).forEach((r: any) => {
      // 'admin' wins over 'user'
      const existing = roleMap.get(r.user_id);
      if (!existing || r.role === 'admin') roleMap.set(r.user_id, r.role);
    });

    setUsers(
      profiles.map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        role: roleMap.get(p.id) ?? 'user',
        avatar: p.avatar,
        height: p.height,
        weight: p.weight,
        gender: p.gender,
        age: p.age,
      }))
    );
  }, []);

  // Hydrate session + listen for changes
  useEffect(() => {
    let isMounted = true;

    const handleSession = async (session: Session | null) => {
      if (!session?.user) {
        if (isMounted) {
          setUser(null);
          setUsers([]);
          setLoading(false);
        }
        return;
      }
      // Defer DB calls so we don't block onAuthStateChange
      setTimeout(async () => {
        const authUser = await buildAuthUser(session.user);
        if (!isMounted) return;
        setUser(authUser);
        setLoading(false);
        if (authUser?.role === 'admin') {
          refreshUsers();
        }
        // One-time localStorage import on first login (per device)
        if (authUser) {
          migrateLocalStorageToSupabase(authUser.id).catch((e) =>
            console.warn('localStorage migration skipped:', e)
          );
        }
      }, 0);
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshUsers]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      toast({ title: 'Login Failed', description: error?.message ?? 'Invalid credentials', variant: 'destructive' });
      throw error ?? new Error('Login failed');
    }
    const authUser = await buildAuthUser(data.user);
    if (!authUser) throw new Error('Profile not found');
    toast({ title: 'Login Successful', description: `Welcome back, ${authUser.name}!` });
    navigate('/');
    return authUser;
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: UserRole = 'user'
  ): Promise<AuthUser | null> => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });
    if (error) {
      toast({ title: 'Registration Failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    if (!data.user) {
      toast({ title: 'Check your email', description: 'Confirm your email to finish signing up.' });
      return null;
    }

    // If admin role requested, attempt to insert (will be rejected by RLS unless caller is admin).
    // For the first-ever admin, you must promote them via the database directly.
    if (role === 'admin') {
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'admin' });
    }

    toast({ title: 'Registration Successful', description: 'Your account has been created' });
    navigate('/');
    return await buildAuthUser(data.user);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsers([]);
    toast({ title: 'Logged Out', description: 'You have been logged out successfully' });
    navigate('/login');
  };

  const updateUserProfile = async (userData: Partial<AuthUser>): Promise<AuthUser | undefined> => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        name: userData.name ?? user.name,
        avatar: userData.avatar ?? user.avatar,
        height: userData.height ?? user.height,
        weight: userData.weight ?? user.weight,
        gender: userData.gender ?? user.gender,
        age: userData.age ?? user.age,
      })
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    const updated = { ...user, ...userData } as AuthUser;
    setUser(updated);
    toast({ title: 'Profile Updated', description: 'Your profile has been updated successfully' });
    return updated;
  };

  // Admin: cannot create auth users client-side without service role; surface a helpful error.
  const addUser = async (_n: string, _e: string, _p: string, _r: UserRole): Promise<AuthUser | undefined> => {
    toast({
      title: 'Use the public sign-up form',
      description: 'New accounts are created via the registration page. You can change their role from the user list.',
    });
    return undefined;
  };

  const deleteUser = async (userId: string) => {
    if (user && userId === user.id) {
      toast({ title: 'Deletion Failed', description: 'You cannot delete your own account here.', variant: 'destructive' });
      return;
    }
    // Without service role we can't remove auth.users from the client, but we can remove their profile/role data,
    // which immediately revokes access via RLS.
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.from('user_roles').delete().eq('user_id', userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    toast({ title: 'User Removed', description: 'Profile and roles deleted.' });
  };

  const updateUser = async (userId: string, userData: Partial<AuthUser>): Promise<AuthUser | undefined> => {
    const { error } = await supabase
      .from('profiles')
      .update({
        name: userData.name,
        avatar: userData.avatar,
        height: userData.height,
        weight: userData.weight,
        gender: userData.gender,
        age: userData.age,
      })
      .eq('id', userId);

    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
      throw error;
    }

    // Role change handling
    if (userData.role) {
      // Wipe existing roles for this user, then insert the new one
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('user_roles').insert({ user_id: userId, role: userData.role });
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...userData } : u)));
    toast({ title: 'User Updated', description: 'User has been updated successfully' });
    return { ...(users.find((u) => u.id === userId) as AuthUser), ...userData };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        loading,
        login,
        register,
        logout,
        updateUserProfile,
        addUser,
        deleteUser,
        updateUser,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// User and authentication related types

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  height?: number | null;
  weight?: number | null;
  gender?: string | null;
  age?: number | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  users: AuthUser[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  updateUserProfile: (userData: Partial<AuthUser>) => Promise<AuthUser | undefined>;
  addUser: (name: string, email: string, password: string, role: UserRole) => Promise<AuthUser | undefined>;
  deleteUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, userData: Partial<AuthUser>) => Promise<AuthUser | undefined>;
  refreshUsers: () => Promise<void>;
}

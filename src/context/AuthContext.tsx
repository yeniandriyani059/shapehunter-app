import React, { createContext, useContext, useState } from 'react';

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextValue {
  user: LocalUser | null;
  idToken: string | null;
  loading: boolean;
  signInTeacher: () => Promise<void>;
  signOutTeacher: () => Promise<void>;
}

const DEFAULT_TEACHER: LocalUser = {
  uid: 'teacher-yennia',
  email: 'sdn06slemped@gmail.com',
  displayName: 'Bu Guru Yennia (SDN Karanggintung 06)',
};

const AuthContext = createContext<AuthContextValue>({
  user: DEFAULT_TEACHER,
  idToken: 'teacher-token',
  loading: false,
  signInTeacher: async () => {},
  signOutTeacher: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(DEFAULT_TEACHER);
  const [idToken, setIdToken] = useState<string | null>('teacher-token');
  const [loading] = useState(false);

  const signInTeacher = async () => {
    setUser(DEFAULT_TEACHER);
    setIdToken('teacher-token');
  };

  const signOutTeacher = async () => {
    setUser(null);
    setIdToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, idToken, loading, signInTeacher, signOutTeacher }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

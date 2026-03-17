import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { AppUser } from '@/types/user';
import { getUserDoc, ensureAdminDoc } from '@/services/userService';

export function useCurrentUser(firebaseUser: User | null) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setAppUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    ensureAdminDoc(firebaseUser.uid, firebaseUser.email || '')
      .then(setAppUser)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  return { appUser, loading };
}

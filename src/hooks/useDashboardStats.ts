import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTenant } from '@/contexts/TenantContext';

interface DashboardStats {
  activeConversations: number;
  totalUsers: number;
  kanbanCards: number;
  todayInteractions: number;
  departmentCounts: Record<string, number>;
}

export function useDashboardStats(userId?: string, department?: string, filterDepartment?: string) {
  const { tenantId } = useTenant();
  const [stats, setStats] = useState<DashboardStats>({
    activeConversations: 0,
    totalUsers: 0,
    kanbanCards: 0,
    todayInteractions: 0,
    departmentCounts: {},
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = department === 'Atendente' || department === 'Tecnologia';
  const isFiltering = isAdmin && filterDepartment && filterDepartment !== 'Todos';

  useEffect(() => {
    if (!db || !userId || !department) { setLoading(false); return; }

    const unsubs: (() => void)[] = [];

    const addTenantFilter = (constraints: any[]) => {
      if (tenantId) constraints.push(where('tenantId', '==', tenantId));
      return constraints;
    };

    // Conversations
    const convConstraints: any[] = [];
    addTenantFilter(convConstraints);
    if (isFiltering) {
      convConstraints.push(where('department', '==', filterDepartment));
    } else if (!isAdmin) {
      convConstraints.push(where('participants', 'array-contains', userId));
    }

    const convQuery = convConstraints.length > 0
      ? query(collection(db, 'conversations'), ...convConstraints)
      : collection(db, 'conversations');

    unsubs.push(onSnapshot(convQuery, snap => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let todayCount = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const updated = data.updatedAt?.toDate?.() || new Date(0);
        if (updated >= today) todayCount++;
      });
      setStats(prev => ({ ...prev, activeConversations: snap.size, todayInteractions: todayCount }));
    }));

    // Users
    const userConstraints: any[] = [];
    addTenantFilter(userConstraints);
    if (isFiltering) {
      userConstraints.push(where('department', '==', filterDepartment));
    } else if (!isAdmin) {
      userConstraints.push(where('department', '==', department));
    }

    const usersQuery = userConstraints.length > 0
      ? query(collection(db, 'users'), ...userConstraints)
      : collection(db, 'users');

    unsubs.push(onSnapshot(usersQuery, snap => {
      const depts: Record<string, number> = {};
      snap.docs.forEach(d => {
        const dept = d.data().department || 'Outros';
        depts[dept] = (depts[dept] || 0) + 1;
      });
      setStats(prev => ({ ...prev, totalUsers: snap.size, departmentCounts: depts }));
    }));

    // Kanban cards
    const kanbanConstraints: any[] = [];
    addTenantFilter(kanbanConstraints);
    if (isFiltering) {
      kanbanConstraints.push(where('department', '==', filterDepartment));
    } else if (!isAdmin) {
      kanbanConstraints.push(where('assignedTo', '==', userId));
    }

    const kanbanQuery = kanbanConstraints.length > 0
      ? query(collection(db, 'kanban_cards'), ...kanbanConstraints)
      : collection(db, 'kanban_cards');

    unsubs.push(onSnapshot(kanbanQuery, snap => {
      setStats(prev => ({ ...prev, kanbanCards: snap.size }));
      setLoading(false);
    }));

    return () => unsubs.forEach(u => u());
  }, [userId, department, isAdmin, isFiltering, filterDepartment, tenantId]);

  return { stats, loading, isAdmin };
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  readStoredPermissionGroups,
  type PermissionGroup,
  type ActionPermission,
  type GeneralPermissions,
} from '../../features/personnel/PermissionGroupsPage';

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    let role = parsed.role;
    if (!role && Array.isArray(parsed.roles) && parsed.roles.length > 0) {
      const r = parsed.roles[0];
      role = typeof r === 'string' ? r : (r?.name || r?.role || r?.id);
    }
    return { ...parsed, role: String(role || 'admin').toLowerCase() };
  } catch {
    return {};
  }
}

export function usePermissions() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handlePermissionsChange = () => {
      setTimeout(() => setTick((prev) => prev + 1), 0);
    };
    window.addEventListener('storage', handlePermissionsChange);
    window.addEventListener('permissions-updated', handlePermissionsChange);
    return () => {
      window.removeEventListener('storage', handlePermissionsChange);
      window.removeEventListener('permissions-updated', handlePermissionsChange);
    };
  }, []);

  const currentUser = getStoredUser();
  const userRole = (currentUser.role || 'admin').toLowerCase();
  const isAdmin = userRole === 'admin';
  const userEmailOrId = (currentUser.email || currentUser.id || '').toLowerCase();
  const userGroupIds: string[] = currentUser.groupIds || (currentUser.groupId ? [currentUser.groupId] : []);

  const permissionGroups = useMemo(() => {
    return readStoredPermissionGroups();
  }, [tick]);

  const userActiveGroups = useMemo(() => {
    if (isAdmin) return [];

    const matched = permissionGroups.filter((g: PermissionGroup) => {
      const inGroupIds = userGroupIds.includes(g.id);
      const inMembers = (g.memberIds || []).some(
        (m: string) => m.toLowerCase() === userEmailOrId || (currentUser.email && m.toLowerCase() === currentUser.email.toLowerCase())
      );
      return inGroupIds || inMembers;
    });

    return matched;
  }, [permissionGroups, userGroupIds, userEmailOrId, isAdmin, currentUser.email]);

  const canViewMenu = useCallback(
    (menuId: string): boolean => {
      if (isAdmin) return true;
      if (userActiveGroups.length === 0) return false;
      return userActiveGroups.some((g: PermissionGroup) => g.menuPermissions?.[menuId]?.view === true);
    },
    [isAdmin, userActiveGroups]
  );

  const canPerformAction = useCallback(
    (menuId: string, action: keyof ActionPermission): boolean => {
      if (isAdmin) return true;
      if (userActiveGroups.length === 0) return false;
      return userActiveGroups.some((g: PermissionGroup) => g.menuPermissions?.[menuId]?.[action] === true);
    },
    [isAdmin, userActiveGroups]
  );

  const canGeneralPermission = useCallback(
    (permKey: keyof GeneralPermissions): boolean => {
      if (isAdmin) return true;
      if (userActiveGroups.length === 0) return false;
      return userActiveGroups.some((g: PermissionGroup) => g.generalPermissions?.[permKey] === true);
    },
    [isAdmin, userActiveGroups]
  );

  return {
    currentUser,
    userRole,
    isAdmin,
    userActiveGroups,
    permissionGroups,
    canViewMenu,
    canPerformAction,
    canGeneralPermission,
  };
}

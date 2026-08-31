import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  readStoredPermissionGroups,
  saveStoredPermissionGroups,
  getDefaultGeneralPermissions,
  getDefaultMenuPermissions,
  type PermissionGroup,
  type ActionPermission,
  type GeneralPermissions,
} from '../../features/personnel/PermissionGroupsPage';

const API_BASE_URL = '/api';

function parseJson<T = any>(val: any): T {
  if (!val) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val as any;
    }
  }
  return val;
}

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

    let groupIds: string[] = [];
    if (Array.isArray(parsed.groupIds)) {
      groupIds = parsed.groupIds.map(String).map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof parsed.groupIds === 'string') {
      try {
        const p = JSON.parse(parsed.groupIds);
        if (Array.isArray(p)) {
          groupIds = p.map(String).map((s: string) => s.trim()).filter(Boolean);
        } else if (parsed.groupIds.trim()) {
          groupIds = [parsed.groupIds.trim()];
        }
      } catch {
        if (parsed.groupIds.trim()) {
          groupIds = parsed.groupIds.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
    } else if (parsed.groupId) {
      groupIds = [String(parsed.groupId).trim()];
    }

    try {
      const rawPersonnel = localStorage.getItem('smart-wms-personnel-users');
      if (rawPersonnel) {
        const pUsers = JSON.parse(rawPersonnel);
        if (Array.isArray(pUsers)) {
          const matchedPUser = pUsers.find(
            (u: any) =>
              (u.id && (u.id === parsed.id || u.id === parsed.sub)) ||
              (u.email && parsed.email && u.email.toLowerCase() === parsed.email.toLowerCase())
          );
          if (matchedPUser) {
            let pGroupIds = matchedPUser.groupIds || (matchedPUser.groupId ? [matchedPUser.groupId] : []);
            if (typeof pGroupIds === 'string') {
              try {
                pGroupIds = JSON.parse(pGroupIds);
              } catch {
                pGroupIds = pGroupIds.split(',');
              }
            }
            if (Array.isArray(pGroupIds)) {
              groupIds = Array.from(
                new Set([...groupIds, ...pGroupIds.map(String).map((s: string) => s.trim()).filter(Boolean)])
              );
            }
          }
        }
      }
    } catch { /* ignore */ }

    return {
      ...parsed,
      role: String(role || 'admin').toLowerCase(),
      groupIds,
    };
  } catch {
    return {};
  }
}

export function usePermissions() {
  const [tick, setTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);

  // Sync groups & user profile from API
  const syncPermissionsFromApi = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [teamsRes, meRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/project-teams`, { headers }),
        fetch(`${API_BASE_URL}/users/me`, { headers }),
      ]);

      if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
        const apiData = await teamsRes.value.json();
        if (Array.isArray(apiData)) {
          const localGroups = readStoredPermissionGroups();
          const groupMap = new Map<string, PermissionGroup>();

          localGroups.forEach((g) => groupMap.set(g.id, g));

          apiData.forEach((t: any) => {
            const existing = groupMap.get(t.id);
            const memberIds = Array.from(
              new Set([
                ...(t.memberIds || []),
                ...(t.storekeeperIds || []),
                ...(t.inventoryCheckerIds || []),
                ...(existing?.memberIds || []),
              ])
            );

            const rawGen = parseJson(t.generalPermissions);
            const mergedGeneral =
              rawGen && Object.keys(rawGen).length > 0
                ? rawGen
                : parseJson(existing?.generalPermissions) || getDefaultGeneralPermissions();

            const rawMenu = parseJson(t.menuPermissions);
            const mergedMenu =
              rawMenu && Object.keys(rawMenu).length > 0
                ? rawMenu
                : parseJson(existing?.menuPermissions) || getDefaultMenuPermissions(true);

            groupMap.set(t.id, {
              id: t.id,
              name: t.name,
              code: t.code,
              description: t.description || '',
              memberIds,
              generalPermissions: mergedGeneral,
              menuPermissions: mergedMenu,
            });
          });

          const mergedGroups = Array.from(groupMap.values());
          saveStoredPermissionGroups(mergedGroups);
        }
      }

      if (meRes.status === 'fulfilled' && meRes.value.ok) {
        const meData = await meRes.value.json();
        if (meData && meData.id) {
          const currentRaw = localStorage.getItem('user');
          const currentParsed = currentRaw ? JSON.parse(currentRaw) : {};
          const rawGroupIds = meData.groupIds || currentParsed.groupIds || [];
          const normalizedGroupIds = Array.isArray(rawGroupIds)
            ? rawGroupIds.map(String).map((s: string) => s.trim()).filter(Boolean)
            : typeof rawGroupIds === 'string'
            ? [rawGroupIds.trim()]
            : [];

          const updatedUser = {
            ...currentParsed,
            ...meData,
            role: (meData.roles?.[0]?.name || meData.role || currentParsed.role || 'staff').toLowerCase(),
            groupIds: normalizedGroupIds,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }

      setTick((prev) => prev + 1);
    } catch {
      // Local fallback active
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncPermissionsFromApi();

    const handlePermissionsChange = () => {
      setTimeout(() => setTick((prev) => prev + 1), 0);
    };

    window.addEventListener('storage', handlePermissionsChange);
    window.addEventListener('permissions-updated', handlePermissionsChange);
    window.addEventListener('focus', handlePermissionsChange);

    return () => {
      window.removeEventListener('storage', handlePermissionsChange);
      window.removeEventListener('permissions-updated', handlePermissionsChange);
      window.removeEventListener('focus', handlePermissionsChange);
    };
  }, [syncPermissionsFromApi]);

  const currentUser = getStoredUser();
  const userRole = (currentUser.role || 'admin').toLowerCase();
  const isAdmin = userRole === 'admin';
  const userGroupIds: string[] = currentUser.groupIds || [];

  const permissionGroups = useMemo(() => {
    return readStoredPermissionGroups();
  }, [tick]);

  const userActiveGroups = useMemo(() => {
    if (isAdmin) return [];

    const userEmail = String(currentUser.email || '').trim().toLowerCase();
    const userId = String(currentUser.id || currentUser.sub || '').trim().toLowerCase();
    const userFullName = String(currentUser.fullName || '').trim().toLowerCase();
    const normalizedUserGroupIds = (userGroupIds || []).map((id) => String(id || '').trim().toLowerCase());

    // 1. Gather all group IDs and Names linked to user across storage
    const extendedGroupIds = [...normalizedUserGroupIds];
    try {
      const rawPersonnel = localStorage.getItem('smart-wms-personnel-users');
      if (rawPersonnel) {
        const pUsers = JSON.parse(rawPersonnel);
        if (Array.isArray(pUsers)) {
          const matchedPUser = pUsers.find(
            (u: any) =>
              (u.id && (String(u.id).toLowerCase() === userId || String(u.id).toLowerCase() === userEmail)) ||
              (u.email && String(u.email).toLowerCase() === userEmail)
          );
          if (matchedPUser && Array.isArray(matchedPUser.groupIds)) {
            matchedPUser.groupIds.forEach((gid: string) => {
              const str = String(gid || '').trim().toLowerCase();
              if (str && !extendedGroupIds.includes(str)) {
                extendedGroupIds.push(str);
              }
            });
          }
        }
      }
    } catch { /* ignore */ }

    // Collect all group names that the user is assigned to
    const assignedGroupNames = new Set<string>();
    permissionGroups.forEach((g: PermissionGroup) => {
      if (!g) return;
      const gId = String(g.id || '').trim().toLowerCase();
      const gName = String(g.name || '').trim().toLowerCase();
      if (extendedGroupIds.includes(gId) || (gName && extendedGroupIds.includes(gName))) {
        if (gName) assignedGroupNames.add(gName);
      }
    });

    const matched = permissionGroups.filter((g: PermissionGroup) => {
      if (!g) return false;
      const gId = String(g.id || '').trim().toLowerCase();
      const gName = String(g.name || '').trim().toLowerCase();
      const gCode = String(g.code || '').trim().toLowerCase();

      // Check if user has this group by ID, Name, or Code
      if (
        extendedGroupIds.includes(gId) ||
        (gName && extendedGroupIds.includes(gName)) ||
        (gCode && extendedGroupIds.includes(gCode))
      ) {
        return true;
      }

      // Check if any assigned group has matching name
      if (gName && assignedGroupNames.has(gName)) {
        return true;
      }

      // Check if user is in memberIds
      let members: string[] = [];
      if (Array.isArray(g.memberIds)) {
        members = g.memberIds;
      } else if (typeof g.memberIds === 'string') {
        try {
          const parsed = JSON.parse(g.memberIds);
          members = Array.isArray(parsed) ? parsed : String(g.memberIds).split(',');
        } catch {
          members = String(g.memberIds).split(',');
        }
      }

      return members.some((m: string) => {
        const mLower = String(m || '').trim().toLowerCase();
        return (
          (userEmail && mLower === userEmail) ||
          (userId && mLower === userId) ||
          (userFullName && mLower === userFullName)
        );
      });
    });

    return matched;
  }, [permissionGroups, userGroupIds, isAdmin, currentUser.email, currentUser.id, currentUser.sub, currentUser.fullName]);

  const canViewMenu = useCallback(
    (menuId: string): boolean => {
      if (isAdmin) return true;
      if (userActiveGroups.length === 0) return true;

      let hasExplicitDeny = false;
      let hasExplicitAllow = false;

      for (const g of userActiveGroups) {
        const menuPerms = parseJson(g.menuPermissions) || {};
        const p = menuPerms[menuId];
        if (p) {
          if (p.view === false || p.view === 'false' || p.view === 0) {
            hasExplicitDeny = true;
          } else if (p.view === true || p.view === 'true' || p.view === 1 || Boolean(p.view)) {
            hasExplicitAllow = true;
          }
        }
      }

      if (hasExplicitDeny && !hasExplicitAllow) return false;
      return true;
    },
    [isAdmin, userActiveGroups]
  );

  const canPerformAction = useCallback(
    (menuId: string, action: keyof ActionPermission): boolean => {
      if (isAdmin) return true;
      if (userActiveGroups.length === 0) return true;
      return userActiveGroups.some((g: PermissionGroup) => {
        const menuPerms = parseJson(g.menuPermissions) || {};
        return menuPerms[menuId]?.[action] === true;
      });
    },
    [isAdmin, userActiveGroups]
  );

  const canGeneralPermission = useCallback(
    (permKey: keyof GeneralPermissions): boolean => {
      if (isAdmin) return true;
      if (userActiveGroups.length === 0) return true;
      return userActiveGroups.some((g: PermissionGroup) => {
        const genPerms = parseJson(g.generalPermissions) || {};
        return genPerms[permKey] === true;
      });
    },
    [isAdmin, userActiveGroups]
  );

  return {
    currentUser,
    userRole,
    isAdmin,
    isLoading,
    userActiveGroups,
    permissionGroups,
    canViewMenu,
    canPerformAction,
    canGeneralPermission,
  };
}

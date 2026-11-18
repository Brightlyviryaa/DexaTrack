import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError, request, send } from '../../shared/api/http';
export type Profile = { id: number; employeeNo: string; fullName: string; email: string; department: string | null; isActive: boolean };
export type User = { id: number; employeeId: number | null; email: string; role: 'HR_ADMIN' | 'EMPLOYEE'; isActive: boolean; approval: 'PENDING' | 'APPROVED' | 'REJECTED'; archivedAt: string | null; syncing: boolean; needsActivation: boolean; profile: Profile | null };
export const sessionKey = ['auth', 'session'] as const;
export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: async ({ signal }) => {
    try { return await request<User>('/auth/me', { signal }); }
    catch (e) { if (e instanceof HttpError && e.status === 401) return null; throw e; }
  }, retry: false, staleTime: 0, refetchOnWindowFocus: true });
}
export function useLogout() {
  const client = useQueryClient();
  return async () => {
    await send('/auth/logout', {});
    await client.cancelQueries();
    client.removeQueries({ predicate: q => q.queryKey[0] !== 'auth' });
    client.setQueryData(sessionKey, null);
  };
}

export function useLogin() {
  const client = useQueryClient();
  return async (credentials: { [key: string]: FormDataEntryValue }) => {
    await send('/auth/login', credentials);
    await client.invalidateQueries({ queryKey: sessionKey });
  };
}

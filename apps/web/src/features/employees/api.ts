import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, send } from '../../shared/api/http';
import type { User } from '../auth';
import type { Employee } from './useDemoEmployees';
export const usersKey = ['employees', 'users'] as const;
export const asEmployee = (user: User): Employee => ({ id: user.profile!.id, employeeNo: user.profile!.employeeNo, fullName: user.profile!.fullName, email: user.email, department: user.profile!.department ?? '', role: user.role === 'HR_ADMIN' ? 'HR' : 'Employee', isActive: user.isActive && user.approval === 'APPROVED' && !user.syncing });
export function useUsers(enabled = true) {
  return useQuery({ queryKey: usersKey, queryFn: ({ signal }) => request<User[]>('/users', { signal }), enabled, retry: false });
}
export function useUserMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ path, data, method = 'POST', requestId }: { path: string; data: unknown; method?: string; requestId: string }) => send<{ message: string }>(path, data, method, requestId),
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: usersKey }), client.invalidateQueries({ queryKey: ['workforce'] }), client.invalidateQueries({ queryKey: ['dashboard'] }), client.invalidateQueries({ queryKey: ['attendance-report'] })]),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, send } from '../../shared/api/http';
import type { Evidence, RequestInput, RequestItem, RequestStatus, WorkforceState, WorkLocation } from './model';
import type { Employee } from '../employees';
import type { JSONContent } from '@tiptap/react';

type Snapshot = WorkforceState & { workStartTime: string; today: string; employees: Employee[] };
type RequestDecision = { id: number; status: Exclude<RequestStatus, 'Menunggu'> };
type RequestChange = { action: 'create'; data: RequestInput & { baseVersion?: number } } | { action: 'decide'; data: RequestDecision };
export function useWorkforce(enabled = true, accountId?: number) {
  const client = useQueryClient();
  const queryKey = ['workforce', accountId] as const;
  const query = useQuery({ queryKey, queryFn: ({ signal }) => request<Snapshot>('/workforce', { signal }), enabled, retry: false, refetchInterval: 30000 });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey, exact: true }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['attendance-report'] }),
    client.invalidateQueries({ queryKey: ['attendance-history'] }),
  ]);
  const mutation = useMutation({
    mutationFn: ({ path, data, method }: { path: string; data: unknown; method?: string }) => send(path, data, method),
    onSettled: refresh,
  });
  const requestMutation = useMutation({
    mutationFn: async (change: RequestChange) => {
      if (change.action === 'create') {
        const result = await send<{ request?: RequestItem }>('/requests', change.data);
        return { action: 'create' as const, request: result.request };
      }
      const result = await send<{ request?: Omit<RequestItem, 'name' | 'department'> }>(
        `/requests/${change.data.id}/decision`, { status: change.data.status },
      );
      return { action: 'decide' as const, request: result.request };
    },
    onSuccess: async ({ action, request: saved }) => {
      if (!saved) return;
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<Snapshot>(queryKey, (snapshot) => {
        if (!snapshot) return;
        if (action === 'decide') {
          return { ...snapshot, requests: snapshot.requests.map(item => item.id === saved.id ? { ...item, ...saved } : item) };
        }
        if (snapshot.requests.some(item => item.id === saved.id)) return snapshot;
        return { ...snapshot, requests: [saved, ...snapshot.requests] };
      });
    },
    onSettled: () => { void refresh(); },
  });
  return {
    records: query.data?.records ?? [], requests: query.data?.requests ?? [], location: query.data?.location ?? null,
    workStartTime: query.data?.workStartTime ?? '08:00', employees: query.data?.employees ?? [],
    isPending: query.isPending, hasSnapshot: query.data !== undefined, error: query.error, refetch: query.refetch, isSaving: mutation.isPending || requestMutation.isPending,
    setLocation: (location: WorkLocation, workStartTime: string) => mutation.mutateAsync({ path: '/attendance/settings', data: { ...location, workStartTime }, method: 'PUT' }),
    addRequest: (input: RequestInput, employeeId: number) => {
      const { type, start, end, reason, checkIn, checkOut } = input;
      const baseVersion = query.data?.records.find(r => r.employeeId === employeeId && r.date === start)?.version ?? 0;
      return requestMutation.mutateAsync({ action: 'create', data: { type, start, end, reason, ...(type === 'Koreksi absensi' ? { checkIn, checkOut, baseVersion } : {}) } });
    },
    decideRequest: (id: number, status: RequestDecision['status']) => requestMutation.mutateAsync({ action: 'decide', data: { id, status } }),
    submitAttendance: (_id: number, date: string, kind: 'in' | 'out', evidence: Evidence, progress?: JSONContent) => mutation.mutateAsync({ path: '/attendance', data: { date, kind, evidence, progress } }),
  };
}
export type Workforce = ReturnType<typeof useWorkforce>;

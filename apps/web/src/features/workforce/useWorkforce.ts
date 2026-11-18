import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, send } from '../../shared/api/http';
import type { Evidence, RequestInput, RequestStatus, WorkforceState, WorkLocation } from './model';
import type { Employee } from '../employees';
import type { JSONContent } from '@tiptap/react';

type Snapshot = WorkforceState & { workStartTime: string; today: string; employees: Employee[] };
export function useWorkforce() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['workforce'], queryFn: ({ signal }) => request<Snapshot>('/workforce', { signal }), retry: false, refetchInterval: 30000 });
  const mutation = useMutation({
    mutationFn: ({ path, data, method }: { path: string; data: unknown; method?: string }) => send(path, data, method),
    onSettled: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['workforce'] }), client.invalidateQueries({ queryKey: ['dashboard'] }), client.invalidateQueries({ queryKey: ['attendance-report'] })]); },
  });
  return {
    records: query.data?.records ?? [], requests: query.data?.requests ?? [], location: query.data?.location ?? null,
    workStartTime: query.data?.workStartTime ?? '08:00', employees: query.data?.employees ?? [],
    isPending: query.isPending, hasSnapshot: query.data !== undefined, error: query.error, refetch: query.refetch, isSaving: mutation.isPending,
    setLocation: (location: WorkLocation, workStartTime: string) => mutation.mutateAsync({ path: '/attendance/settings', data: { ...location, workStartTime }, method: 'PUT' }),
    addRequest: (input: RequestInput) => {
      const { type, start, end, reason, checkIn, checkOut } = input;
      const baseVersion = query.data?.records.find(r => r.employeeId === input.employeeId && r.date === start)?.version ?? 0;
      return mutation.mutateAsync({ path: '/requests', data: { type, start, end, reason, ...(type === 'Koreksi absensi' ? { checkIn, checkOut, baseVersion } : {}) } });
    },
    decideRequest: (id: number, status: Exclude<RequestStatus, 'Menunggu'>) => mutation.mutateAsync({ path: `/requests/${id}/decision`, data: { status } }),
    submitAttendance: (_id: number, date: string, kind: 'in' | 'out', evidence: Evidence, progress?: JSONContent) => mutation.mutateAsync({ path: '/attendance', data: { date, kind, evidence, progress } }),
  };
}
export type Workforce = ReturnType<typeof useWorkforce>;

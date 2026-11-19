import { useQuery } from '@tanstack/react-query';
import { request } from '../../shared/api/http';
import type { AttendanceRecord } from './model';

export function useAttendanceHistory(employeeId: number, period: string, enabled: boolean) {
  return useQuery({
    queryKey: ['attendance-history', employeeId, period],
    queryFn: ({ signal }) => request<AttendanceRecord[]>(`/attendance/history?${new URLSearchParams({ period })}`, { signal }),
    enabled: enabled && period !== '',
    retry: false,
    refetchInterval: 30000,
  });
}

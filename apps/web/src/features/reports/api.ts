import { useQuery } from '@tanstack/react-query';
import { request } from '../../shared/api/http';

type Counts = { present: number; late: number; leave: number; sick: number; absent: null };
type AttendanceReport = {
  period: string;
  totals: Counts;
  totalDays: number;
  rows: (Counts & { employeeId: number; fullName: string; department: string | null })[];
};

const reportKey = ['attendance-report'] as const;

export function useAttendanceReport(period: string, search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: [...reportKey, period, term],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ period });
      if (term) params.set('q', term);
      return request<AttendanceReport>(`/reports/attendance?${params}`, { signal });
    },
    enabled: Boolean(period),
    retry: false,
    refetchInterval: 30_000,
  });
}

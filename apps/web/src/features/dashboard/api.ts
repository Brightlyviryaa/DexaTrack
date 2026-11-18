import { useQuery } from '@tanstack/react-query';
import { request } from '../../shared/api/http';
export type DashboardSummary = {
  date: string; workStartTime: string;
  metrics: { employees: number; present: number; late: number; leave: number; sick: number; absent: number; checkedOut: number };
  rows: { id: number; fullName: string; department: string | null; checkIn: string | null; checkOut: string | null; status: string }[];
  weekly: { date: string; present: number; elapsed: boolean }[]; average: number; rate: number;
  tasks: { pending: number; missingCheckout: number; upcomingLeave: number };
};
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: ({ signal }) => request<DashboardSummary>('/dashboard/summary', { signal }), retry: false, refetchInterval: 30000 });
}

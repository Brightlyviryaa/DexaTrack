import type { Workforce } from './useWorkforce';
export function WorkforceStatus({ data }: { data: Workforce }) {
  return data.error ? <div className="employee-error" role="alert"><p>{data.error.message}</p><button onClick={() => void data.refetch()}>Coba lagi</button></div> : data.isPending ? <p className="auth-loading" role="status">Memuat absensi dan pengajuan…</p> : null;
}

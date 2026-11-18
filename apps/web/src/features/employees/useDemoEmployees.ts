import { useState } from 'react';

export type Employee = { id: number; employeeNo: string; fullName: string; email: string; department: string; role: 'Employee' | 'HR'; isActive: boolean };
export type EmployeeForm = Omit<Employee, 'id' | 'employeeNo'>;
const initialEmployees: Employee[] = [
  { id: 1, employeeNo: '00000000-0000-4000-8000-000000000001', fullName: 'Aditya Nugraha', email: 'aditya@dexatrack.id', department: 'Product Design', role: 'Employee', isActive: true },
  { id: 2, employeeNo: '00000000-0000-4000-8000-000000000002', fullName: 'Salsabila Putri', email: 'salsabila@dexatrack.id', department: 'Engineering', role: 'Employee', isActive: true },
  { id: 3, employeeNo: '00000000-0000-4000-8000-000000000003', fullName: 'Rizky Pratama', email: 'rizky@dexatrack.id', department: 'Marketing', role: 'Employee', isActive: true },
  { id: 4, employeeNo: '00000000-0000-4000-8000-000000000004', fullName: 'Nadia Amelia', email: 'nadia@dexatrack.id', department: 'People & Culture', role: 'HR', isActive: true },
  { id: 5, employeeNo: '00000000-0000-4000-8000-000000000005', fullName: 'Dimas Firmansyah', email: 'dimas@dexatrack.id', department: 'Engineering', role: 'Employee', isActive: true },
];
export const emptyForm: EmployeeForm = { fullName: '', email: '', department: '', role: 'Employee', isActive: true };

export function useDemoEmployees() {
  const [employees, setEmployees] = useState(initialEmployees);
  return { employees, setEmployees, reset: () => setEmployees(initialEmployees) };
}

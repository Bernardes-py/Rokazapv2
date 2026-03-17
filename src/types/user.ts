export type Department = 'Atendente' | 'Comercial' | 'Contabilidade' | 'Financeiro' | 'Tecnologia';
export type UserProfile = 'admin' | 'user';

export const DEPARTMENTS: Department[] = ['Atendente', 'Comercial', 'Contabilidade', 'Financeiro', 'Tecnologia'];

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  department: Department;
  profile: UserProfile;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ADMIN_EMAIL = 'kairolopes@gmail.com';

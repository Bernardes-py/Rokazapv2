export interface Tenant {
  id: string;
  name: string;
  logo: string;
  plan: 'basic' | 'pro' | 'enterprise';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

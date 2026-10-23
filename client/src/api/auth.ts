import { apiRequest } from './client';

export type Role = 'customer' | 'seller' | 'driver' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: 'active' | 'suspended';
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface UserResponse {
  user: AuthUser;
}

export function registerCustomer(input: RegisterInput): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/register/customer', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registerSeller(input: RegisterInput): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/register/seller', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: LoginInput): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

export function getCurrentUser(): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/me');
}

export function createDriverAccount(input: RegisterInput): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/admin/drivers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

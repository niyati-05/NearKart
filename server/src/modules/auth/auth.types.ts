import type { ObjectId } from 'mongodb';

export const roles = ['customer', 'seller', 'driver', 'admin'] as const;
export type Role = (typeof roles)[number];

export const userStatuses = ['active', 'suspended'] as const;
export type UserStatus = (typeof userStatuses)[number];

export interface User {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  _id?: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  createdAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user._id!.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
  };
}

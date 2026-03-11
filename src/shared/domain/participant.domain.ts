export interface Participant {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}
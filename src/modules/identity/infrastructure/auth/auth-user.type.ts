import { UserRole } from '../../domain/entities/user.entity';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

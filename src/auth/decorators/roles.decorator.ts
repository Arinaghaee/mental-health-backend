import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../common/enums/role.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// src/app/features/user-profile/dto/response/RoleResponse.ts
import { RoleType } from '../../../../common/model/role-type.enum'; // Import RoleType

export interface RoleResponse {
  id: number;
  name: RoleType; // Sử dụng Enum RoleType
  permissionNames: string[]; // Danh sách tên các permission của role này
}

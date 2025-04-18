// src/app/features/usermanagement/dto/response/UserProfileResponse.ts
import { BusinessProfileResponse } from './BusinessProfileResponse';
import { FarmerProfileResponse } from './FarmerProfileResponse';
import { UserResponse } from './UserResponse';

// Interface này kế thừa UserResponse và thêm các profile tùy chọn
export interface UserProfileResponse extends UserResponse {
  farmerProfile?: FarmerProfileResponse | null;
  businessProfile?: BusinessProfileResponse | null;
}

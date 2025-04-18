import { ReviewStatus } from '../../../../common/model/review-status.enum'; // Correct path
import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse'; // Correct path

export interface ReviewResponse {
  id: number;
  productId: number;
  orderId: number | null;
  consumer: UserInfoSimpleResponse | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string; // ISO date string
  updatedAt: string;
}

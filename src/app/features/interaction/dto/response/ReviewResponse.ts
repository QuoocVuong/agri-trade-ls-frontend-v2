import { ReviewStatus } from '../../../../common/model/review-status.enum'; // Correct path
import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse';
import {ProductInfoResponse} from '../../../catalog/dto/response/ProductInfoResponse'; // Correct path

export interface ReviewResponse {
  id: number;
  //productId: number;
  orderId: number | null;
  consumer: UserInfoSimpleResponse | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  productInfo: ProductInfoResponse | null;
  createdAt: string; // ISO date string
  updatedAt: string;
}

import { ReviewStatus } from '../../../../common/model/review-status.enum';
import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse';
import {ProductInfoResponse} from '../../../catalog/dto/response/ProductInfoResponse';

export interface ReviewResponse {
  id: number;

  orderId: number | null;
  consumer: UserInfoSimpleResponse | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  productInfo: ProductInfoResponse | null;
  createdAt: string; // ISO date string
  updatedAt: string;
}

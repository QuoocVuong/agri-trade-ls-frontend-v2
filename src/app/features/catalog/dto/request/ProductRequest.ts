import { ProductImageRequest } from './ProductImageRequest';
import { ProductPricingTierRequest } from './ProductPricingTierRequest';
import { ProductStatus } from '../../domain/product-status.enum';
import BigDecimal from 'js-big-decimal';

export interface ProductRequest {
  name: string;
  slug?: string; // optional giống backend
  categoryId: number;
  description?: string | null;

  unit: string; // B2C unit
  price: number | string | BigDecimal;
  stockQuantity: number;

  status?: ProductStatus;

  b2bEnabled?: boolean;
  b2bUnit?: string | null;
  minB2bQuantity?: number | null;
  b2bBasePrice?: number | string | BigDecimal | null;

  harvestDate?: string | null; // ISO string
  negotiablePrice?: boolean | null;
  wholesaleUnit?: string | null;
  referenceWholesalePrice?: number | string | BigDecimal | null;

  images?: ProductImageRequest[] | null;
  pricingTiers?: ProductPricingTierRequest[] | null;
}

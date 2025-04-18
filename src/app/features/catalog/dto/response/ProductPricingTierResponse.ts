// src/app/features/catalog/dto/response/ProductPricingTierResponse.ts
import  BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

export interface ProductPricingTierResponse {
  id: number;
  minQuantity: number;
  pricePerUnit: number | string | BigDecimal; // Hoặc chỉ dùng number/string
}

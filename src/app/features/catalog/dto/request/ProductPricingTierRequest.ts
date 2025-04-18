// src/app/features/catalog/dto/request/ProductPricingTierRequest.ts
import  BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

export interface ProductPricingTierRequest {
  minQuantity: number;
  pricePerUnit: number | string | BigDecimal; // Hoặc chỉ dùng number/string
}

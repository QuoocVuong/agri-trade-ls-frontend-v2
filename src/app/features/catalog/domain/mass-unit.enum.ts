// src/app/features/catalog/domain/mass-unit.enum.ts (Tạo file mới)
export enum MassUnit {
  KG = 'kg',
  YEN = 'yến', // 10 kg
  TA = 'tạ',   // 100 kg
  TAN = 'tấn'  // 1000 kg
}

export const MASS_UNIT_FACTORS: { [key in MassUnit]: number } = {
  [MassUnit.KG]: 1,
  [MassUnit.YEN]: 10,
  [MassUnit.TA]: 100,
  [MassUnit.TAN]: 1000
};

export function getMassUnitText(unit: MassUnit | string | null | undefined): string {
  if (!unit) return '';
  switch (unit.toLowerCase()) {
    case MassUnit.KG: return 'kg';
    case MassUnit.YEN: return 'yến';
    case MassUnit.TA: return 'tạ';
    case MassUnit.TAN: return 'tấn';
    default: return unit.toString();
  }
}

// Hàm quy đổi về KG
export function convertToKg(quantity: number, unit: MassUnit | string): number {
  const factor = MASS_UNIT_FACTORS[unit as MassUnit] || 1; // Mặc định là 1 nếu đơn vị không chuẩn
  return quantity * factor;
}

// Hàm quy đổi giá về giá/KG
export function convertPriceToPerKg(pricePerUnit: number, unit: MassUnit | string): number {
  const factor = MASS_UNIT_FACTORS[unit as MassUnit] || 1;
  if (factor === 0) return 0; // Tránh chia cho 0
  return pricePerUnit / factor;
}


export function convertKgToUnit(kgValue: number, targetUnit: MassUnit | string): number {
  if (kgValue == null || targetUnit == null) throw new Error("Invalid input for kg to unit conversion");
  const factor = MASS_UNIT_FACTORS[targetUnit as MassUnit];
  if (factor == null || factor === 0) throw new Error(`Invalid or zero factor for unit ${targetUnit}`);
  return kgValue / factor;
}

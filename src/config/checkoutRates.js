export const RATES = {
  GST_PERCENT: 5,
  PACKING_PERCENT: 3,
  PLATFORM_PERCENT: 5,
  DELIVERY_BASE_KM: 3,
  DELIVERY_BASE_FEE: 67,
  DELIVERY_PER_KM: 13,
};

export function calcDeliveryFee(distanceKm) {
  if (distanceKm <= RATES.DELIVERY_BASE_KM) return RATES.DELIVERY_BASE_FEE;
  const extraKm = Math.ceil(distanceKm - RATES.DELIVERY_BASE_KM);
  return RATES.DELIVERY_BASE_FEE + extraKm * RATES.DELIVERY_PER_KM;
}

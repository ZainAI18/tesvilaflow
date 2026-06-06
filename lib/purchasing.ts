import { calculateLandedCost, calculateWeightedAverageCost } from "@/lib/costing";
import type { LandedCostInput } from "@/types/business";

export function previewPurchaseCosting(input: LandedCostInput) {
  return calculateLandedCost(input);
}

export function previewArrivalWeightedAverage(params: {
  currentStock: number;
  currentAverageCost: number;
  arrivedQuantity: number;
  unitLandedCost: number;
}) {
  return calculateWeightedAverageCost({
    currentStock: params.currentStock,
    currentAverageCost: params.currentAverageCost,
    incomingQuantity: params.arrivedQuantity,
    incomingUnitCost: params.unitLandedCost
  });
}

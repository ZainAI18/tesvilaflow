import { roundMoney } from "@/lib/math";
import type { StockDirection, StockMovementType } from "@/types/business";

export type StockBalance = {
  productId: string;
  warehouseId: string;
  currentStock: number;
};

export type StockMovementInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
  direction: StockDirection;
  movementType: StockMovementType;
};

export function applyStockMovement(balance: StockBalance, movement: StockMovementInput): StockBalance {
  const signedQuantity = movement.direction === "IN" ? movement.quantity : -movement.quantity;
  const nextStock = roundMoney(balance.currentStock + signedQuantity);

  if (nextStock < 0) {
    throw new Error("Insufficient stock in selected warehouse.");
  }

  return {
    ...balance,
    currentStock: nextStock
  };
}

export function canCompleteDeliveryOrder(items: Array<{ availableStock: number; quantity: number }>): boolean {
  return items.every((item) => item.availableStock >= item.quantity);
}

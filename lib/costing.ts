import { calculateExclusiveGst } from "@/lib/gst";
import { roundCost, roundMoney, safeDivide } from "@/lib/math";
import type {
  InvoiceItemCalculation,
  InvoiceItemInput,
  LandedCostInput,
  LandedCostItem,
  WeightedAverageInput
} from "@/types/business";

export function calculateLandedCost(input: LandedCostInput): {
  items: LandedCostItem[];
  productCostTotal: number;
  extraCostTotal: number;
  totalLandedCost: number;
} {
  const productCostTotal = roundMoney(
    input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  );
  const extraCostTotal = roundMoney(
    input.shippingCost + input.taxAmount + input.otherCost + input.paymentFee
  );
  const denominator =
    input.allocationMethod === "BY_QUANTITY"
      ? input.items.reduce((sum, item) => sum + item.quantity, 0)
      : productCostTotal;

  const items = input.items.map((item) => {
    const totalCost = roundMoney(item.quantity * item.unitCost);
    const basis = input.allocationMethod === "BY_QUANTITY" ? item.quantity : totalCost;
    const allocatedExtraCost = roundMoney(safeDivide(basis, denominator) * extraCostTotal);
    const landedCostInSupplierCurrency = totalCost + allocatedExtraCost;
    const actualUnitLandedCost = roundCost(
      safeDivide(landedCostInSupplierCurrency * input.finalExchangeRate, item.quantity)
    );

    return {
      ...item,
      totalCost,
      allocatedExtraCost,
      actualUnitLandedCost
    };
  });

  return {
    items,
    productCostTotal,
    extraCostTotal,
    totalLandedCost: roundMoney((productCostTotal + extraCostTotal) * input.finalExchangeRate)
  };
}

export function calculateWeightedAverageCost(input: WeightedAverageInput): number {
  const currentValue = input.currentStock * input.currentAverageCost;
  const incomingValue = input.incomingQuantity * input.incomingUnitCost;
  const newQuantity = input.currentStock + input.incomingQuantity;

  return roundCost(safeDivide(currentValue + incomingValue, newQuantity));
}

export function calculateInvoiceItem(input: InvoiceItemInput): InvoiceItemCalculation {
  const amount = roundMoney(input.quantity * input.unitPrice);
  const gstAmount = calculateExclusiveGst(amount, input.gstStatus);
  const costTotal = input.quantity * input.costPriceSnapshot;
  const grossProfit = roundMoney(amount - costTotal);
  const marginPercent = roundMoney(safeDivide(grossProfit, amount) * 100);
  const markupPercent = roundMoney(safeDivide(grossProfit, costTotal) * 100);

  return {
    ...input,
    amount,
    gstAmount,
    grossProfit,
    marginPercent,
    markupPercent
  };
}

export function summarizeInvoice(items: InvoiceItemCalculation[]) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  const gstAmount = roundMoney(items.reduce((sum, item) => sum + item.gstAmount, 0));

  return {
    subtotal,
    gstAmount,
    totalAmount: roundMoney(subtotal + gstAmount),
    grossProfit: roundMoney(items.reduce((sum, item) => sum + item.grossProfit, 0))
  };
}

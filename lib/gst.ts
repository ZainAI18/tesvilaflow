import { roundMoney } from "@/lib/math";

export const GST_RATE = 0.09;

export function calculateExclusiveGst(amount: number, gstStatus = true): number {
  if (!gstStatus) {
    return 0;
  }

  return roundMoney(amount * GST_RATE);
}

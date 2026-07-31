import type { Money } from "@/domain/types";

export function moneyFromMajor(value: number, currency = "CNY"): Money {
  return {
    minorValue: Math.round(value * 100),
    currency
  };
}

export function moneyToMajor(value: Money): number {
  return value.minorValue / 100;
}

export function formatMoney(value: Money): string {
  const locale = value.currency === "CNY" ? "zh-CN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(moneyToMajor(value));
}

export function zeroMoney(currency = "CNY"): Money {
  return { minorValue: 0, currency };
}

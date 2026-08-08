import { TranzilaProvider } from "./tranzila-provider";
import { YaadpayProvider } from "./yaadpay-provider";
import type { PaymentProvider, ProviderName } from "./types";

export * from "./types";
export { TranzilaProvider, YaadpayProvider };

function selectedProviderName(): ProviderName {
  const raw = (process.env.PAYMENT_PROVIDER || "tranzila").toLowerCase();
  return raw === "yaadpay" ? "yaadpay" : "tranzila";
}

function buildProvider(name: ProviderName): PaymentProvider {
  if (name === "yaadpay") {
    return new YaadpayProvider({
      masof: process.env.YAADPAY_MASOF || "",
      passP: process.env.YAADPAY_PASSP || "",
      key: process.env.YAADPAY_KEY || "",
    });
  }
  return new TranzilaProvider({
    terminal: process.env.TRANZILA_TERMINAL || "",
    password: process.env.TRANZILA_PASSWORD || "",
    tokenTerminal: process.env.TRANZILA_TOKEN_TERMINAL || undefined,
    tokenPassword: process.env.TRANZILA_TOKEN_PASSWORD || undefined,
  });
}

/** The provider configured for this deployment (default: tranzila). */
export function getProvider(): PaymentProvider {
  return buildProvider(selectedProviderName());
}

/** For settings / diagnostics — does not depend on the active provider. */
export function getProviderStatus(): {
  active: ProviderName;
  configured: boolean;
  publicId: string;
  available: { name: ProviderName; configured: boolean }[];
} {
  const active = selectedProviderName();
  const tranzila = buildProvider("tranzila");
  const yaadpay = buildProvider("yaadpay");
  const live = active === "yaadpay" ? yaadpay : tranzila;
  return {
    active,
    configured: live.isConfigured(),
    publicId: live.publicId(),
    available: [
      { name: "tranzila", configured: tranzila.isConfigured() },
      { name: "yaadpay", configured: yaadpay.isConfigured() },
    ],
  };
}

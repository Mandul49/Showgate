let _modeOverride: "test" | "live" | null = null;

export function isTestMode(): boolean {
  if (_modeOverride !== null) return _modeOverride === "test";
  return process.env.PAYSTACK_ENV === "test";
}

export function getPaystackMode(): "test" | "live" {
  return isTestMode() ? "test" : "live";
}

export function setPaystackMode(mode: "test" | "live"): void {
  _modeOverride = mode;
}

export function getPaystackSecretKey(): string {
  return (
    isTestMode()
      ? process.env.PAYSTACK_TEST_SECRET_KEY
      : process.env.PAYSTACK_SECRET_KEY
  ) || "";
}

export function getPaystackPublicKey(): string {
  return (
    isTestMode()
      ? process.env.PAYSTACK_TEST_PUBBLIC_KEY
      : process.env.PAYSTACK_PUBLIC_KEY
  ) || "";
}

export function isTestMode(): boolean {
  return process.env.PAYSTACK_ENV === "test";
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

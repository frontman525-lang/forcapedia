interface CashfreeInstance {
  subscriptionsCheckout(options: { subsSessionId: string; redirectTarget?: string }): Promise<{ error?: { message: string } }>
}

interface Window {
  Cashfree?: (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance
}

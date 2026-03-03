// ─── Payment Provider Factory ─────────────────────────────────────────────────
//
// Single place to register payment providers.
// Adding Stripe later = one new case + create lib/payments/providers/stripe/.
//
import type { PaymentProvider, PaymentProviderName } from './types'
import { CashfreeProvider } from './providers/cashfree'
import { PayPalProvider }   from './providers/paypal'

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  switch (name) {
    case 'cashfree': return new CashfreeProvider()
    case 'paypal':   return new PayPalProvider()
    default: {
      // TypeScript exhaustiveness guard — will error at compile time if a new
      // PaymentProviderName is added without a corresponding case above.
      const _exhaustive: never = name
      throw new Error(`Unknown payment provider: ${_exhaustive}`)
    }
  }
}

// Re-export types so consumers only need to import from '@/lib/payments'
export type {
  PaymentProvider,
  PaymentProviderName,
  PlanKey,
  CheckoutMode,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  NormalizedWebhookEvent,
  NormalizedEventType,
  WebhookVerifyResult,
} from './types'

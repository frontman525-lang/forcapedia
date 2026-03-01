import { Resend } from 'resend'

// Singleton Resend client — reused across invocations in the same runtime
export const resend = new Resend(process.env.RESEND_API_KEY)

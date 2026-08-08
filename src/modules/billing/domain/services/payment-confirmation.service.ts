/**
 * PaymentConfirmationService — regras que envolvem evidência do gateway.
 * Nunca confiar no frontend para marcar PAID.
 */
export class PaymentConfirmationService {
  static isValidGatewayConfirmation(payload: {
    externalTransactionId?: string | null;
    gatewaySignatureValid?: boolean;
  }): boolean {
    return Boolean(
      payload.externalTransactionId?.trim() &&
        payload.gatewaySignatureValid === true,
    );
  }
}

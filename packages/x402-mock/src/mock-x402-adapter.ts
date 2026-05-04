import { IPaymentPort, PaymentIntent, Quote } from '@cleared/core';
import { X402Challenge, X402PaymentProof } from './types';

/**
 * MockX402Adapter
 * 
 * !!! IMPORTANT !!!
 * This is a mocked implementation for local development and hackathon speed.
 * Verification logic is simplified and does NOT perform actual cryptographic signature checks.
 */
export class MockX402Adapter implements IPaymentPort {
  constructor(
    private config: {
      recipientAddress: string;
      network: string;
      asset: string;
    }
  ) {}

  /**
   * Create an x402-compliant payment requirement for a quote.
   * Returns a paymentIdentifier that acts as a session key.
   */
  async createIntent(quote: Quote): Promise<PaymentIntent> {
    const paymentIdentifier = `x402-pt-${quote.id.slice(0, 8)}`;
    
    const challenge: X402Challenge = {
      scheme: 'x402',
      recipient: this.config.recipientAddress,
      network: this.config.network,
      amount: quote.priceAmount.toString(),
      asset: this.config.asset,
      token: paymentIdentifier
    };

    return {
      paymentIdentifier,
      amount: quote.priceAmount,
      currency: quote.priceCurrency,
      status: 'open',
      clientConfig: challenge
    };
  }

  /**
   * Mock verify proof
   * In production, this would verify a signature or check an on-chain receipt.
   */
  async verifyProof(proofString: string): Promise<{
    paymentIdentifier: string;
    amount: bigint;
    currency: string;
    verified: boolean;
  }> {
    try {
      // In this demo, we assume the proofString is a JSON string of X402PaymentProof
      const proof: X402PaymentProof = JSON.parse(proofString);

      // DEMO MOCK: we accept any proof that has a paymentIdentifier starting with 'x402-pt-'
      const isVerified = proof.paymentIdentifier.startsWith('x402-pt-') && !!proof.signature;

      return {
        paymentIdentifier: proof.paymentIdentifier,
        amount: 0n, // Ideally would extract from transaction record
        currency: this.config.asset,
        verified: isVerified
      };
    } catch (e) {
      return {
        paymentIdentifier: 'invalid',
        amount: 0n,
        currency: 'ERR',
        verified: false
      };
    }
  }

  /**
   * Mock standard payment check by id
   */
  async verifyPayment(paymentIdentifier: string): Promise<{
    amount: bigint;
    currency: string;
    verified: boolean;
  }> {
    // For the demo, we mostly use verifyProof, 
    // but we can mock a 'successful' lookup for any valid formatted id.
    const isValid = paymentIdentifier.startsWith('x402-pt-');
    
    return {
      amount: 0n,
      currency: this.config.asset,
      verified: isValid
    };
  }

  async releaseEscrow(paymentIdentifier: string): Promise<boolean> {
    console.log(`[MockX402] Releasing funds for ${paymentIdentifier} to ${this.config.recipientAddress}`);
    return true;
  }

  async refundEscrow(paymentIdentifier: string): Promise<boolean> {
    console.log(`[MockX402] Refunding funds for ${paymentIdentifier} back to payer`);
    return true;
  }
}

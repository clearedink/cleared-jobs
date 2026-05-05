import { JobIntentRecord, VerifiedX402Payment } from '@cleared/core';
import { X402Challenge, X402PaymentProof } from './types.js';

/**
 * MockX402Adapter
 * 
 * !!! IMPORTANT !!!
 * This is a mocked implementation for local development and hackathon speed.
 * Verification logic is simplified and does NOT perform actual cryptographic signature checks.
 */
export class MockX402Adapter {
  constructor(
    private config: {
      recipientAddress: string;
      network: string;
      asset: string;
    }
  ) {}

  /**
   * Create an x402-compliant payment requirement for a job intent.
   */
  createMockPaymentRequirement(intent: JobIntentRecord): X402Challenge {
    return {
      scheme: 'x402',
      recipient: this.config.recipientAddress,
      network: intent.price.network || this.config.network,
      amount: intent.price.amount,
      asset: intent.price.currency || this.config.asset,
      token: intent.intentId
    };
  }

  /**
   * Mock verify proof and return a VerifiedX402Payment record compatible with admitPaidJob.
   */
  verifyMockPaymentProof(
    proof: X402PaymentProof, 
    details: { amount: string; currency: 'USDC'; network: string }
  ): VerifiedX402Payment {
    // DEMO MOCK: we accept any proof that has a signature
    if (!proof.signature) {
      throw new Error('Invalid payment proof: missing signature');
    }

    return {
      paymentId: proof.paymentIdentifier,
      payer: '0xMockPayer',
      payTo: this.config.recipientAddress,
      amount: details.amount,
      currency: details.currency,
      network: details.network,
      txHash: proof.transactionHash,
    };
  }
}

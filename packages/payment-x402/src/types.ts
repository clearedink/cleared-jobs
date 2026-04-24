export interface X402Challenge {
  scheme: 'x402';
  recipient: string;
  network: string;
  amount: string; // Serialized bigint
  asset: string;
  token?: string; // An optional ephemeral session token
}

export interface X402PaymentProof {
  paymentIdentifier: string;
  signature: string;
  transactionHash?: string;
  payloadHash?: string;
}

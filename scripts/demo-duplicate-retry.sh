#!/bin/bash
set -e

# --- DUPLICATE RETRY DEMO ---
# This script proves that re-submitting the same payment proof returns the canonical jobId

API_URL="http://localhost:3000"

echo "1. Getting initial quote and admitting job..."
QUOTE_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d '{"idempotency_key": "demo-dup-1", "inputs": {"idempotency": "demo-2"}}')
QUOTE_ID=$(echo $QUOTE_RESP | jq -r .intentId)
PAYMENT_ID=$(echo $QUOTE_RESP | jq -r .paymentRequirement.token)

PROOF='{"paymentIdentifier": "'$PAYMENT_ID'", "signature": "mock-proof-sig"}'
ADMIT_1=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d "{
  \"intent_id\": \"$QUOTE_ID\",
  \"payment_id\": \"$PAYMENT_ID\",
  \"payment_proof\": $PROOF,
  \"idempotency_key\": \"demo-dup-1\",
  \"inputs\": {\"idempotency\": \"demo-2\"}
}")

JOB_ID_1=$(echo $ADMIT_1 | jq -r .jobId)
echo "First Admission Response:"
echo $ADMIT_1 | jq .

echo -e "\n2. Retrying identical admission with same paymentIdentifier..."
ADMIT_2=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d "{
  \"intent_id\": \"$QUOTE_ID\",
  \"payment_id\": \"$PAYMENT_ID\",
  \"payment_proof\": $PROOF,
  \"idempotency_key\": \"demo-dup-1\",
  \"inputs\": {\"idempotency\": \"demo-2\"}
}")

echo "Second Admission Response (Replay):"
echo $ADMIT_2 | jq .

JOB_ID_2=$(echo $ADMIT_2 | jq -r .jobId)
ALREADY_ADMITTED=$(echo $ADMIT_2 | jq -r .alreadyAdmitted)

if [ "$JOB_ID_1" == "$JOB_ID_2" ] && [ "$ALREADY_ADMITTED" == "true" ]; then
  echo -e "\nSUCCESS: Canonical jobId preserved. alreadyAdmitted=true detected."
else
  echo -e "\nFAILURE: JobId mismatch or alreadyAdmitted flag missing."
  exit 1
fi

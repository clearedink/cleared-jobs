#!/bin/bash
set -e

# --- HAPPY PATH DEMO ---
# This script demonstrates a baseline successful job workflow

API_URL="http://localhost:3000"

echo "1. Requesting a paid job intent..."
QUOTE_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d '{"idempotency_key": "demo-happy-1", "inputs": {"data": "test-data"}}')
echo $QUOTE_RESP | jq .

INTENT_ID=$(echo "$QUOTE_RESP" | jq -r .intentId)
PAYMENT_ID=$(echo "$QUOTE_RESP" | jq -r .paymentRequirement.token)

echo "Intent ID: $INTENT_ID"
echo "Mock Payment Identifier: $PAYMENT_ID"

echo -e "\n2. Submitting payment proof for admission..."

PROOF=$(jq -n \
  --arg paymentIdentifier "$PAYMENT_ID" \
  --arg signature "mock-proof-sig" \
  '{
    paymentIdentifier: $paymentIdentifier,
    signature: $signature
  }'
)

ADMIT_RESP=$(curl -s -X POST "$API_URL/v1/jobs/run" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg intent_id "$QUOTE_ID" \
    --arg idempotency_key "demo-happy-1" \
    --argjson payment_proof "$PROOF" \
    '{
      intent_id: $intent_id,
      idempotency_key: $idempotency_key,
      payment_proof: $payment_proof,
      inputs: { data: "test-data" }
    }'
  )"
)

echo "$ADMIT_RESP" | jq .

ERROR=$(echo "$ADMIT_RESP" | jq -r '.error // empty')
if [ -n "$ERROR" ]; then
  echo "Admission failed with error: $ERROR"
  exit 1
fi

JOB_ID=$(echo "$ADMIT_RESP" | jq -r '.jobId // empty')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo "Admission did not return jobId"
  exit 1
fi

echo -e "\nObserved 202 Accepted. Job ID: $JOB_ID"

echo -e "\n3. Polling for job status..."
while true; do
  STATUS_RESP=$(curl -s -X GET $API_URL/v1/jobs/$JOB_ID)
  STATUS=$(echo $STATUS_RESP | jq -r .status)
  echo "Current Status: $STATUS"
  if [ "$STATUS" == "completed" ]; then break; fi
  sleep 1
done

echo -e "\n4. Retrieving job result..."
RESULT_RESP=$(curl -s -X GET $API_URL/v1/jobs/$JOB_ID/result)
echo $RESULT_RESP | jq .

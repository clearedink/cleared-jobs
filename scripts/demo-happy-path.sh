#!/bin/bash
set -e

# --- HAPPY PATH DEMO ---
# This script demonstrates a baseline successful job workflow

API_URL="http://localhost:3000"

echo "1. Requesting a job quote..."
QUOTE_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d '{"inputs": {"data": "test-data"}}')
echo $QUOTE_RESP | jq .

QUOTE_ID=$(echo $QUOTE_RESP | jq -r .quoteId)
PAYMENT_ID=$(echo $QUOTE_RESP | jq -r .paymentRequirement.paymentIdentifier)

echo -e "\nObserved 402 Payment Required."
echo "Quote ID: $QUOTE_ID"
echo "Payment Identifier: $PAYMENT_ID"

echo -e "\n2. Submitting payment proof for admission..."
# We simulate a proof that the MockX402Adapter will accept
PROOF='{"paymentIdentifier": "'$PAYMENT_ID'", "signature": "mock-proof-sig"}'
ADMIT_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d "{
  \"quote_id\": \"$QUOTE_ID\",
  \"payment_identifier\": \"$PAYMENT_ID\",
  \"payment_proof\": \"$(echo $PROOF | sed 's/"/\\"/g')\",
  \"inputs\": {\"data\": \"test-data\"}
}")
echo $ADMIT_RESP | jq .

JOB_ID=$(echo $ADMIT_RESP | jq -r .jobId)
echo -e "\nObserved 202 Accepted. Job ID: $JOB_ID"

echo -e "\n3. Polling for job status..."
while true; do
  STATUS_RESP=$(curl -s -X GET $API_URL/v1/jobs/$JOB_ID)
  STATUS=$(echo $STATUS_RESP | jq -r .status)
  echo "Current Status: $STATUS"
  if [ "$STATUS" == "COMPLETED" ]; then break; fi
  sleep 1
done

echo -e "\n4. Retrieving job result..."
RESULT_RESP=$(curl -s -X GET $API_URL/v1/jobs/$JOB_ID/result)
echo $RESULT_RESP | jq .

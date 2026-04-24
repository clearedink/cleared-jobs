#!/bin/bash
set -e

# --- LOST RESPONSE DEMO ---
# This script proves that a result is retrievable even if the initial caller disconnected

API_URL="http://localhost:3000"

echo "1. Admitting job and 'disconnecting' from status polling..."
QUOTE_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d '{"inputs": {"scenario": "lost-response"}}')
QUOTE_ID=$(echo $QUOTE_RESP | jq -r .quoteId)
PAYMENT_ID=$(echo $QUOTE_RESP | jq -r .paymentRequirement.paymentIdentifier)

PROOF='{"paymentIdentifier": "'$PAYMENT_ID'", "signature": "mock-proof-sig"}'
ADMIT_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d "{
  \"quote_id\": \"$QUOTE_ID\",
  \"payment_identifier\": \"$PAYMENT_ID\",
  \"payment_proof\": \"$(echo $PROOF | sed 's/"/\\"/g')\",
  \"inputs\": {\"scenario\": \"lost-response\"}
}")

JOB_ID=$(echo $ADMIT_RESP | jq -r .jobId)
echo "Admitted Job: $JOB_ID. Now simulator waits 3 seconds..."

# Wait enough for the fake worker to finish (delay is 1s by default)
sleep 3

echo -e "\n2. Fetching result by jobId (simulating reconnect)..."
RESULT_RESP=$(curl -s -X GET $API_URL/v1/jobs/$JOB_ID/result)
echo $RESULT_RESP | jq .

STATUS=$(echo $RESULT_RESP | jq -r .status)
if [ "$STATUS" == "COMPLETED" ]; then
  echo -e "\nSUCCESS: Result was safely stored and retrieved by the canonical jobId."
else
  echo -e "\nFAILURE: Result not found or status incorrect."
  exit 1
fi

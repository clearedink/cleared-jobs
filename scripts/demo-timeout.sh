#!/bin/bash
set -e

# --- TIMEOUT DEMO ---
# This script demonstrates a job exceeding its SLA and moving to automated resolution

API_URL="http://localhost:3000"

echo "1. Admitting a job that will sleep longer than the 60s SLA (90s)..."
# We'll use the sleep_ms feature I just added to FakeWorker
QUOTE_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d '{"idempotency_key": "demo-timeout-1", "inputs": {"sleep_ms": 90000}}')
QUOTE_ID=$(echo $QUOTE_RESP | jq -r .intentId)
PAYMENT_ID=$(echo $QUOTE_RESP | jq -r .paymentRequirement.token)

PROOF='{"paymentIdentifier": "'$PAYMENT_ID'", "signature": "mock-proof-sig"}'
ADMIT_RESP=$(curl -s -X POST $API_URL/v1/jobs/run -H "Content-Type: application/json" -d "{
  \"intent_id\": \"$QUOTE_ID\",
  \"payment_id\": \"$PAYMENT_ID\",
  \"payment_proof\": $PROOF,
  \"idempotency_key\": \"demo-timeout-1\",
  \"inputs\": {\"sleep_ms\": 90000}
}")

JOB_ID=$(echo $ADMIT_RESP | jq -r .jobId)
echo "Admitted Long Running Job: $JOB_ID"

echo -e "\n2. Triggering admin timeout scan IMMEDIATELY (should be 0 timed out)..."
SCAN_1=$(curl -s -X POST $API_URL/admin/timeout-scan)
echo $SCAN_1 | jq .

echo -e "\n3. Checking Audit Logs for verification..."
curl -s -X GET $API_URL/debug/jobs/$JOB_ID/audit | jq .

echo -e "\nNOTE: To see a REAL timeout in this demo, you would need to wait 60s."
echo "Alternatively, you can manually trigger a refund test now:"

echo -e "\n4. Manually triggering operator refund (Override)..."
REFUND_RESP=$(curl -s -X POST $API_URL/admin/jobs/$JOB_ID/refund)
echo $REFUND_RESP | jq .

echo -e "\n5. Checking Audit Logs for REPLAY_CONFLICT prevention and REFUND_COMPLETED..."
curl -s -X GET $API_URL/debug/jobs/$JOB_ID/audit | jq .

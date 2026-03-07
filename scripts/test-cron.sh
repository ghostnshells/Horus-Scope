#!/bin/bash

# Script to test the cron endpoint with authentication

if [ -z "$1" ]; then
    echo "Usage: $0 <CRON_SECRET>"
    echo "Example: $0 your-secret-here"
    exit 1
fi

CRON_SECRET="$1"
URL="https://horus-scope.vercel.app/api/cron/refresh"

echo "Testing cron endpoint..."
echo "URL: $URL"
echo ""

RESPONSE=$(curl -s -X GET "$URL" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✓ SUCCESS - Cron endpoint is working!"
    echo ""
    echo "Batch info:"
    echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"Batch index: {data.get('batchIndex', 'unknown')}\"); print(f\"Assets processed: {data.get('assetsProcessed', [])}\"); print(f\"Total assets: {data.get('totalAssets', 'unknown')}\")" 2>/dev/null
else
    echo "✗ FAILED"
    if echo "$RESPONSE" | grep -q '"error":"Unauthorized"'; then
        echo "Error: CRON_SECRET is incorrect"
        echo "Make sure you're using the same secret that's set in Vercel"
    fi
fi

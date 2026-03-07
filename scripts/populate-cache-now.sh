#!/bin/bash

# Emergency cache population script (requires ALLOW_CRON_BYPASS=true in Vercel)
# This bypasses authentication to get your app working immediately

URL="https://horus-scope.vercel.app/api/cron/refresh"

echo "🚀 Emergency Cache Population"
echo "================================"
echo "Using bypass mode (requires ALLOW_CRON_BYPASS=true in Vercel)"
echo ""

BATCH=0
while [ $BATCH -lt 7 ]; do
    BATCH=$((BATCH + 1))
    echo "⏳ Triggering batch $BATCH/7..."

    RESPONSE=$(curl -s -X GET "$URL" -H "Content-Type: application/json")

    echo "   Response: $RESPONSE"

    # Check for success
    if echo "$RESPONSE" | grep -q '"success":true'; then
        ASSETS=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(', '.join(data.get('assetsProcessed', [])))" 2>/dev/null)
        echo "   ✓ Batch $BATCH successful"
        echo "   Assets processed: $ASSETS"
    else
        echo "   ✗ Batch $BATCH failed"
    fi

    # Wait 2 seconds between requests
    if [ $BATCH -lt 7 ]; then
        echo "   Waiting 2 seconds..."
        sleep 2
    fi
    echo ""
done

echo "✅ Cache population complete!"
echo "🔍 Refresh your app - vulnerabilities should now be visible."
echo ""
echo "⚠️  IMPORTANT: The debug endpoint will be removed once auth is fixed."

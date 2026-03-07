#!/bin/bash

# Script to manually trigger all cache refresh batches
# This will populate the entire Redis cache by calling the cron endpoint 7 times

# Usage:
#   ./scripts/trigger-cache-refresh.sh https://your-app.vercel.app
#   ./scripts/trigger-cache-refresh.sh https://your-app.vercel.app your-cron-secret

if [ -z "$1" ]; then
    echo "Usage: $0 <VERCEL_URL> [CRON_SECRET]"
    echo "Example: $0 https://horus-scope.vercel.app"
    echo "Example: $0 https://horus-scope.vercel.app my-secret-token"
    exit 1
fi

VERCEL_URL="$1"
CRON_SECRET="$2"
TOTAL_BATCHES=7

echo "🚀 Starting cache refresh for $VERCEL_URL"
echo "📦 Total batches to process: $TOTAL_BATCHES"
echo ""

for i in $(seq 0 $((TOTAL_BATCHES - 1))); do
    echo "⏳ Triggering batch $((i + 1))/$TOTAL_BATCHES..."

    if [ -n "$CRON_SECRET" ]; then
        # With authentication
        RESPONSE=$(curl -s -X GET "$VERCEL_URL/api/cron/refresh" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json")
    else
        # Without authentication
        RESPONSE=$(curl -s -X GET "$VERCEL_URL/api/cron/refresh" \
            -H "Content-Type: application/json")
    fi

    echo "   Response: $RESPONSE"

    # Check for errors in response
    if echo "$RESPONSE" | grep -q '"error"'; then
        echo "   ⚠️  ERROR detected in response!"
    elif echo "$RESPONSE" | grep -q '"success":true'; then
        echo "   ✓ Batch successful"
    else
        echo "   ⚠️  Unexpected response format"
    fi

    # Wait 2 seconds between requests to avoid rate limiting
    if [ $i -lt $((TOTAL_BATCHES - 1)) ]; then
        echo "   Waiting 2 seconds..."
        sleep 2
    fi
    echo ""
done

echo "✅ Cache refresh complete!"
echo "🔍 Check your app - vulnerabilities should now be visible."

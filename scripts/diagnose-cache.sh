#!/bin/bash

# Diagnostic script to check cache status and API responses

if [ -z "$1" ]; then
    echo "Usage: $0 <VERCEL_URL>"
    echo "Example: $0 https://horus-scope.vercel.app"
    exit 1
fi

VERCEL_URL="$1"

echo "🔍 Horus Scope Cache Diagnostic"
echo "================================"
echo ""

# Test 1: Check if the vulnerabilities API is accessible
echo "📡 Test 1: Checking /api/vulnerabilities endpoint..."
RESPONSE=$(curl -s "$VERCEL_URL/api/vulnerabilities?timeRange=7d")
echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if response has data
if echo "$RESPONSE" | grep -q '"success":true'; then
    VULN_COUNT=$(echo "$RESPONSE" | jq -r '.data.all | length' 2>/dev/null)
    echo "✓ API is responding"
    echo "  Vulnerability count: ${VULN_COUNT:-0}"
else
    echo "✗ API returned an error or unexpected format"
fi
echo ""

# Test 2: Try triggering one cron batch
echo "📡 Test 2: Triggering one cron batch..."
CRON_RESPONSE=$(curl -s "$VERCEL_URL/api/cron/refresh")
echo "Cron Response:"
echo "$CRON_RESPONSE" | jq '.' 2>/dev/null || echo "$CRON_RESPONSE"
echo ""

# Check for common errors
if echo "$CRON_RESPONSE" | grep -qi "unauthorized"; then
    echo "⚠️  ERROR: Cron endpoint requires authentication"
    echo "   Set CRON_SECRET in Vercel and use: $0 $VERCEL_URL your-secret"
elif echo "$CRON_RESPONSE" | grep -qi "UPSTASH_REDIS"; then
    echo "⚠️  ERROR: Redis environment variables not set correctly"
    echo "   Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel"
elif echo "$CRON_RESPONSE" | grep -q '"success":true'; then
    echo "✓ Cron batch triggered successfully"
    BATCH_INDEX=$(echo "$CRON_RESPONSE" | jq -r '.batchIndex' 2>/dev/null)
    ASSETS_PROCESSED=$(echo "$CRON_RESPONSE" | jq -r '.assetsProcessed' 2>/dev/null)
    echo "  Batch index: ${BATCH_INDEX:-unknown}"
    echo "  Assets processed: ${ASSETS_PROCESSED:-unknown}"
else
    echo "⚠️  Unexpected cron response"
fi
echo ""

# Test 3: Wait and re-check the API
echo "⏳ Test 3: Waiting 3 seconds and re-checking API..."
sleep 3
RESPONSE2=$(curl -s "$VERCEL_URL/api/vulnerabilities?timeRange=7d")
VULN_COUNT2=$(echo "$RESPONSE2" | jq -r '.data.all | length' 2>/dev/null)
echo "  Vulnerability count after cron: ${VULN_COUNT2:-0}"

if [ "${VULN_COUNT2:-0}" -gt "${VULN_COUNT:-0}" ]; then
    echo "✓ Cache is being populated!"
else
    echo "⚠️  Vulnerability count did not increase"
fi
echo ""

# Test 4: Check for specific error patterns
echo "🔍 Test 4: Checking for common issues..."
if echo "$RESPONSE2" | grep -qi "cache not ready"; then
    echo "⚠️  Cache reports as 'not ready' - cron job may not be completing"
elif echo "$RESPONSE2" | grep -qi "503"; then
    echo "⚠️  503 Service Unavailable - Redis may not be accessible"
elif echo "$RESPONSE2" | grep -qi "500"; then
    echo "⚠️  500 Internal Server Error - check Vercel function logs"
elif [ "${VULN_COUNT2:-0}" -eq 0 ]; then
    echo "⚠️  API returns 0 vulnerabilities - possible causes:"
    echo "   1. Cron job hasn't run yet (needs 7 full runs)"
    echo "   2. Redis connection failing"
    echo "   3. Environment variables not set"
    echo "   4. Rate limiting from NVD API"
else
    echo "✓ No obvious errors detected"
fi
echo ""

echo "================================"
echo "Next Steps:"
echo "1. Check Vercel function logs at: https://vercel.com/dashboard"
echo "2. Verify environment variables are set in Vercel project settings"
echo "3. Check Upstash Redis dashboard for stored keys"

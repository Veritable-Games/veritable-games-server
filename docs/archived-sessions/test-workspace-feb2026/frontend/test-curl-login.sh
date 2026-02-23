#!/bin/bash

echo "=== Testing Login with CSRF Token ==="
echo ""

# Step 1: Get CSRF token
echo "1. Getting CSRF token..."
CSRF_RESPONSE=$(curl -s -c /tmp/cookies.txt http://localhost:3000/api/csrf)
CSRF_TOKEN=$(grep csrf_token /tmp/cookies.txt | awk '{print $7}')

if [ -z "$CSRF_TOKEN" ]; then
  echo "   ❌ Failed to get CSRF token"
  exit 1
fi

echo "   ✅ CSRF Token: ${CSRF_TOKEN:0:20}..."

# Step 2: Login with CSRF token
echo ""
echo "2. Attempting login with CSRF token..."
LOGIN_RESPONSE=$(curl -v -b /tmp/cookies.txt -c /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"username":"claude","password":"U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk="}' \
  2>&1)

# Step 3: Check for Set-Cookie headers
echo ""
echo "3. Checking for Set-Cookie headers..."
SET_COOKIE=$(echo "$LOGIN_RESPONSE" | grep -i "< set-cookie:")

if [ -n "$SET_COOKIE" ]; then
  echo "   ✅ Set-Cookie headers found:"
  echo "$SET_COOKIE" | sed 's/^/     /'
else
  echo "   ❌ NO Set-Cookie headers found!"
fi

# Step 4: Check cookies file
echo ""
echo "4. Checking cookies file..."
cat /tmp/cookies.txt | grep -v "^#" | awk '{print "   " $6 " = " $7}'

# Cleanup
rm -f /tmp/cookies.txt

echo ""
echo "=== RESULT ==="
if echo "$SET_COOKIE" | grep -qi "session"; then
  echo "✅ Session cookie IS being set"
else
  echo "❌ Session cookie NOT being set"
fi

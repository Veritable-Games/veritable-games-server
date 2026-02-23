#!/bin/bash

echo "=== Testing Login API with curl ==="
echo ""
echo "1. Attempting POST to /api/auth/login..."

# Make the request and save headers
curl -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username":"claude","password":"U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk="}' \
  > /tmp/login-response-body.txt 2> /tmp/login-response-headers.txt

echo ""
echo "2. Response status:"
grep "< HTTP" /tmp/login-response-headers.txt

echo ""
echo "3. Set-Cookie headers:"
grep -i "< set-cookie" /tmp/login-response-headers.txt || echo "   ❌ NO Set-Cookie headers found"

echo ""
echo "4. Response body:"
cat /tmp/login-response-body.txt | head -10

echo ""
echo "=== RESULT ==="
if grep -qi "set-cookie" /tmp/login-response-headers.txt; then
  echo "✅ Set-Cookie header IS present"
  grep -i "set-cookie" /tmp/login-response-headers.txt | while read line; do
    if echo "$line" | grep -qi "session"; then
      echo "✅ Session cookie found"
    fi
  done
else
  echo "❌ Set-Cookie header MISSING"
fi

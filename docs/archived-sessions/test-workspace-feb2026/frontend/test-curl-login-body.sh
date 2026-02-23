#!/bin/bash

# Step 1: Get CSRF token
CSRF_RESPONSE=$(curl -s -c /tmp/cookies.txt http://localhost:3000/api/csrf)
CSRF_TOKEN=$(grep csrf_token /tmp/cookies.txt | awk '{print $7}')

# Step 2: Login and check response body
echo "=== Login Response Body ==="
curl -s -b /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"username":"claude","password":"U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk="}' | jq .

# Cleanup
rm -f /tmp/cookies.txt

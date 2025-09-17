#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://localhost:3001"
COOKIES_FILE="/tmp/complete_test_cookies.txt"

echo -e "${BLUE}🔒 Complete Manual Authentication Test${NC}"
echo "======================================"

# Clean up
rm -f $COOKIES_FILE

# Generate unique username
NEW_USER="testuser_$(date +%s%N | cut -b10-19)"
echo -e "${YELLOW}📝 Creating user: $NEW_USER${NC}"

# Step 1: Register new user
echo -e "\n${BLUE}1. Testing Registration...${NC}"
REGISTER_RESPONSE=$(curl -k -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -w "%{http_code}" \
  -d "{
    \"ten_dang_nhap\": \"$NEW_USER\",
    \"mat_khau\": \"password123\",
    \"ho_ten\": \"Test User Manual\",
    \"email\": \"$NEW_USER@example.com\"
  }")

REGISTER_STATUS="${REGISTER_RESPONSE: -3}"
REGISTER_BODY="${REGISTER_RESPONSE%???}"

if [ "$REGISTER_STATUS" = "201" ]; then
    echo -e "${GREEN}✅ Registration successful (201)${NC}"
    echo "Response: $REGISTER_BODY"
else
    echo -e "${RED}❌ Registration failed ($REGISTER_STATUS)${NC}"
    echo "Response: $REGISTER_BODY"
    exit 1
fi

sleep 1

# Step 2: Login 
echo -e "\n${BLUE}2. Testing Login...${NC}"
LOGIN_RESPONSE=$(curl -k -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -c $COOKIES_FILE \
  -w "%{http_code}" \
  -d "{
    \"ten_dang_nhap\": \"$NEW_USER\",
    \"mat_khau\": \"password123\"
  }")

LOGIN_STATUS="${LOGIN_RESPONSE: -3}"
LOGIN_BODY="${LOGIN_RESPONSE%???}"

if [ "$LOGIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Login successful (200)${NC}"
    echo "Response: $LOGIN_BODY"
else
    echo -e "${RED}❌ Login failed ($LOGIN_STATUS)${NC}"
    echo "Response: $LOGIN_BODY"
    exit 1
fi

# Step 3: Check cookies
echo -e "\n${BLUE}3. Checking Saved Cookies...${NC}"
if [ -f $COOKIES_FILE ]; then
    echo -e "${GREEN}✅ Cookie file exists${NC}"
    echo "Cookie content:"
    cat $COOKIES_FILE
    
    # Check if auth_token exists
    if grep -q "auth_token" $COOKIES_FILE; then
        echo -e "${GREEN}✅ auth_token found in cookies${NC}"
    else
        echo -e "${RED}❌ auth_token not found in cookies${NC}"
    fi
else
    echo -e "${RED}❌ Cookie file not created${NC}"
    exit 1
fi

sleep 1

# Step 4: Test protected route
echo -e "\n${BLUE}4. Testing Protected Route...${NC}"
PROTECTED_RESPONSE=$(curl -k -s -X GET $BASE_URL/api/protected \
  -b $COOKIES_FILE \
  -w "%{http_code}")

PROTECTED_STATUS="${PROTECTED_RESPONSE: -3}"
PROTECTED_BODY="${PROTECTED_RESPONSE%???}"

if [ "$PROTECTED_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Protected route accessible (200)${NC}"
    echo "Response: $PROTECTED_BODY"
else
    echo -e "${RED}❌ Protected route failed ($PROTECTED_STATUS)${NC}"
    echo "Response: $PROTECTED_BODY"
fi

# Step 5: Test get current user
echo -e "\n${BLUE}5. Testing Get Current User...${NC}"
ME_RESPONSE=$(curl -k -s -X GET $BASE_URL/api/auth/me \
  -b $COOKIES_FILE \
  -w "%{http_code}")

ME_STATUS="${ME_RESPONSE: -3}"
ME_BODY="${ME_RESPONSE%???}"

if [ "$ME_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Get current user successful (200)${NC}"
    echo "Response: $ME_BODY"
else
    echo -e "${RED}❌ Get current user failed ($ME_STATUS)${NC}"
    echo "Response: $ME_BODY"
fi

# Step 6: Test change password
echo -e "\n${BLUE}6. Testing Change Password...${NC}"
CHANGE_PW_RESPONSE=$(curl -k -s -X PUT $BASE_URL/api/auth/change-password \
  -H "Content-Type: application/json" \
  -b $COOKIES_FILE \
  -w "%{http_code}" \
  -d '{
    "mat_khau_cu": "password123",
    "mat_khau_moi": "newpassword123"
  }')

CHANGE_PW_STATUS="${CHANGE_PW_RESPONSE: -3}"
CHANGE_PW_BODY="${CHANGE_PW_RESPONSE%???}"

if [ "$CHANGE_PW_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Change password successful (200)${NC}"
    echo "Response: $CHANGE_PW_BODY"
else
    echo -e "${RED}❌ Change password failed ($CHANGE_PW_STATUS)${NC}"
    echo "Response: $CHANGE_PW_BODY"
fi

# Step 7: Test logout
echo -e "\n${BLUE}7. Testing Logout...${NC}"
LOGOUT_RESPONSE=$(curl -k -s -X POST $BASE_URL/api/auth/logout \
  -b $COOKIES_FILE \
  -w "%{http_code}")

LOGOUT_STATUS="${LOGOUT_RESPONSE: -3}"
LOGOUT_BODY="${LOGOUT_RESPONSE%???}"

if [ "$LOGOUT_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Logout successful (200)${NC}"
    echo "Response: $LOGOUT_BODY"
else
    echo -e "${RED}❌ Logout failed ($LOGOUT_STATUS)${NC}"
    echo "Response: $LOGOUT_BODY"
fi

# Step 8: Verify logout (protected route should fail)
echo -e "\n${BLUE}8. Verifying Logout (Protected Route Should Fail)...${NC}"
VERIFY_RESPONSE=$(curl -k -s -X GET $BASE_URL/api/protected \
  -b $COOKIES_FILE \
  -w "%{http_code}")

VERIFY_STATUS="${VERIFY_RESPONSE: -3}"
VERIFY_BODY="${VERIFY_RESPONSE%???}"

if [ "$VERIFY_STATUS" = "401" ]; then
    echo -e "${GREEN}✅ Logout verified - protected route blocked (401)${NC}"
    echo "Response: $VERIFY_BODY"
else
    echo -e "${RED}❌ Logout verification failed ($VERIFY_STATUS)${NC}"
    echo "Response: $VERIFY_BODY"
fi

echo -e "\n${BLUE}🎉 Complete test finished!${NC}"

# Cleanup
rm -f $COOKIES_FILE
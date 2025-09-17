#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if HTTPS mode is requested
if [ "$1" = "--https" ]; then
    BASE_URL="https://localhost:3001"
    CURL_OPTIONS="-k"
    echo -e "${BLUE}🔒 Testing with HTTPS (ignoring self-signed cert)${NC}"
else
    BASE_URL="http://localhost:3001"
    CURL_OPTIONS=""
    echo -e "${BLUE}🌐 Testing with HTTP${NC}"
fi

COOKIES_FILE="/tmp/auth_test_cookies.txt"

echo -e "${BLUE}🧪 Testing JWT Authentication System${NC}\n"

# Clean up function
cleanup() {
    rm -f $COOKIES_FILE
    rm -f /tmp/test_response.json
}

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local use_cookies=${6:-false}
    
    echo -e "${YELLOW}Testing: $description${NC}"
    
    local curl_cmd="curl $CURL_OPTIONS -s -w '%{http_code}' -o /tmp/test_response.json -X $method"
    
    if [ "$use_cookies" = true ]; then
        curl_cmd="$curl_cmd -b $COOKIES_FILE"
    fi
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
        if [ -n "$data" ]; then
            curl_cmd="$curl_cmd -d '$data'"
        fi
    fi
    
    # For login, save cookies
    if [[ $endpoint == *"/auth/login"* ]]; then
        curl_cmd="$curl_cmd -c $COOKIES_FILE"
    fi
    
    curl_cmd="$curl_cmd $BASE_URL$endpoint"
    
    local status_code=$(eval $curl_cmd)
    local response=$(cat /tmp/test_response.json 2>/dev/null || echo "")
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS: Status $status_code${NC}"
    else
        echo -e "${RED}❌ FAIL: Expected $expected_status, got $status_code${NC}"
        if [ -n "$response" ]; then
            echo -e "${RED}Response: $response${NC}"
        fi
    fi
    
    echo ""
}

# Check if server is running
echo -e "${BLUE}Checking if server is running at $BASE_URL...${NC}"
if ! curl $CURL_OPTIONS -s --connect-timeout 5 "$BASE_URL/api/health" > /dev/null; then
    echo -e "${RED}❌ Server không chạy tại $BASE_URL${NC}"
    if [ "$1" = "--https" ]; then
        echo -e "${YELLOW}💡 Hãy chạy: npm run dev:https trong terminal khác${NC}"
        echo -e "${YELLOW}💡 Và đảm bảo SSL certificates đã được tạo: npm run create-ssl-certs${NC}"
    else
        echo -e "${YELLOW}💡 Hãy chạy: npm run dev trong terminal khác${NC}"
    fi
    exit 1
fi

echo -e "${GREEN}✅ Server đang chạy${NC}\n"

# Trap to cleanup on exit
trap cleanup EXIT

echo -e "${BLUE}1. Testing Health Check${NC}"
test_endpoint "GET" "/api/health" "" "200" "Health check endpoint"

echo -e "${BLUE}2. Testing Database Connection${NC}"
test_endpoint "GET" "/api/test-db" "" "200" "Database connection test"

echo -e "${BLUE}3. Testing User Registration${NC}"
RANDOM_NUM=$(date +%s%N | cut -b10-19)
test_endpoint "POST" "/api/auth/register" "{
    \"ten_dang_nhap\": \"testuser$RANDOM_NUM\",
    \"mat_khau\": \"password123\",
    \"ho_ten\": \"Test User $RANDOM_NUM\",
    \"email\": \"test$RANDOM_NUM@example.com\"
}" "201" "User registration"

echo -e "${BLUE}4. Testing Invalid Registration (Weak Password)${NC}"
test_endpoint "POST" "/api/auth/register" '{
    "ten_dang_nhap": "weakuser",
    "mat_khau": "123",
    "ho_ten": "Weak User"
}' "400" "Registration with weak password"

echo -e "${BLUE}5. Testing User Login${NC}"
# First, register a user for login test
USER_FOR_LOGIN="loginuser_$(date +%s%N | cut -b10-19)"
curl $CURL_OPTIONS -s -X POST -H "Content-Type: application/json" -d "{
    \"ten_dang_nhap\": \"$USER_FOR_LOGIN\",
    \"mat_khau\": \"password123\",
    \"ho_ten\": \"Login User\"
}" "$BASE_URL/api/auth/register" > /dev/null

sleep 1

test_endpoint "POST" "/api/auth/login" "{
    \"ten_dang_nhap\": \"$USER_FOR_LOGIN\",
    \"mat_khau\": \"password123\"
}" "200" "User login"

echo -e "${BLUE}6. Testing Invalid Login${NC}"
test_endpoint "POST" "/api/auth/login" '{
    "ten_dang_nhap": "nonexistent",
    "mat_khau": "wrongpassword"
}' "401" "Login with invalid credentials"

echo -e "${BLUE}7. Testing Protected Route (Authenticated)${NC}"
test_endpoint "GET" "/api/protected" "" "200" "Protected route with valid token" true

echo -e "${BLUE}8. Testing Protected Route (Unauthenticated)${NC}"
test_endpoint "GET" "/api/protected" "" "401" "Protected route without token"

echo -e "${BLUE}9. Testing Get Current User${NC}"
test_endpoint "GET" "/api/auth/me" "" "200" "Get current user info" true

echo -e "${BLUE}10. Testing Public Route (Authenticated)${NC}"
test_endpoint "GET" "/api/public" "" "200" "Public route with authentication" true

echo -e "${BLUE}11. Testing Public Route (Unauthenticated)${NC}"
test_endpoint "GET" "/api/public" "" "200" "Public route without authentication"

echo -e "${BLUE}12. Testing Change Password${NC}"
test_endpoint "PUT" "/api/auth/change-password" '{
    "mat_khau_cu": "password123",
    "mat_khau_moi": "newpassword123"
}' "200" "Change password" true

echo -e "${BLUE}13. Testing Logout${NC}"
test_endpoint "POST" "/api/auth/logout" "" "200" "User logout" true

echo -e "${BLUE}14. Testing Protected Route After Logout${NC}"
test_endpoint "GET" "/api/protected" "" "401" "Protected route after logout" true

echo -e "${GREEN}🎉 Authentication tests completed!${NC}"
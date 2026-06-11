#!/usr/bin/env bash
# JWT Token Helper for MCP Server debugging and testing
#
# Retrieves a JWT token from the local or remote API for use with
# admin-scope MCP tools and other JWT-protected endpoints.
#
# Usage:
#   # Login with username/password (prompts for password if not set)
#   ./scripts/get-jwt.sh --login admin
#   ./scripts/get-jwt.sh --login omnichannel-tester
#
#   # Login with explicit password
#   JWT_PASSWORD=secret ./scripts/get-jwt.sh --login admin
#
#   # Login against a different API
#   API_URL=https://api-staging.instantkom.de ./scripts/get-jwt.sh --login admin
#
#   # Just output the access token (for piping)
#   ./scripts/get-jwt.sh --login admin --token-only
#
#   # Test the token against an admin endpoint
#   ./scripts/get-jwt.sh --login admin --test
#
#   # Show stored token info
#   ./scripts/get-jwt.sh --info
#
# The token is cached in /tmp/mcp-jwt-{username}.json for reuse.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_URL="${API_URL:-http://localhost:3002}"

RED="\e[31m"
GREEN="\e[32m"
YELLOW="\e[33m"
BLUE="\e[34m"
RESET="\e[0m"

TOKEN_ONLY=false
RUN_TEST=false

show_help() {
  echo -e "${BLUE}JWT Token Helper - MCP Server${RESET}"
  echo ""
  echo -e "${YELLOW}Usage:${RESET}"
  echo "  $0 --login <username>              # Login and get JWT token"
  echo "  $0 --login <username> --token-only  # Output only the access token"
  echo "  $0 --login <username> --test        # Login and test admin endpoint"
  echo "  $0 --info                           # Show cached token info"
  echo ""
  echo -e "${YELLOW}Environment:${RESET}"
  echo "  API_URL=...        Override API URL (default: http://localhost:3002)"
  echo "  JWT_PASSWORD=...   Set password (avoids prompt)"
  echo ""
  echo -e "${YELLOW}Examples:${RESET}"
  echo "  # Get admin JWT for MCP testing"
  echo "  $0 --login admin"
  echo ""
  echo "  # Use token in curl"
  echo "  TOKEN=\$($0 --login admin --token-only)"
  echo "  curl -H \"Authorization: Bearer \$TOKEN\" ${API_URL}/admin/cronjobs"
  echo ""
  echo "  # Set as MCP server env var"
  echo "  export IKM_ADMIN_JWT=\$($0 --login admin --token-only)"
}

do_login() {
  local username="$1"
  local password="${JWT_PASSWORD:-}"
  local cache_file="/tmp/mcp-jwt-${username}.json"

  # Check if cached token is still valid
  if [ -f "$cache_file" ]; then
    local cached_token
    cached_token=$(python3 -c "import json,sys; d=json.load(open('$cache_file')); print(d.get('accessToken',''))" 2>/dev/null || true)
    if [ -n "$cached_token" ]; then
      # Decode JWT payload to check expiry (base64 decode middle part)
      local payload
      payload=$(echo "$cached_token" | cut -d. -f2 | base64 -d 2>/dev/null || true)
      if [ -n "$payload" ]; then
        local exp
        exp=$(echo "$payload" | python3 -c "import json,sys; print(json.load(sys.stdin).get('exp',0))" 2>/dev/null || echo "0")
        local now
        now=$(date +%s)
        if [ "$exp" -gt "$((now + 60))" ]; then
          if [ "$TOKEN_ONLY" = true ]; then
            echo "$cached_token"
          else
            echo -e "${GREEN}[JWT]${RESET} Using cached token for '$username' (expires in $((exp - now))s)" >&2
            echo "$cached_token"
          fi
          return 0
        fi
      fi
    fi
  fi

  # Need fresh login
  if [ -z "$password" ]; then
    echo -e "${YELLOW}[JWT]${RESET} Password for '$username':" >&2
    read -rs password
    echo "" >&2
  fi

  if [ -z "$password" ]; then
    echo -e "${RED}[JWT]${RESET} No password provided." >&2
    exit 1
  fi

  local response
  response=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${username}\",\"password\":\"${password}\"}" 2>&1)

  # Check for 2FA requirement
  local requires_tfa
  requires_tfa=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('requiresTwoFactor',''))" 2>/dev/null || true)
  if [ "$requires_tfa" = "True" ] || [ "$requires_tfa" = "true" ]; then
    echo -e "${RED}[JWT]${RESET} 2FA required for '$username'. Disable 2FA for MCP testing or use API key auth." >&2
    exit 1
  fi

  # Check for access token
  local access_token
  access_token=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null || true)

  if [ -z "$access_token" ]; then
    local error_msg
    error_msg=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message','Unknown error'))" 2>/dev/null || echo "$response")
    echo -e "${RED}[JWT]${RESET} Login failed: $error_msg" >&2
    exit 1
  fi

  # Cache the full response
  echo "$response" > "$cache_file"
  chmod 600 "$cache_file"

  if [ "$TOKEN_ONLY" = true ]; then
    echo "$access_token"
  else
    local expires_in
    expires_in=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('expiresIn',0))" 2>/dev/null || echo "?")
    local user_id
    user_id=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('user',{}).get('id','?'))" 2>/dev/null || echo "?")
    local user_group
    user_group=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('user',{}).get('group','?'))" 2>/dev/null || echo "?")

    echo -e "${GREEN}[JWT]${RESET} Login successful!" >&2
    echo -e "  User:    $username (id=$user_id, group=$user_group)" >&2
    echo -e "  Expires: ${expires_in}s" >&2
    echo -e "  Cached:  $cache_file" >&2
    echo -e "" >&2
    echo -e "  ${YELLOW}Access Token:${RESET}" >&2
    echo "$access_token"
  fi
}

do_test() {
  local token="$1"
  echo -e "\n${BLUE}[TEST]${RESET} Testing admin endpoint: GET /admin/cronjobs" >&2
  local response
  response=$(curl -s -H "Authorization: Bearer $token" "${API_URL}/admin/cronjobs" 2>&1)
  local status
  status=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('statusCode', d.get('success', 'ok')))" 2>/dev/null || echo "parse-error")

  if [ "$status" = "ok" ] || [ "$status" = "True" ] || [ "$status" = "true" ]; then
    local count
    count=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); data=d.get('data',d); print(len(data) if isinstance(data,list) else 'N/A')" 2>/dev/null || echo "?")
    echo -e "${GREEN}[TEST]${RESET} Admin API works! Cronjobs found: $count" >&2
  else
    echo -e "${RED}[TEST]${RESET} Admin API failed: $status" >&2
    echo "$response" | python3 -m json.tool 2>/dev/null >&2 || echo "$response" >&2
  fi
}

show_info() {
  echo -e "${BLUE}[JWT]${RESET} Cached tokens:"
  for f in /tmp/mcp-jwt-*.json; do
    [ -f "$f" ] || continue
    local username
    username=$(basename "$f" | sed 's/mcp-jwt-//;s/.json//')
    local token
    token=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('accessToken','')[:20])" 2>/dev/null || echo "?")
    local exp="?"
    local full_token
    full_token=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('accessToken',''))" 2>/dev/null || true)
    if [ -n "$full_token" ]; then
      exp=$(echo "$full_token" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('exp',0))" 2>/dev/null || echo "?")
    fi
    local now
    now=$(date +%s)
    local remaining="expired"
    if [ "$exp" != "?" ] && [ "$exp" -gt "$now" ]; then
      remaining="$((exp - now))s remaining"
    fi
    echo -e "  ${GREEN}$username${RESET}: ${token}... ($remaining)"
  done
}

# Parse arguments
ACTION=""
USERNAME=""

while [ $# -gt 0 ]; do
  case "$1" in
    --login)
      ACTION="login"
      USERNAME="${2:-}"
      shift 2 || { echo -e "${RED}[JWT]${RESET} Missing username after --login" >&2; exit 1; }
      ;;
    --token-only)
      TOKEN_ONLY=true
      shift
      ;;
    --test)
      RUN_TEST=true
      shift
      ;;
    --info)
      ACTION="info"
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}[JWT]${RESET} Unknown argument: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

case "$ACTION" in
  login)
    token=$(do_login "$USERNAME")
    if [ "$RUN_TEST" = true ] && [ -n "$token" ]; then
      do_test "$token"
    fi
    ;;
  info)
    show_info
    ;;
  *)
    show_help
    exit 1
    ;;
esac

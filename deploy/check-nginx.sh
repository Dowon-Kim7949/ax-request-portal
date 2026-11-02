#!/usr/bin/env bash
# Checks that nginx serves the build the way deploy/nginx.conf promises.
# Usage: bash deploy/check-nginx.sh http://localhost:8080
set -euo pipefail

BASE="${1:?usage: check-nginx.sh <base-url>}"
fail() { echo "FAIL: $*" >&2; exit 1; }
header() { curl -fsSI "$BASE$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d' ' -f2- || true; }

# 1. The app shell
curl -fsS "$BASE/" | grep -q '<div id="root">' || fail "/ does not serve index.html"
[[ "$(header / cache-control)" == "no-cache" ]] || fail "index.html must not be cached"
[[ -n "$(header / x-content-type-options)" ]] || fail "security headers missing on /"

# 2. Deep links fall back to the app (client-side routing)
curl -fsS "$BASE/requests/1024" | grep -q '<div id="root">' || fail "deep link did not fall back to index.html"

# 3. Fingerprinted assets are cached for a year
asset="$(curl -fsS "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -1)"
[[ -n "$asset" ]] || fail "no entry script found in index.html"
[[ "$(header "/$asset" cache-control)" == *immutable* ]] || fail "assets must be immutable"

# 4. A missing asset is a 404, not index.html (otherwise a stale tab gets HTML as JS)
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/assets/does-not-exist.js")"
[[ "$code" == "404" ]] || fail "missing asset returned $code instead of 404"

# 5. The mock service worker is revalidated on every load
[[ "$(header /mockServiceWorker.js cache-control)" == "no-cache" ]] || fail "service worker must not be cached"

# 6. Text is compressed
[[ "$(curl -fsS -H 'Accept-Encoding: gzip' -o /dev/null -D - "$BASE/$asset" | tr -d '\r' | grep -i '^content-encoding:' | cut -d' ' -f2)" == "gzip" ]] \
  || fail "scripts are not gzip-compressed"

echo "nginx checks passed"

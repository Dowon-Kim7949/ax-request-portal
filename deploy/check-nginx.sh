#!/usr/bin/env bash
# Checks that nginx serves the build the way deploy/nginx.conf promises.
#
# Usage: bash deploy/check-nginx.sh http://localhost:8080                  # mock (demo) build
#        API_MOCK=false bash deploy/check-nginx.sh http://localhost:8080   # real-backend build
#        bash deploy/check-nginx.sh https://host/ax                        # sub-path deployment
#
# Needs curl and node (node hashes index.html's inline scripts for the CSP check).
set -euo pipefail

BASE="${1:?usage: check-nginx.sh <base-url>}"
BASE="${BASE%/}"
API_MOCK="${API_MOCK:-true}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() { echo "FAIL: $*" >&2; exit 1; }
# Value of one response header, "" when absent. Error responses count too.
header() { curl -sSI "$BASE$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d' ' -f2- || true; }
status() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }

# 1. The app shell
curl -fsS "$BASE/" | grep -q '<div id="root">' || fail "/ does not serve index.html"
[[ "$(header / cache-control)" == "no-cache" ]] || fail "index.html must not be cached"

# 2. Deep links fall back to the app (client-side routing)
curl -fsS "$BASE/requests/1024" | grep -q '<div id="root">' || fail "deep link did not fall back to index.html"
[[ "$(header /requests/1024 cache-control)" == "no-cache" ]] || fail "a deep link must not be cached"

# 3. Fingerprinted assets are cached for a year
asset="$(curl -fsS "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -1)"
[[ -n "$asset" ]] || fail "no entry script found in index.html"
[[ "$(header "/$asset" cache-control)" == *immutable* ]] || fail "assets must be immutable"

# 4. A missing asset is a 404, not index.html (otherwise a stale tab gets HTML
#    as JS), and that 404 is not cached for a year
[[ "$(status /assets/does-not-exist.js)" == "404" ]] || fail "missing asset did not return 404"
[[ "$(header /assets/does-not-exist.js cache-control)" != *immutable* ]] || fail "a missing asset's 404 must not be cached"

# 5. The mock service worker: revalidated on every load, and outside the page's
#    CSP (it fetches the web font for the page). A real-backend build has none.
if [[ "$API_MOCK" == "false" ]]; then
  [[ "$(status /mockServiceWorker.js)" == "404" ]] || fail "a real-backend build must not serve the mock service worker"
else
  [[ "$(status /mockServiceWorker.js)" == "200" ]] || fail "the mock service worker is missing from the build"
  [[ "$(header /mockServiceWorker.js cache-control)" == "no-cache" ]] || fail "service worker must not be cached"
  [[ -z "$(header /mockServiceWorker.js content-security-policy)" ]] || fail "the service worker must not get the page's CSP"
fi

# 6. Text is compressed
[[ "$(curl -fsS -H 'Accept-Encoding: gzip' -o /dev/null -D - "$BASE/$asset" | tr -d '\r' | grep -i '^content-encoding:' | cut -d' ' -f2)" == "gzip" ]] \
  || fail "scripts are not gzip-compressed"

# 7. version.json, which open tabs poll to learn of a new deployment, is revalidated
curl -fsS "$BASE/version.json" | grep -q '"buildId"' || fail "version.json is missing from the build"
[[ "$(header /version.json cache-control)" == "no-cache" ]] || fail "version.json must not be cached"

# 8. Security headers on every kind of response, errors included
for path in / /requests/1024 "/$asset" /version.json /assets/does-not-exist.js; do
  for name in content-security-policy permissions-policy cross-origin-opener-policy \
    x-content-type-options x-frame-options referrer-policy; do
    [[ -n "$(header "$path" "$name")" ]] || fail "$name header missing on $path"
  done
done

# 9. The CSP runs index.html's inline scripts by hash and allows no other inline script.
#    The hashes are read before the loop: a command failing inside a for loop's
#    word list does not stop the script, and the check would pass unchecked.
command -v node >/dev/null || fail "node is required for the CSP hash check (it hashes index.html's inline scripts)"
csp="$(header / content-security-policy)"
script_src="$(tr ';' '\n' <<<"$csp" | sed 's/^ *//' | grep '^script-src ' || true)"
[[ -n "$script_src" ]] || fail "the CSP has no script-src"
[[ "$script_src" != *unsafe-inline* && "$script_src" != *unsafe-eval* ]] \
  || fail "script-src must not allow 'unsafe-inline' or 'unsafe-eval'"
hashes="$(curl -fsS "$BASE/" | node "$HERE/csp-hashes.mjs")" || fail "could not hash the inline scripts of index.html"
[[ -n "$hashes" ]] || fail "index.html has no inline script to check (the theme script is expected)"
for hash in $hashes; do
  [[ "$script_src" == *"$hash"* ]] \
    || fail "script-src lacks $hash, an inline script in index.html (print the hashes with: node deploy/csp-hashes.mjs dist/index.html)"
done
[[ "$csp" == *"frame-ancestors 'none'"* ]] || fail "the CSP must forbid framing"

echo "nginx checks passed (API_MOCK=$API_MOCK)"

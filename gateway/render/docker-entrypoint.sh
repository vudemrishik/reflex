#!/bin/sh
# Render entrypoint: render the nginx template with the runtime env,
# then run nginx in the foreground.
# NOTE: envsubst is called with an EXPLICIT variable list so nginx's own
# $variables ($remote_addr, $http_cookie, …) are left untouched.
set -eu

: "${PORT:?Render must provide \$PORT}"
: "${AUTH_UPSTREAM:?Set AUTH_UPSTREAM to the auth service public hostname}"
: "${GAME_UPSTREAM:?Set GAME_UPSTREAM to the game service public hostname}"
: "${FRONTEND_URL:?Set FRONTEND_URL to the Vercel app URL (no trailing slash)}"

envsubst '${PORT} ${AUTH_UPSTREAM} ${GAME_UPSTREAM} ${FRONTEND_URL}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

nginx -t
exec nginx -g 'daemon off;'

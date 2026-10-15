# Render production gateway (API-only; frontend lives on Vercel).
# Local docker-compose keeps using ../Dockerfile + ../nginx.conf untouched.
FROM nginx:1.27-alpine

RUN apk add --no-cache gettext && rm /etc/nginx/conf.d/default.conf

COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 10000
ENTRYPOINT ["/docker-entrypoint.sh"]

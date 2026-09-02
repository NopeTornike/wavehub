FROM nginx:1.27-alpine

COPY *.html *.js *.css /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80

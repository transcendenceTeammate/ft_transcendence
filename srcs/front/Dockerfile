FROM nginx:alpine

COPY srcs /usr/share/nginx/html
COPY conf/default.conf /etc/nginx/conf.d/default.conf


COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["nginx", "-g", "daemon off;"]

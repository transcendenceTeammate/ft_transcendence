FROM nginx:stable

RUN apt-get update && \
    apt-get install -y openssl netcat-traditional dumb-init gettext-base && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/nginx/ssl

COPY conf/default.conf.template /etc/nginx/conf.d/default.conf.template
COPY conf/snippets/cors.conf.template /etc/nginx/snippets/cors.conf.template
COPY conf/snippets/websocket.conf /etc/nginx/snippets/websocket.conf
COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV BASE_URL=${BASE_URL}
ENV API_URL=${API_URL}

ENTRYPOINT ["dumb-init", "--"]
CMD ["/entrypoint.sh"]
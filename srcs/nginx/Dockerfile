FROM nginx:stable

RUN apt-get update && \
    apt-get install -y openssl netcat-traditional dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/nginx/ssl

COPY conf/default.conf.template /etc/nginx/templates/default.conf.template
COPY conf/snippets /etc/nginx/templates/snippets
COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh

RUN rm -rf /etc/nginx/conf.d/default.conf

RUN chmod +x /entrypoint.sh

# ENTRYPOINT ["dumb-init", "--"]


CMD ["nginx", "-g", "daemon off;"]
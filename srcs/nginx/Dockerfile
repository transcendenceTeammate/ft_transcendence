FROM nginx:stable

RUN apt-get update && \
    apt-get install -y openssl netcat-traditional dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create the destination folder for SSL certificates (mounted later)
RUN mkdir -p /etc/nginx/ssl

# Remove the certificate generation from the build –
# certificates will be generated at runtime in the entrypoint if needed

COPY conf/default.conf /etc/nginx/conf.d/default.conf
COPY conf/snippets /etc/nginx/snippets
COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["dumb-init", "--"]
CMD ["/entrypoint.sh"]

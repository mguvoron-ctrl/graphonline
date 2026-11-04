FROM php:8.4-cli@sha256:7e7413ed31b8c42b31c939cc83b3758b1cd618f7bf3803f5a0c39f98d4adcbee
WORKDIR /app
COPY --chown=www-data:www-data . .
USER www-data
EXPOSE 8080
CMD ["php", "-d", "short_open_tag=On", "-S", "0.0.0.0:8080", "-t", ".", "tools/router.php"]

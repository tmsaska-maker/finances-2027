FROM node:22-alpine
WORKDIR /app
COPY gateway.mjs main.mjs ./
USER node
EXPOSE 8092
CMD ["node", "main.mjs"]

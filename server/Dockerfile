FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund --ignore-scripts && npm cache clean --force
COPY main.mjs http.mjs repository.mjs validation.mjs ./
USER node
EXPOSE 8091
CMD ["node", "main.mjs"]

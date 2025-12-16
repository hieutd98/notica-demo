# Use Debian-based image for better compatibility
FROM node:18-slim

# Build-time variable
ARG APP_ENV
ENV APP_ENV=${APP_ENV}

RUN echo "Running in $APP_ENV environment"

# Install OpenSSL and other dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Expose port
EXPOSE 3000

# For development, use sh to handle npm install on startup if node_modules is empty
CMD sh -c "if [ ! -f node_modules/.bin/nest ]; then echo 'Installing dependencies...' && npm install; fi && if [ \"$APP_ENV\" = \"local\" ]; then npm run start:dev; else npm run build && npm run start:prod; fi"

# Frontend Dockerfile for Railway deployment
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install serve to serve the built app
RUN npm install -g serve

# Expose port
EXPOSE 8080

# Start the application with Railway's expected port
CMD ["sh", "-c", "serve -s build -l ${PORT:-8080}"]
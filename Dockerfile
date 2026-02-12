# Use official Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies including devDeps for build
RUN npm install

# Copy source code
COPY . .

# Generate a production-ready build or environment if needed
# For the worker, we run it directly via tsx as it is a background process
# In a true high-load prod env, you might pre-compile to JS.

# Set environment variables (these should ideally be provided by Cloud Run Secrets)
ENV NODE_ENV=production

# The worker script entry point
CMD ["npm", "run", "worker:liquidate"]

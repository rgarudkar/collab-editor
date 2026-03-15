FROM node:20-slim

# Install system dependencies: python3 for Python code execution, g++ for C++
RUN apt-get update && apt-get install -y \
    python3 \
    g++ \
    make \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files from the server directory
COPY server/package*.json ./
RUN npm install

# Copy everything from server directory
COPY server/ .

# Ensure temp directory exists for code execution
RUN mkdir -p temp

# Expose the port (Railway/Render will use PORT env var)
EXPOSE 3002

# Use npm start to respect the package.json configuration
CMD ["npm", "start"]

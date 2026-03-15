FROM node:20-slim

# Install system dependencies: python3 for Python code execution, g++ for C++
RUN apt-get update && apt-get install -y \
    python3 \
    g++ \
    make \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Ensure temp directory exists for code execution
RUN mkdir -p temp

# Expose the port (Railway/Render will use PORT env var)
EXPOSE 3002

CMD ["node", "index.js"]

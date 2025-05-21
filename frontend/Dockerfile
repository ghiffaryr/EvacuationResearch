# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json files
COPY package.json ./

# Install dependencies (use normal install since we don't have package-lock.json)
RUN npm install

# Copy project files
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

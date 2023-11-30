# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the application
RUN npm run build

# Expose the port that the application listens on (3000 and 3001)
EXPOSE 3000
EXPOSE 3001
EXPOSE 9229

# Start the application
CMD [ "npm", "start" ]
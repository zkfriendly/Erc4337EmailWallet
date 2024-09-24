# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package*.json and install dependencies
COPY package*.json ./
COPY yarn.lock ./
RUN yarn

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 4000
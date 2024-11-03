   
FROM node:18-alpine
RUN apk update && apk add  ffmpeg imagemagick graphicsmagick
WORKDIR /app
COPY . /app
EXPOSE 3000
RUN npm install 
CMD ["node", "app.js"]

FROM node:19.2.0

WORKDIR /app

COPY . /app

RUN npm ci

CMD ["npm", "start"]
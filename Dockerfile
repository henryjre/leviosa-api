FROM node:19.2.0

WORKDIR /usr/app

COPY . .

RUN npm ci

CMD ["npm", "start"]
FROM node:19.2.0

WORKDIR /usr/app

ENV PORT 8080

COPY . .

RUN npm ci

CMD ["npm", "start"]
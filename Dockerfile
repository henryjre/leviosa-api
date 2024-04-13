FROM node:19.2.0

WORKDIR /src

COPY . .

RUN npm ci

CMD ["npm", "start"]
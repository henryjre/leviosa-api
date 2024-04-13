FROM node:19.2.0

WORKDIR /app/src

COPY . /app/src

RUN npm ci

CMD ["npm", "start"]
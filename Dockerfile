FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY . .

COPY package*.json ./

RUN yarn install

RUN yarn build


FROM node:24-alpine

WORKDIR /app

COPY --from=builder /usr/src/app/dist /app/dist

COPY --from=builder /usr/src/app/node_modules/@patrickkfkan/peer-dial/xml /app/xml

CMD [ "node", "dist/index.js" ]
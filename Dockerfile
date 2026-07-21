FROM node:22

WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
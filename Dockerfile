FROM node:18-alpine
# Installation des dépendances nécessaires
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git

WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm install

WORKDIR /opt/app
COPY . .
RUN npm run build
EXPOSE 1337

CMD ["npm", "run", "develop"]

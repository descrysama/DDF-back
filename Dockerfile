FROM node:22

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    autoconf \
    automake \
    zlib1g-dev \
    libpng-dev \
    libvips-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "develop"]

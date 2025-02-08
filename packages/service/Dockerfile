FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    stun \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY packages/service/*.json packages/service/

WORKDIR /app/packages/service
RUN npm install --omit=dev 

WORKDIR /app
COPY submodules/gemini/src submodules/gemini/src
COPY submodules/werift/packages submodules/werift/packages
COPY submodules/wish/libs/whip-server/src submodules/wish/libs/whip-server/src
COPY packages/core/src packages/core/src
COPY packages/json-rpc/src packages/json-rpc/src
COPY packages/service/src packages/service/src

WORKDIR /app/packages/service
RUN npm run compile

# ENV DEBUG=werift*
CMD ["node","lib/index.mjs"]

EXPOSE 3001

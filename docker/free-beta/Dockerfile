# syntax=docker/dockerfile:1
FROM node:20-bookworm as base
WORKDIR /src
ENV BODYPACE_PERSONAL_DATA_SERVER_SKIP_PREPARE=1
RUN --mount=type=cache,target=/root/.npm/_cacache/ \
    --mount=type=bind,source=package.json,target=/src/package.json \
    --mount=type=bind,source=package-lock.json,target=/src/package-lock.json \
    npm ci --loglevel verbose && \
    mv node_modules /tmp/node_modules
RUN --mount=type=cache,target=/root/.npm/_cacache/ \
    --mount=type=bind,target=.,rw \
    mv /tmp/node_modules node_modules && \
    npm run build && \
    mv dist /tmp/dist
RUN --mount=type=cache,target=/root/.npm/_cacache/ \
    --mount=type=bind,source=package.json,target=/src/package.json \
    --mount=type=bind,source=package-lock.json,target=/src/package-lock.json \
    npm ci --loglevel verbose --omit dev && \
    mv node_modules /tmp/node_modules

FROM node:20-bookworm AS prod
ARG USER_GID=100
# by default node:20-alpine has user `node` with GID 1000 which does not match the GID of my host user,
# there is AFAIK no command in Alpine Linux / BusyBox that will change the primary GID of an existing user
RUN sed -i -r "s/^(node:x:1000:)(1000)(:.*)/\1$USER_GID\3/" /etc/passwd
USER node
WORKDIR /app
COPY --from=base --chown=node /tmp/dist dist/
COPY --from=base --chown=node /tmp/node_modules node_modules/
COPY --chown=node database/ database/
COPY --chown=node LICENSE LICENSE
# we need docs/ dir because server will generate OpenAPI spec and save it there
# and there is no option yet to disable generation of that spec
RUN mkdir docs/
ENV BODYPACE_SERVER_JWT_SECRET "enter some value here, random long and complex alphanumeric sequence, do not share it"
ENTRYPOINT [ "node", "dist/main.js" ]
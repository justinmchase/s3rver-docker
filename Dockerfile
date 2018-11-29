# only used for docker-compose
FROM node:8
WORKDIR /app

COPY package.json package-lock.json /app/
RUN npm i

COPY index.js /app/
COPY cors.xml /app/
ADD s3rver-workaround /app/s3rver-workaround

# everything else is handled in docker-compose
EXPOSE 4569
CMD [ "node", "." ]

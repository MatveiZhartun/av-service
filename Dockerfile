FROM node:10-stretch-slim

# [ClamAV] Start setup
#
COPY av-settings av-settings
RUN apt-get update
RUN apt-get install -y clamav
RUN apt-get install -y clamav-daemon
RUN cp ./av-settings/freshclam.conf.sample /etc/clamav/freshclam.conf
RUN cp ./av-settings/clamd.conf.sample /etc/clamav/clamd.conf
RUN freshclam
#
# [ClamAV] End setup

WORKDIR /app
COPY files files
COPY src src
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY server.js server.js
RUN npm install

CMD ["node","server.js"]

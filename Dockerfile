# Docker not supported for now

FROM node:10

WORKDIR /app
COPY src src
COPY files files
COPY package.json package.json
COPY server.js server.js
RUN npm install

# [ClamAV] Start setup
#
RUN apt-get update
RUN apt-get install -y clamav
RUN apt-get install -y clamav-daemon
RUN cp ./src/av/clamav/config/freshclam.conf.sample /etc/clamav/freshclam.conf
RUN cp ./src/av/clamav/config/clamd.conf.sample /etc/clamav/clamd.conf
RUN freshclam
# Not sure why, but calling `clamd` from here didn't start clam-daemon
# That's why it should be called manually
# RUN clamd
#
# [ClamAV] End setup

CMD ["node","server.js"]

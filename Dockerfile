FROM node:10-stretch-slim

# [ClamAV] Start setup
#
COPY config config
RUN apt-get update
RUN apt-get install -y clamav
RUN apt-get install -y clamav-daemon
RUN cp ./config/freshclam.conf /etc/clamav/freshclam.conf
RUN cp ./config/clamd.conf /etc/clamav/clamd.conf
RUN freshclam
#
# [ClamAV] End setup

WORKDIR /app
COPY app app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY server.js server.js
RUN npm install

CMD ["node","server.js"]

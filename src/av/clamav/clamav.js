const net = require('net');
const fs = require('fs');
const path = require('path');
const Readable = require('stream').Readable;
const Transform = require('stream').Transform;
const config = require('../../config/av').clamav;
const runClamd = require('./clamd-start');

class ClamAV {
  constructor (state) {
    this.state = state || 'pending';
  }

  run () {
    let self = this;
    let startClamd = runClamd;

    if (self.state === 'running') {
      return;
    }

    if (!startClamd) {
      console.error('[clamav-daemon] No starter for current platform found, nut you still can run `clamd` manually.');
      self.state = 'running';

      return;
    }

    console.log('[clamav-daemon] Starting...');
    self.state = 'starting';

    startClamd()
      .then(function () {
        console.log('[clamav-daemon] Ready.');

        self.state = 'running';
      })
      .catch(function (e) {
        console.log('[clamav-daemon] Down.');
        console.error(e);

        self.state = 'down';
      });
  }

  scanStream (readStream) {
    let state = this.state;

    if (state !== 'running') {
      return new Promise ( function (resolve, reject) {
        return reject(`'clamav-daemon' is ${state}.`);
      });
    }

    return new Promise(function (resolve, reject) {
      let socket = null;
      let connectAttemptTimer = null;
      let replies = []
      let readFinished = false;

      try {
        socket = net.createConnection({ host: config.host, port: config.port }, function () {
          socket.write('zINSTREAM\0');

          readStream.pipe(chunkTransform()).pipe(socket);
          readStream.on('end', function () {
            readFinished = true;
            readStream.destroy();
          });
          readStream.on('error', reject);
        });
      } catch (e) {
        throw e;
      }

      socket.setTimeout(config.connectionTimeout);
      socket.on('data', function (chunk) {
        clearTimeout(connectAttemptTimer);

        if (!readStream.isPaused()) {
          readStream.pause();
        }

        replies.push(chunk);
      });
      socket.on('end', function () {
        clearTimeout(connectAttemptTimer);
        let reply = Buffer.concat(replies).toString('utf8') || '';

        if (!readFinished) {
          return reject(new Error('Scan aborted. Reply from server: ' + reply));
        }

        if (reply.startsWith('stream: OK')) {
          return resolve({ threat: null });
        }

        return resolve({ threat: reply })
      })
      socket.on('error', reject);

      connectAttemptTimer = setTimeout(function () {
        socket.destroy(new Error('Timeout connecting to server'));
      }, config.connectionTimeout)
    })
  }

  scanBuffer (buffer) {
    let state = this.state;
    let start = 0;

    if (state !== 'running') {
      return new Promise ( function (resolve, reject) {
        return reject(`'clamav-daemon' is ${state}.`);
      });
    }

    return this.scanStream(
      new Readable({
        highWaterMark: config.bufferChunkSize,
        read (size) {
          if (start < buffer.length) {
            let block = buffer.slice(start, start + size);
            this.push(block);
            start += block.length;
          } else {
            this.push(null);
          }
        }
      }),
      config.connectionTimeout
    );
  }

  scanFile (filePath) {
    let state = this.state;

    if (state !== 'running') {
      return new Promise ( function (resolve, reject) {
        return reject(`'clamav-daemon' is ${state}.`);
      });
    }

    return this.scanStream(
      fs.createReadStream(path.normalize(filePath), { highWaterMark: config.bufferChunkSize }),
      config.connectionTimeout
    );
  }

  version () {
    return _command('zVERSION\0').then(function (res) { return res.toString(); });
  }
}

function chunkTransform () {
  return new Transform({
    transform (chunk, encoding, callback) {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(chunk.length, 0);
      this.push(length);
      this.push(chunk);
      callback();
    },

    flush (callback) {
      const zore = Buffer.alloc(4);
      zore.writeUInt32BE(0, 0);
      this.push(zore);
      callback();
    }
  })
}

function _command (command) {
  return new Promise(function (resolve, reject) {
    let replies = [];
    let client = null;

    try {
      client = net.createConnection(
        { host: config.host, port: config.port },
        function () { client.write(command) }
      );
    }
    catch (e) {
      throw e;
    }

    client.setTimeout(config.connectionTimeout);

    client.on('data', function (chunk) { replies.push(chunk) });
    client.on('end', function () { resolve(Buffer.concat(replies)) });
    client.on('error', reject);
  });
}

module.exports = ClamAV;

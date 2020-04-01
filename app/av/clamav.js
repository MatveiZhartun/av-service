const net = require('net');
const Readable = require('stream').Readable;
const Transform = require('stream').Transform;
const config = require('./config/clamav-config');
const exec = require('../utils/exec');

class ClamAV {
  constructor (state) {
    this.state = state || 'pending';
  }

  run () {
    let self = this;

    if (self.state === 'running') {
      return;
    }

    if (!exec) {
      console.error('[clamav-daemon] No executor for current platform found, nut you still can run `clamd` manually.');
      self.state = 'running';

      return;
    }

    self.state = 'starting';
    console.log('[clamav-daemon] Starting...');

    exec('clamd')
      .then(() => {
        self.state = 'running';

        console.log('[clamav-daemon] Ready.');
      })
      .catch((e) => {
        self.state = 'down';

        console.log('[clamav-daemon] Down.');
        console.error(e);
      });
  }

  scanStream (readStream) {
    let state = this.state;

    if (state !== 'running') {
      return new Promise((resolve, reject) => reject(`'clamav-daemon' is ${state}.`));
    }

    return new Promise((resolve, reject) => {
      let socket = null;
      let connectAttemptTimer = null;
      let replies = []
      let readFinished = false;

      try {
        socket = net.createConnection({ host: config.host, port: config.port }, () => {
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
      socket.on('data', (chunk) => {
        clearTimeout(connectAttemptTimer);

        if (!readStream.isPaused()) {
          readStream.pause();
        }

        replies.push(chunk);
      });
      socket.on('end', () => {
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

      connectAttemptTimer = setTimeout(() => {
        socket.destroy(new Error('Timeout connecting to server'));
      }, config.connectionTimeout)
    })
  }

  scanBuffer (buffer) {
    let state = this.state;
    let start = 0;

    if (state !== 'running') {
      return new Promise ((resolve, reject) => reject(`'clamav-daemon' is ${state}.`));
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

module.exports = ClamAV;

const { exec, spawn } = require('child_process');

function getWin32ClamdPromise () {
  return new Promise(function (resolve, reject) {
    let clamd = spawn('clamd', []);

    clamd.stdout.on('data', function () {
      return resolve();
    });

    clamd.stderr.on('data', function (data) {
      return reject({
        reason: 'Clamd failed to start',
        meta: data,
      });
    });
  });
}

function getUnixClamdPromise () {
  return new Promise(function (resolve, reject) {
    return exec('clamd', function (err) {
      if (err) {
        return reject({
          reason: 'Clamd failed to start',
          meta: err,
        });
      }

      return resolve();
    });
  })
}

const starters = {
  'darwin': getUnixClamdPromise,
  'freebsd': getUnixClamdPromise,
  'linux': getUnixClamdPromise,
  'openbsd': getUnixClamdPromise,
  'netbsd': getUnixClamdPromise,
  'win32': getWin32ClamdPromise,
}

module.exports = starters[process.platform];

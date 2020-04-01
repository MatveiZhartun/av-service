const { exec, spawn } = require('child_process');

function getWin32ExecPromise (command) {
  return new Promise((resolve, reject) => {
    let clamd = spawn(command, []);

    clamd.stdout.on('data', () => resolve());
    clamd.stderr.on('data', (data) => reject({ meta: `${data}` }));
  });
}

function getUnixExecPromise (command) {
  return new Promise((resolve, reject) =>
    exec(command, (err) => err ? reject({ meta: `${err}` }) : resolve())
  )
}

const starters = {
  'darwin': getUnixExecPromise,
  'freebsd': getUnixExecPromise,
  'linux': getUnixExecPromise,
  'openbsd': getUnixExecPromise,
  'netbsd': getUnixExecPromise,
  'win32': getWin32ExecPromise,
}

module.exports = starters[process.platform];

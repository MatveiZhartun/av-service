const ClamAV = require('./av/clamav');

module.exports = function (app) {
  let av = startAntivirusService();

  app.post('/scan', (req, res) => {
    if (!req.files || !req.files.doc) {
      res.status(400);
      res.send({ status: 'No file provided or file-key isn\'t "doc"' });

      return;
    }

    const file = req.files.doc;

    av.scanBuffer(file.data)
      .then((result) => {
        if (result && result.threat) {
          res.status(400);
          res.send({ infected: true, result: '[Infected file] ' + result.threat });

          return;
        }

        res.status(200);
        res.send({ infected: false, result: '[File is clean]' });
      })
      .catch(function (e) {
        res.status(500);
        res.send({ result: '[Failed]', error: e });
      });
  });
}

function startAntivirusService () {
  let clamd = new ClamAV();
  clamd.run();

  return clamd;
}

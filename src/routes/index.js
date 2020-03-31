const filesConfig = require('../config/files');
const ClamAV = require('../av/clamav/clamav');

module.exports = function (app) {
  let clamd = new ClamAV();
  clamd.run();

  app.post('/scan', function (req, res) {
    if (!req.files || !req.files.doc) {
      res.status(400);
      res.send({
        status: 'No file provided or file-key isn\'t "doc"',
      });

      return;
    }


    const file = req.files.doc;
    const path = filesConfig.uploadsFolder + file.name;

    clamd.scanBuffer(file.data)
      .then(function (result) {
        if (result && result.threat) {
          res.status(400);
          res.send({
            result: '[Infected file] ' + result.threat,
          });

          return;
        }

        file.mv(path, function (err) {
          if (err) {
            res.status(500);
            res.send({
              result: '[Unable to save file]',
              error: err,
            });

            return;
          }

          res.status(200);
          res.send({
            result: '[File uploaded]',
          });
        });
      })
      .catch(function (e) {
        res.status(500);
        res.send({
          result: '[Failed]',
          error: e,
        });
      });
  });
}

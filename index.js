var request = require('request');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({imageMagick: true});
var async = require('async');

var s3 = new AWS.S3();

var PostmarkS3Uploader = function (config) {

  this.s3Bucket = config.bucket;

  AWS.config.update({
    accessKeyId: config.key,
    secretAccessKey: config.secret,
    region: config.region,
  });

  this.s3 = new AWS.S3(); 
}

// PostmarkS3Uploader.prototype.upload = function (req, res, done) {
PostmarkS3Uploader.prototype.upload = function (req, done) {

  var self = this;

  // var mailRaw= '';

  // req.on('data', function(chunk) {
  //   mailRaw += chunk;
  // });

  // req.on('end', function() {

    // var mailJSON = JSON.parse(mailRaw);

    // var attachments = mailJSON.Attachments; 
    var attachments = req.Attachments; 

    if(attachments) {

      var headers;

      attachments.forEach(function(attachment) {
        var base64data = new Buffer(attachment.Content, 'base64');
            async.parallel([
                function(cb){
                  self.s3.putObject({
                    Bucket: self.s3Bucket,
                    Key: attachment.Name,
                    Body: base64data,
                    ContentType: attachment.ContentType,
                    ContentEncoding: 'base64',
                    ContentLength: attachment.ContentLength,
                    ACL: 'public-read'
                  }, function (err,data){
                    if (err){
                      console.log("Error!");
                      console.log(err);
                    } else {
                      console.log("put normal image to S3");
                      cb(null, "https://s3.amazonaws.com/"+self.s3Bucket+"/"+attachment.Name);
                    }
                  });
                },
                function(cb){
                  resizeImage(base64data,attachment.Name, self.s3, self.s3Bucket,150,150,"thumb", cb); 
                },
                function(cb){
                  resizeImage(base64data,attachment.Name, self.s3, self.s3Bucket,350,350,"medium", cb); 
                }
              ],
              done
            );
      }); // end forEach
    } // end if
    // Send an empty response.
    // res.end();
  // }); // end req.on(end)
};

var resizeImage = function(res,url, awsClient, s3Bucket, ht, width, suffix, cb) {
  console.log("endpoint for s3...");
  console.log(awsClient.endpoint)
  gm(res).resize(ht, width, '^').gravity('Center').extent(ht, width).quality(80).stream(function(err, stdout, stderr) {
    if (err) {
      cb(err);
    } else {

      var buf = new Buffer(0);

      stdout.on('data', function(d) {
        buf = Buffer.concat([buf, d]);
      });

      stdout.on('end', function() {
        var key = url.substr(url.lastIndexOf("/")+1) + ":" + suffix;
        var data = {
          ACL: 'public-read',
          Bucket: s3Bucket,
          Key: key,
          Body: buf
        };
        awsClient.putObject(data, function(err, resp) {
          if (err) {
            console.log(err)
          } else {
            cb(null, awsClient.endpoint.href + s3Bucket + "/" + key );
          }
        });
      });
    }
  });
}
// var resizeImage = function(res,url, awsClient, s3Bucket, cb) {
//   console.log(awsClient.endpoint)
//   gm(res).resize(150, 150, '^').gravity('Center').extent(150, 150).quality(80).stream(function(err, stdout, stderr) {
//     if (err) {
//       cb(err);
//     } else {

//       var buf = new Buffer(0);

//       stdout.on('data', function(d) {
//         buf = Buffer.concat([buf, d]);
//       });

//       stdout.on('end', function() {
//         var data = {
//           ACL: 'public-read',
//           Bucket: s3Bucket,
//           Key: url,
//           Body: buf
//         };
//         awsClient.putObject(data, function(err, resp) {
//           if (err) {
//             console.log(err)
//           } else {
//             cb(null, "put thumb");
//           }
//         });
//       });
//     }
//   });
// }

var putImageAsIs = function(res, targetUri, knoxClient, cb) {

  var headers = {
      'Content-Length': res.headers['content-length']
    , 'Content-Type': res.headers['content-type']
    , 'x-amz-acl': 'public-read'
  };

  var key = targetUri.substr(targetUri.lastIndexOf("/") + 1);

  knoxClient.putStream(res, key, headers, function(err, res){
    if (err) {
      cb(err);
    } else {
      cb(null, "put as-is image: " + res.body);
    }
  });
}

exports.PostmarkS3Uploader = PostmarkS3Uploader;

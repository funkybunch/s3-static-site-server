const express = require('express');
const app = express();
require('dotenv').config();

let Minio = require('minio')

let S3_Client = new Minio.Client({
    endPoint: process.env.S3_API_ENDPOINT,
    port: ((process.env.S3_API_PORT) ? parseInt(process.env.S3_API_PORT) : 9000),
    useSSL: (process.env.S3_API_SSL === 'true'),
    accessKey: process.env.S3_API_ACCESSKEY,
    secretKey: process.env.S3_API_SECRETKEY
});
S3_Client.setRequestOptions({rejectUnauthorized: false})

function formatFileQuery(path) {
    let output = path;
    if(process.env.SERVER_FORMAT === 'directory' && path !== '/favicon.ico') {
        output = path.substr(path.indexOf('/' + path.split('/')[1]) + path.split('/')[1].length + 2);
    }
    if(path[path.length-1] === "/") {
        // path is a directory
        // append `index.html`
        console.log('Type: directory path with trailing slash');
        output = output + 'index.html';
    } else if(!path.split('/')[path.split('/').length-1].includes('.')) {
        // path does not include file extension, assume directory missing trailing slash
        // append `index.html`
        console.log('Type: directory path without trailing slash');
        output = output + '/index.html';
    } else if(path === '/favicon.ico') {
        // path is favicon
        console.log('Type: directory path without trailing slash');
        output = 'favicon.ico';
    }
    return output;
}

app.get('*', function (req, res) {
    let bucket = '';
    let file = formatFileQuery(req.path);
    let isRoot = false;
    if(process.env.SERVER_FORMAT === 'directory') {
        if(req.path === '/') {
            isRoot = true;
        } else {
            bucket = req.path.split('/')[1];
        }
    } else if(process.env.SERVER_FORMAT === 'subdomain') {
        let tmp = req.hostname.replace(process.env.BASE_URL, '').trim();
        if(req.hostname === process.env.BASE_URL) {
            isRoot = true;
        } else {
            while (tmp[tmp.length-1] === ".")
                tmp = tmp.slice(0,-1);
            bucket = tmp.replace(process.env.BASE_URL, '').trim();
        }
    }
    if(!isRoot) {
        S3_Client.bucketExists(bucket, function(error, exists) {
            if (error) {
                // 400 Site Does Not Exist
                res.status(500).send('500 Server Configuration Error');
            }
            if (exists) {
                S3_Client.getObject(bucket, file, function(error, stream) {
                    if(error) {
                        // Page or file does not exist
                        res.status(404).send('404 Not Found');
                    }
                    stream.pipe(res);
                });
            } else {
                res.status(400).send('400 Site Does Not Exist');
            }
        })
    } else {
        res.send('Site Root');
    }
});

app.listen(3000);
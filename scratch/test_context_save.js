const http = require('https');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: body
                });
            });
        });
        req.on('error', (err) => reject(err));
    });
}

async function runTest() {
    try {
        const res = await makeRequest('https://taskaware-backend.onrender.com/api/check-update/');
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${res.body}`);
    } catch (err) {
        console.error(err);
    }
}

runTest();

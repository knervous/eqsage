const httpProxy = require('http-proxy');

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({});

module.exports = (req, res) => {
  // Extract the target URL from the header
  const target = req.headers['x-remote-api'];

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Error: Missing X-Remote-Api header');
  }


  // Remove headers that might interfere with the proxy
  delete req.headers.host;
  const httpTarget = target.startsWith('http://') ? target : `http://${target}`;
  // res.json({httpTarget, url: req.url})
  // return;
  // Proxy the request
  proxy.web(
    req,
    res,
    { target: `${httpTarget}/api/v1`, changeOrigin: true, secure: false },
    (error) => {
      console.error('Proxy error:', error);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Proxy error: ${error.message}, ${target}`);
    }
  );
};

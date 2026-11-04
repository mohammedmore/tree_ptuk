import zlib from "node:zlib";

/**
 * High-performance Brotli / Gzip response compression middleware for API payloads.
 */
export function responseCompression(req, res, next) {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  const supportsBr =
    acceptEncoding.includes("br") && typeof zlib.brotliCompress === "function";
  const supportsGzip = acceptEncoding.includes("gzip");

  if (!supportsBr && !supportsGzip) {
    return next();
  }

  const originalSend = res.send;
  res.send = function (body) {
    if (!res.headersSent) {
      let buffer;
      if (Buffer.isBuffer(body)) {
        buffer = body;
      } else if (typeof body === "string") {
        buffer = Buffer.from(body);
      } else if (typeof body === "object" && body !== null) {
        try {
          buffer = Buffer.from(JSON.stringify(body));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        } catch {
          return originalSend.call(res, body);
        }
      }

      if (buffer && buffer.length > 1024) {
        res.setHeader("Vary", "Accept-Encoding");
        res.removeHeader("Content-Length");

        if (supportsBr) {
          res.setHeader("Content-Encoding", "br");
          zlib.brotliCompress(
            buffer,
            {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
              },
            },
            (err, compressed) => {
              if (err) {
                return originalSend.call(res, body);
              }
              res.setHeader("Content-Length", compressed.length);
              return originalSend.call(res, compressed);
            },
          );
          return res;
        }

        if (supportsGzip) {
          res.setHeader("Content-Encoding", "gzip");
          zlib.gzip(buffer, { level: 6 }, (err, compressed) => {
            if (err) {
              return originalSend.call(res, body);
            }
            res.setHeader("Content-Length", compressed.length);
            return originalSend.call(res, compressed);
          });
          return res;
        }
      }
    }
    return originalSend.call(res, body);
  };

  next();
}

import autoBind from 'auto-bind';

export function promisify(xhr) {
  const oldSend = xhr.send;
  xhr.send = function () {
    const xhrArguments = arguments;
    return new Promise((resolve, reject) => {
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject({
            status    : xhr.status,
            statusText: xhr.statusText,
          });
        } else {
          resolve(xhr);
        }
      };
      xhr.onerror = function () {
        reject({
          status    : xhr.status,
          statusText: xhr.statusText,
        });
      };
      try {
        oldSend.apply(xhr, xhrArguments);
      } catch (e) {}
    });
  };
  return xhr;
}


class RequestCache {
  constructor() {
    autoBind(this);
    this.data = {};
    this.request = null;
  }

  fetchCached(url) {
    if (this.data[url]) {
      return Promise.resolve(this.data[url]);
    }

    if (this.request) {
      this.request.abort();
    }
    this.request = promisify(new XMLHttpRequest());
    this.request.responseType = 'json';
    this.request.open('GET', url);
    return this.request.send()
      .then(xhr => {
        if (xhr.status >= 200 && xhr.status < 400) {
          this.data[url] = xhr.response;
          return xhr.response;
        }
        throw Error(`RequestCache HTTP ${ xhr.status}`);
      });
  }
}

// Cache singleton
const requestCache = new RequestCache();

export default requestCache;

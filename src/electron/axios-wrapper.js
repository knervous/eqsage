import { SpireApi } from 'spire-api';

if (window.electronAPI) {
  let client = SpireApi.v1();
  const addHooks = () => {
    client.request = SpireApi.globalAxios.request = async function(config) {
      for (const handler of this.interceptors.request.handlers) {
        config = handler.fulfilled(config);
      }
      console.log('Hook req', config);

      try {
        const proxyResponse = await window.electronAPI.proxyFetch(config.url, {
          method : config.method.toUpperCase(),
          body   : config.data,
          headers: config.headers,
        });
        let data = await proxyResponse.text();
        try {
          data = JSON.parse(data);
        } catch {}
        // Return a response object that mimics Axios's response.
        const result = Promise.resolve({
          data,
          status    : 200,
          statusText: 'OK',
          headers   : {},
          config,
          request   : null,
        });
        if (SpireApi.v1() !== client) {
          client = SpireApi.v1();
          addHooks();
        }
        return result;
      } catch (error) {
        return Promise.reject(error);
      }
    };
  };
 
  addHooks();
  console.log('Spire i', SpireApi);
}
  
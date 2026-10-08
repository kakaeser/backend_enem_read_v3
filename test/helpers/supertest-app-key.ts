import request from 'supertest';

export const E2E_APP_API_KEY = 'e2e-test-key';

type HttpServer = Parameters<typeof request>[0];
type SupertestAgent = ReturnType<typeof request.agent>;

export function withAppKey<T extends { set(field: string, val: string): T }>(test: T): T {
  return test.set('X-App-Api-Key', E2E_APP_API_KEY);
}

function wrapAgent(agent: SupertestAgent): SupertestAgent {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head'] as const;
  for (const method of methods) {
    const original = agent[method].bind(agent);
    agent[method] = ((url: string) => withAppKey(original(url))) as SupertestAgent[typeof method];
  }
  return agent;
}

export function http(server: HttpServer) {
  const req = request(server);
  const chain = (method: 'get' | 'post' | 'put' | 'patch' | 'delete') => (url: string) =>
    withAppKey(req[method](url));
  return {
    get: chain('get'),
    post: chain('post'),
    put: chain('put'),
    patch: chain('patch'),
    delete: chain('delete'),
    agent: () => wrapAgent(request.agent(server)),
  };
}

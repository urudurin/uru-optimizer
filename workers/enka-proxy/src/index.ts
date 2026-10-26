import {
  type Env,
  handleRequest,
  type ProfileCache,
} from './proxy'

// Cloudflare Worker entry point, see proxy.ts for what it does and README.md for deploying it.
// caches.default is the Workers cache, shared by everyone using this worker in the same data center
declare const caches: { default: ProfileCache }

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, fetch, caches.default)
  },
}

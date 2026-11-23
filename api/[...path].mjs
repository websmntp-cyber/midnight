import { handleRequest } from "./_core.mjs";

export default {
  async fetch(req) {
    return handleRequest(req);
  }
};

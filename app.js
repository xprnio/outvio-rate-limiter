const express = require("express");

const { RateLimiter } = require("./lib/rate-limiter");

const defaultFunctions = {
  consumer(req) {
    return req.path;
  },
  period() {
    return Math.floor(Date.now() / 1000).toString(16);
  },
  nextPeriod() {
    return "1";
  },
};

/**
 * Creates an Express app that can be used for testing API quotas
 * @param {number} total The total quota
 * @param {number} cost The cost per call
 */
function createQuotaApp(total = 1, cost = 1) {
  const app = express();
  const limit = RateLimiter({
    fn: defaultFunctions,
    quotas: { default: { total, cost } },
  });

  app.get("/", limit.quota("default"), (req, res) =>
    res.status(200).send({ success: true })
  );

  return { app, total, cost };
}

module.exports = { createQuotaApp };
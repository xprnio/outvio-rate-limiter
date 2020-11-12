const express = require("express");

const { RateLimiter } = require("../lib/rate-limiter");

exports.create = async function (config) {
  const app = express();
  const rateLimiter = RateLimiter(config);

  // specifying the group name limits the requests by the group quota
  app.get("/quota", rateLimiter.quota("default"), (req, res) => {
    res.status(200).send({ success: true });
  });

  // specifying a cost along with the group name overrides the cost
  app.post("/quota", rateLimiter.quota("default", 2), (req, res) => {
    res.status(201).send({ success: true });
  });

  return app;
};

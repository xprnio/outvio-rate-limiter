const { set, merge } = require("lodash");

function RateLimiter({ fn, quotas }) {
  const quotaMap = new Map();

  return {
    /**
     * Quotas are high-level limits and should be
     * used as a hard-limit with a slower-changing window (relative to other rate limits).
     * Given a specific window for a quota group along with the consumer hash,
     * it should keep track of and limit the usage based on the quota.
     * @param {string} name The name of the quota (from the quotas configuration)
     * @param {number} cost The cost in points
     */
    quota(name, cost) {
      const group = merge({ total: 0 }, quotas[name]);

      if (cost >= 0) group.cost = cost;

      return (req, res, next) => {
        const hash = `${fn.period()}-${fn.consumer(req)}`;
        const quota = quotaMap.has(hash)
          ? quotaMap.get(hash)
          : (quotaMap.set(hash, {
              quota: group.total,
              remaining: group.total,
              nextPeriod: fn.nextPeriod(),
            }),
            quotaMap.get(hash));

        res.set("Request-Quota", quota.quota).set("Request-Cost", group.cost);

        if (quota.remaining >= group.cost) {
          set(quota, "remaining", quota.remaining - group.cost);
          quotaMap.set(hash, quota);

          res.set("Remaining", quota.remaining);
          next();
        } else {
          res
            .status(429)
            .set("Retry-After", quota.nextPeriod)
            .json({ message: "Too Many Requests" });
        }
      };
    },
    limit() {
      throw new Error("Not Implemented");
    },
  };
}

module.exports = { RateLimiter };

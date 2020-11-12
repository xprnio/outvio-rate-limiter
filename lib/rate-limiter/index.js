const { set, merge } = require("lodash");

exports.RateLimiter = function ({ fn, quotas }) {
  const quotaMap = new Map();

  return {
    quota(name, cost = 1) {
      const group = merge({ total: 0, cost }, quotas[name]);
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

        res.set("Request-Quota", quota.quota).set("Request-Cost", cost);

        if (quota.remaining >= cost) {
          set(quota, "remaining", quota.remaining - cost);
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

    // TODO: Implement rate limiting
    limit() {
      throw new Error("Not Implemented");
    },
  };
};

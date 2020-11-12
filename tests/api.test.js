const request = require("supertest");
const { create } = require("../app");

const sleep = (time = 1000) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), time);
  });

describe("Example API tests", () => {
  let app;

  const config = {
    fn: {
      // function for hashing the consumer
      // f(req) -> x
      consumer: (req) => req.path,

      // function for generating unique hashes for each quota period.
      // for testing purposes the periods are 1s
      // f() -> x
      period: () => Math.floor(Date.now() / 1000).toString(16),

      // function that describes the period hash by returning how many seconds
      // the consumer should wait before sending another request
      // f() -> x
      nextPeriod: () => "1",
    },

    // quotas grouped by name
    quotas: {
      // each group is an object containing a total and (optional) cost.
      // if cost is omitted, a cost of 1 is implied.
      default: { total: 5, cost: 1 },
    },
  };

  beforeEach(async () => {
    app = await create(config);
  });

  it(`should hit service with cost=1`, async () => {
    const res = await request(app).get(`/quota`);
    const { total, cost } = config.quotas.default;

    expect(res.status).toBe(200);

    expect(res.headers).toHaveProperty("request-quota", String(total));
    expect(res.headers).toHaveProperty("remaining", String(total - cost));
    expect(res.headers).toHaveProperty("request-cost", String(cost));

    expect(res.body).toHaveProperty("success", true);
  });

  it(`should hit hit service with cost=2`, async () => {
    const res = await request(app).post(`/quota`);
    const { total } = config.quotas.default;

    expect(res.status).toBe(201);

    expect(res.headers).toHaveProperty("request-quota", String(total));
    expect(res.headers).toHaveProperty("remaining", String(total - 2));
    expect(res.headers).toHaveProperty("request-cost", "2");

    expect(res.body).toHaveProperty("success", true);
  });

  it(`should fail when exceeding quota`, async () => {
    const { total, cost } = config.quotas.default;

    // use up all the quota we have
    for (let i = 0; i < total; i += cost) {
      const res = await request(app).get(`/quota`);
      expect(res.status).toBe(200);
      expect(res.headers).not.toHaveProperty("retry-after");
    }

    // after exceeding our quota, response should be 429 - Too Many Requests
    const res = await request(app).get("/quota");
    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty("retry-after");
  });

  it(`should hit service after quota is reset`, async () => {
    const { total, cost } = config.quotas.default;

    // use up all the quota we have
    for (let i = 0; i < total; i += cost) {
      const res = await request(app).get(`/quota`);
      expect(res.status).toBe(200);
      expect(res.headers).not.toHaveProperty("retry-after");
    }

    // get the retryAfter header
    const retryAfter = await (async () => {
      const res = await request(app).get("/quota");
      expect(res.status).toBe(429);
      expect(res.headers).toHaveProperty("retry-after");

      const retryAfter = +res.headers["retry-after"];
      expect(isNaN(retryAfter)).toBe(false);
      return retryAfter;
    })();

    await sleep(retryAfter * 1000);
    const res = await request(app).get("/quota");
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("request-quota", String(total));
    expect(res.headers).toHaveProperty("remaining", String(total - cost));
    expect(res.headers).toHaveProperty("request-cost", String(cost));
  });
});

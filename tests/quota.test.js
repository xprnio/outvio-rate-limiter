const express = require("express");
const request = require("supertest");

const { createQuotaApp } = require('../app');

describe("Quota API tests", () => {
  it(`should hit service with cost=1`, async () => {
    const { app } = createQuotaApp(10, 1);
    await callQuota(app, 10, 1);
  });

  it(`should hit hit service with cost=2`, async () => {
    const { app } = createQuotaApp(10, 2);
    await callQuota(app, 10, 2);
  });

  it(`should fail when exceeding quota`, async () => {
    const { app, total, cost } = createQuotaApp(10, 1);

    for (let remaining = total - cost; remaining >= 0; remaining -= cost) {
      await callQuota(app, total, cost, remaining);
    }

    await callQuotaExceeded(app);
  });

  it(`should hit service after quota is reset`, async () => {
    const { app, total, cost } = createQuotaApp(10, 1);

    for (let remaining = total - cost; remaining >= 0; remaining -= cost) {
      await callQuota(app, total, cost, remaining);
    }

    const retryAfter = await callQuotaExceeded(app);

    await sleep(retryAfter * 1000);
    await callQuota(app, total, cost);
  });
});

async function callQuota(app, total, cost, remaining) {
  const res = await request(app).get("/");

  expect(res.status).toBe(200);
  expect(res.headers).toHaveProperty("request-quota", String(total));
  expect(res.headers).toHaveProperty("request-cost", String(cost));
  if (remaining !== undefined)
    expect(res.headers).toHaveProperty("remaining", String(remaining));

  expect(res.body).toHaveProperty("success", true);
}

async function callQuotaExceeded(app) {
  const res = await request(app).get("/");

  expect(res.status).toBe(429);
  expect(res.headers).toHaveProperty("retry-after");

  return +res.headers["retry-after"];
}

function sleep(time = 1000) {
  return new Promise((resolve) => setTimeout(() => resolve(), time));
}

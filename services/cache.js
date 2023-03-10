const mongoose = require("mongoose");
const redis = require("redis");
const keys = require("../config/keys");
const client = redis.createClient(keys.redisUrl);
client.connect();
const exec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.cache = function (options = {}) {
  this.hashKey = JSON.stringify(options.key || " ");
  this.useCache = true;
  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );
  const cacheValue = await client.hGet(this.hashKey, key);
  if (cacheValue) {
    console.log("get from cash");
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map((d) => this.model(d))
      : new this.model(doc);
  }

  console.log("get from mongoose");

  const result = await exec.apply(this, arguments);
  client.hSet(this.hashKey, key, JSON.stringify(result), "EX", 10);
  return result;
};
module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};

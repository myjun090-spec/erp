import { MongoClient, type Db } from "mongodb";

type CachedMongoClient = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
  uri: string | null;
};

declare global {
  var __erpMongoClient__: CachedMongoClient | undefined;
}

function getMongoUri() {
  return process.env.MONGODB_URI?.trim() || process.env.MONGODB_URL?.trim() || "";
}

export function isMongoConfigured() {
  return getMongoUri().length > 0;
}

export function getMongoDbName() {
  const explicitDbName = process.env.MONGODB_DB_NAME?.trim();

  if (explicitDbName) {
    return explicitDbName;
  }

  const uri = getMongoUri();

  if (!uri) {
    return "erp";
  }

  try {
    const url = new URL(uri);
    const pathname = url.pathname.replace(/^\//, "");
    return pathname || "erp";
  } catch {
    return "erp";
  }
}

function getMongoCache() {
  if (!global.__erpMongoClient__) {
    global.__erpMongoClient__ = {
      client: null,
      promise: null,
      uri: null,
    };
  }

  return global.__erpMongoClient__;
}

export async function getMongoClient() {
  const uri = getMongoUri();

  if (!uri) {
    throw new Error("MONGODB_URI or MONGODB_URL is not configured.");
  }

  const cache = getMongoCache();

  if (cache.client && cache.uri === uri) {
    return cache.client;
  }

  if (!cache.promise || cache.uri !== uri) {
    cache.uri = uri;
    cache.promise = new MongoClient(uri).connect();
  }

  cache.client = await cache.promise;
  return cache.client;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}

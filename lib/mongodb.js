import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const RETRYABLE_MONGO_PATTERNS = [
  'marked stale due to electionId/setVersion mismatch',
  'ReplicaSetNoPrimary',
  'no primary server available',
  'server selection timed out',
  'connection <monitor> to',
  'socket exception',
  'ECONNRESET',
  'ECONNREFUSED'
];

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

function isRetryableMongoError(error) {
  const message = (error?.message || '').toLowerCase();
  return RETRYABLE_MONGO_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(uri, options) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const mongoConnection = await mongoose.connect(uri, options);
      const dbName = mongoConnection?.connection?.db?.databaseName || mongoConnection?.connection?.name || 'unknown';
      console.log(`✓ MongoDB connected successfully (db: ${dbName})`);
      return mongoConnection;
    } catch (error) {
      lastError = error;
      console.error(`✗ MongoDB connection error (attempt ${attempt}/${maxAttempts}):`, error.message);

      if (!isRetryableMongoError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(attempt * 750);
    }
  }

  throw lastError;
}

async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable in .env");
  }

  const readyState = mongoose.connection.readyState;

  if (cached.conn && readyState === 1) {
    return cached.conn;
  }

  if (readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (readyState === 2 && cached.promise) {
    cached.conn = await cached.promise;
    return cached.conn;
  }

  if (readyState === 3) {
    cached.conn = null;
    cached.promise = null;
  }
  
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 5,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      waitQueueTimeoutMS: 10000,
      autoIndex: false,
    };
    
    cached.promise = connectWithRetry(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        cached.conn = mongooseInstance;
        return mongooseInstance;
      })
      .catch((error) => {
        cached.conn = null;
        cached.promise = null;
        throw error;
      });
  }
  
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

export default dbConnect;

import { MongoClient } from 'mongodb';
import 'dotenv/config';
const connectionString = process.env.ATLAS_URI || "";
const client = new MongoClient(connectionString);

let conn;

try{
  conn = await client.connect(); // Connect to MongoDB
  console.log("Connected to MongoDB");
}
catch (e){
  console.error(e);
}

const db = await conn.db("sample_training");

export default db
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

const grades = db.collection("grades");

// single field index on class_id
grades.createIndex({class_id: 1})

// single field index on learner_id
grades.createIndex({learner_id: 1})

// compound index on class_id and learner_id
grades.createIndex({class_id: 1, learner_id: 1})


export default db
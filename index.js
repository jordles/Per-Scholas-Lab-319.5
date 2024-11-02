import express from 'express';
import 'dotenv/config';
import db from './db/conn.mjs'
import grades from './routes/grades.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/grades", grades);

async () => { //this validation doesn't work on nodejs driver but it works in mongodb compass
  await db.command({
    collMod: "grades",
    // Pass the validator object
    validator: {
      $jsonSchema: {
        bsonType: "object",
        title: "Learner Validation",
        required: ["learner_id", "class_id"],
        properties: {
          learner_id: {
            bsonType: "int",
            minimum: 0,
            description: "must be an integer greater than or equal to 0 and is required",
          },
          class_id: {
            bsonType: "int",
            minimum: 0,
            maximum: 300,
            description: "must be an integer between 0 and 300 and is required",
          }
        },
      },
    },
    validationAction: "warn",
  });
};


app.get("/", async (req, res) => {
  let collection = db.collection("grades");
  let newDocument = {
    learner_id: 1,
    class_id: 301,
  }
  let result = await collection.insertOne(newDocument).catch( e => {
    return e.errInfo.details.schemaRulesNotSatisfied;
  });
  res.send(result).status(204);
  // res.send("Welcome to the API.");
});

// Global error handling
app.use((err, _req, res, next) => {
  console.error(err);
  res.status(500).send("Seems like we messed up somewhere...");
});

app.listen(PORT, () => {
  console.log(`Server is running on port: http://localhost:${PORT}.`)
})
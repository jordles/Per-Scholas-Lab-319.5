import express from 'express';
import 'dotenv/config';
import grades from './routes/grades.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/grades", grades);


app.get("/", (req, res) => {
  res.send("Welcome to the API.");
});

// Global error handling
app.use((err, _req, res, next) => {
  console.error(err);
  res.status(500).send("Seems like we messed up somewhere...");
});

app.listen(PORT, () => {
  console.log(`Server is running on port: http://localhost:${PORT}.`)
})
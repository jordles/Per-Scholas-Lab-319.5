import express from 'express';
import db from '../db/conn.mjs'
import { ObjectId } from 'mongodb';

const router = express.Router()
// base path: /grades


// Backwards compatibility or students/learners
router.get("/student/:id", (req, res) => {
  res.redirect(`../learner/${req.params.id}`)
})

// Get a student's grade data
router.get('/learner/:id', async (req, res, next) => {
  try {
    let collection = db.collection("grades")
    let query = { learner_id: Number(req.params.id) }

    if (req.query.class) {
      query.class_id = Number(req.query.class)
    }

    let result = await collection.find(query).toArray()

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Get a class's grade data
router.get('/class/:id', async (req, res, next) => {
  try {
    let collection = db.collection("grades")
    let query = { class_id: Number(req.params.id) }

    if (req.query.learner) {
      query.learner_id = Number(req.query.learner)
    }

    let result = await collection.find(query).toArray()

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// get learner average for EACH class
router.get("/learner/:id/class/average", async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let query = { learner_id: Number(req.params.id)}
    let learnerGrades = await collection.find(query).toArray()

    const averages = learnerGrades.reduce((acc, grade) => {
      let sum = 0;
      for (let i = 0; i < grade.scores.length; i++) {
        if (typeof grade.scores[i].score === 'number') {
          sum += grade.scores[i].score        }
      }
      acc[grade.class_id] = sum / grade.scores.length
      return acc
    }, {})

    res.send(averages).status(200)

  } catch (err) {
    next(err)
  }
})



// to get overall average of a learner
router.get("/learner/:id/average", async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let query = { learner_id: Number(req.params.id)}
    let learnerGrades = await collection.find(query).toArray()
    let sum = 0;
    let scoreCount = 0
    for (let i = 0; i < learnerGrades.length; i++) {
      for (let j = 0; j < learnerGrades[i].scores.length; j++) {
        if (typeof learnerGrades[i].scores[j].score === 'number') {
          sum += learnerGrades[i].scores[j].score
        }
        scoreCount++
      }
    }

    const overallScore = sum / scoreCount

    res.send("Over average: " + overallScore).status(200)
  } catch (err) {
    next(err)
  }
})

// Create a GET route at /grades/stats
// Within this route, create an aggregation pipeline that returns the following information:
// The number of learners with a weighted average (as calculated by the existing routes) higher than 70%.
// The total number of learners.
// The percentage of learners with an average above 70% (a ratio of the above two outputs).

router.get('/stats', async (req, res, next) => {
  try{
    let collection = db.collection("grades");
    let [result] = await collection.aggregate([
      {
        '$unwind': {
          'path': '$scores'
        }
      }, 
      {
        '$group': {
          '_id': '$learner_id', 
          'quiz': {
            '$push': {
              '$cond': [
                {
                  '$eq': [
                    '$scores.type', 'quiz'
                  ]
                }, '$scores.score', '$$REMOVE'
              ]
            }
          }, 
          'exam': {
            '$push': {
              '$cond': [
                {
                  '$eq': [
                    '$scores.type', 'exam'
                  ]
                }, '$scores.score', '$$REMOVE'
              ]
            }
          }, 
          'homework': {
            '$push': {
              '$cond': [
                {
                  '$eq': [
                    '$scores.type', 'homework'
                  ]
                }, '$scores.score', '$$REMOVE'
              ]
            }
          }
        }
      }, {
        '$project': {
          '_id': 0, 
          'learner_id': '$_id', 
          'avg': {
            '$sum': [
              {
                '$multiply': [
                  {
                    '$avg': '$exam'
                  }, 0.5
                ]
              }, {
                '$multiply': [
                  {
                    '$avg': '$quiz'
                  }, 0.3
                ]
              }, {
                '$multiply': [
                  {
                    '$avg': '$homework'
                  }, 0.2
                ]
              }
            ]
          }
        }
      }, {
        '$group': {
          '_id': null, 
          'learnersAbove50': {
            '$sum': {
              '$cond': {
                'if': {
                  '$gt': [
                    '$avg', 50
                  ]
                }, 
                'then': 1, 
                'else': 0
              }
            }
          }, 
          'totalLearners': {
            '$sum': 1
          }
        }
      }, {
        '$project': {
          '_id': 0, 
          'learnersAbove50': 1, 
          'totalLearners': 1, 
          'percentageAbove50': {
            '$cond': {
              'if': {
                '$eq': [
                  '$sum', 0
                ]
              }, 
              'then': 0, 
              'else': {
                '$multiply': [
                  {
                    '$divide': [
                      '$learnersAbove50', '$totalLearners'
                    ]
                  }, 100
                ]
              }
            }
          }
        }
      }
    ]).toArray();
    console.log(result)
    if(!result) res.send("Not Found").status(404)
    else res.json(result).status(200)
  }
  catch(err){
    next(err);
  }
})

router.get('/stats/:id', async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let [result] = await collection.aggregate([
      {
        '$match': {
          'class_id': Number(req.params.id)
        }
      },
      {
        '$unwind': {
          'path': '$scores'
        }
      },
      {
        '$group': {
          '_id': '$learner_id',
          'class_id': { '$first': '$class_id' },  // Preserve class_id
          'quiz': {
            '$push': {
              '$cond': [
                { '$eq': ['$scores.type', 'quiz'] },
                '$scores.score',
                '$$REMOVE'
              ]
            }
          },
          'exam': {
            '$push': {
              '$cond': [
                { '$eq': ['$scores.type', 'exam'] },
                '$scores.score',
                '$$REMOVE'
              ]
            }
          },
          'homework': {
            '$push': {
              '$cond': [
                { '$eq': ['$scores.type', 'homework'] },
                '$scores.score',
                '$$REMOVE'
              ]
            }
          }
        }
      },
      {
        '$project': {
          '_id': 0,
          'learner_id': '$_id',
          'class_id': 1, // Keep class_id in projection
          'avg': {
            '$sum': [
              { '$multiply': [{ '$avg': '$exam' }, 0.5] },
              { '$multiply': [{ '$avg': '$quiz' }, 0.3] },
              { '$multiply': [{ '$avg': '$homework' }, 0.2] }
            ]
          }
        }
      },
      {
        '$group': {
          '_id': '$class_id',
          'classId': { '$first': '$class_id' },  // Preserve class_id in grouping
          'learnersAbove50': {
            '$sum': {
              '$cond': {
                'if': { '$gt': ['$avg', 50] },
                'then': 1,
                'else': 0
              }
            }
          },
          'totalLearners': { '$sum': 1 }
        }
      },
      {
        '$project': {
          '_id': 0,
          'classId': 1, // Include class_id in final output
          'learnersAbove50': 1,
          'totalLearners': 1,
          'percentageAbove50': {
            '$cond': {
              'if': { '$eq': ['$totalLearners', 0] },
              'then': 0,
              'else': {
                '$multiply': [
                  { '$divide': ['$learnersAbove50', '$totalLearners'] },
                  100
                ]
              }
            }
          }
        }
      }
    ]).toArray();

    console.log(result);
    if (!result) res.status(404).send("Not Found");
    else res.status(200).json(result);
  }
  catch (err) {
    next(err);
  }
});


// Get a single grade entry
router.get('/:id', async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    const query = { _id: ObjectId.createFromHexString(req.params.id) }
    let result = await collection.findOne(query);

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err) // the next function directs the err to the global error handling middleware
  }
})

// Create a single grade entry
router.post('/', async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let newDocument = req.body

    if (newDocument.student_id) {
      newDocument.learner_id = newDocument.student_id;
      delete newDocument.student_id
    }

    let result = await collection.insertOne(newDocument)
    res.send(result).status(201)
  } catch (err) {
    next(err)
  }
})


// Add a score to a grade entry
router.patch('/:id/add', async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let query = { _id: ObjectId.createFromHexString(req.params.id) }

    let result = await collection.updateOne(query, {
      $push: { scores: req.body }
    })

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Remove a score from a grade entry
router.patch('/:id/remove', async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let query = { _id: ObjectId.createFromHexString(req.params.id) }

    let result = await collection.updateOne(query, {
      $pull: { scores: req.body }
    })

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Extra Route to combine the two above Add/Remove
// router.patch('/:id/:operation', async (req, res, next) => {
//   try {
//     let collection = db.collection("grades");
//     let query = { _id: ObjectId.createFromHexString(req.params.id) }
//     let update = {};

//     if (req.params.operation === "add") {
//       update["$push"] = { scores: req.body }
//     } else if (req.params.operation === "remove") {
//       update["$pull"] = { scores: req.body }
//     } else {
//       res.status(400).send("Invalid Operation")
//       return
//     }

//     let result = await collection.updateOne(query, update)

//     if (!result) res.send("Not Found").status(404)
//     else res.send(result).status(200)
//   } catch (err) {
//     next(err)
//   }
// // })

router.patch("/class/:id", async (req, res, next) => {
  try {
    let collection = db.collection("grades")
    let query = { class_id: Number(req.params.id)}

    let result = await collection.updateMany(query, {
      $set: {class_id: req.body.class_id}
    })

    if (!result) res.send("Not found").status(404);
    else res.send(result).status(200);
  } catch (err) {
    next(err)
  }
})




router.delete("/:id", async (req, res, next) => {
  try {
    let collection = db.collection("grades");
    let query = { _id: ObjectId.createFromHexString(req.params.id) }
    let result = await collection.deleteOne(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})
// Delete a learner's grade entries
router.delete("/learner/:id", async (req, res, next) => {
  try {
    let collection = db.collection("grades")
    let query = { learner_id: Number(req.params.id)}

    let result = await collection.deleteMany(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Delete a class's grade entries
router.delete("/class/:id", async (req, res, next) => {
  try {
    let collection = db.collection("grades")
    let query = { class_id: Number(req.params.id)}

    let result = await collection.deleteMany(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})



export default router
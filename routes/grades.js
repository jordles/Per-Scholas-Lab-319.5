import express from 'express';
//import db from '../db/conn.mjs' // not using mongodb
//import { ObjectId } from 'mongodb'; no longer using mongodb
import Grades from '../models/grades.mjs'
const router = express.Router()
// base path: /grades


// Backwards compatibility or students/learners
router.get("/student/:id", (req, res) => {
  res.redirect(`../learner/${req.params.id}`)
})

// Get a student's grade data
router.get('/learner/:id', async (req, res, next) => {
  try {
    let query = { learner_id: req.params.id }
    if (req.query.class) {
      query.class_id = req.query.class
    }

    const result = await Grades.find(query);

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Get a class's grade data
router.get('/class/:id', async (req, res, next) => {
  try {
    let query = { class_id: req.params.id}

    if (req.query.learner) {
      query.learner_id = req.query.learner
    }

    let result = await Grades.find(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

router.get("/learner/:id/class/average", async (req, res, next) => {
  try{
    let query = { learner_id: Number(req.params.id)};
  
    const result = await Grades.aggregate([
      { $match: query }, // Filters documents by learner_id
      { $unwind: "$scores" }, // Decomposes the scores array into individual documents
      { 
        $group: { 
          _id: "$class_id", // Groups by class_id
          average: { $avg: "$scores.score" } // Calculates the average score per class
        } 
      },
      { 
        $project: { 
          _id: 0, // Excludes _id from the output
          class_id: "$_id", // Renames _id to class_id for clarity
          average: 1 // Includes the calculated average field
        }
      }
    ]);
    if(!result) res.send("Not found").status(404);
    else res.send(result).status(200);
  }
  catch(err){
    next(err);
  }
})



// to get overall average of a learner
router.get("/learner/:id/average", async (req, res, next) => {
  try {
    const result = await Grades.aggregate([
      { 
        $match: { learner_id: Number(req.params.id) } // Filters documents by learner_id 
      },
      { 
        $unwind: "$scores" // Breaks down scores array to individual scores for averaging
      },
      { 
        $group: {
          _id: "$learner_id", // Groups by learner_id
          overallAverage: { $avg: "$scores.score" } // Calculates average score across all entries
        }
      },
      { 
        $project: { 
          _id: 0, 
          learner_id: "$_id", 
          overallAverage: 1 
        } 
      }
    ]);

    if (!result) res.status(404).send("Not found");
    else res.status(200).send("Overall average: " + result[0].overallAverage);
    
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
    let [result] = await Grades.aggregate([
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
    ]);
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
    let [result] = await Grades.aggregate([
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
    ]);

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
    const query = { _id: req.params.id }
    let result = await Grades.findOne(query);

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err) // the next function directs the err to the global error handling middleware
  }
})

// Create a single grade entry
router.post('/', async (req, res, next) => {
  try {
    let newDocument = req.body

    if (newDocument.student_id) {
      newDocument.learner_id = newDocument.student_id;
      delete newDocument.student_id
    }
    
    let result = await Grades.create(newDocument)
    res.send(result).status(201)
  } catch (err) {
    next(err)
  }
})

// Add a score to a grade entry
router.patch('/:id/add', async (req, res, next) => {
  try {
    let query = { _id: req.params.id }

    // let result = await Grades.updateOne(query, {
    //   $push: { scores: req.body }
    // })
    let result = await Grades.findByIdAndUpdate(req.params.id, req.body, {new: true})

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Remove a score from a grade entry
router.patch('/:id/remove', async (req, res, next) => {
  try {
    let query = { _id: req.params.id }

    let result = await Grades.updateOne(query, {
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

// router.patch("/class/:id", async (req, res, next) => {
//   try {
//     let collection = db.collection("grades")
//     let query = { class_id: Number(req.params.id)}

//     let result = await collection.updateMany(query, {
//       $set: {class_id: req.body.class_id}
//     })

//     if (!result) res.send("Not found").status(404);
//     else res.send(result).status(200);
//   } catch (err) {
//     next(err)
//   }
// })




router.delete("/:id", async (req, res, next) => {
  try {
    let query = { _id: req.params.id }
    let result = await Grades.deleteOne(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Delete a learner's grade entries
router.delete("/learner/:id", async (req, res, next) => {
  try {
    let query = { learner_id: req.params.id}

    let result = await Grades.deleteMany(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})

// Delete a class's grade entries
router.delete("/class/:id", async (req, res, next) => {
  try {
    let query = { class_id: req.params.id}

    let result = await Grades.deleteMany(query)

    if (!result) res.send("Not Found").status(404)
    else res.send(result).status(200)
  } catch (err) {
    next(err)
  }
})



export default router
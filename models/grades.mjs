import mongoose from "mongoose";

const gradesSchema = new mongoose.Schema({
  learner_id: {
    type: Number,
    min: 0,
    message: "must be an integer greater than or equal to 0 and is required",
    required: true
  },
  class_id: {
    type: Number,
    min: 0,
    max: 300,
    message: "must be an integer between 0 and 300 and is required",
    required: true
  },
  scores: [ //mongoose gives its own _id field for arrays
    {
      type: { 
        type: String,
        enum: ['exam', 'homework', 'quiz'] 
      },
      score: Number,
    },
  ],
}, { versionKey: false }) // Disables the __v field ;


// single field index on class_id
gradesSchema.index({class_id: 1})

// single field index on learner_id
gradesSchema.index({learner_id: 1})

// compound index on class_id and learner_id
gradesSchema.index({class_id: 1, learner_id: 1})


export default mongoose.model("Grades", gradesSchema); //export a model called Grades
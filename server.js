import dotenv from "dotenv"
import express from "express"
import bodyParser from "body-parser"
import mongoose from "mongoose"
import cors from "cors"

const app = express()
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors())
dotenv.config()
app.set('view engine', 'ejs')
app.use(express.static("public"));

function arraysAreEqual(array1, array2) {
    if (array1.length !== array2.length) {
        return false;
    }
    return array1.every((value, index) => value === array2[index]);
}

mongoose.connect(process.env.URI).then(() => {
    console.log("Connected to the database.")
});

const questionSchema = new mongoose.Schema({
    question:String,
    answer:[String]
})
const attemptSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true
    },
    questionIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    currentQuestionIndex: {
        type: Number,
        default: 0
    },
    score: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    attemptNo:{
        type: Number,
        default:0
    }
});
const userSchema = new mongoose.Schema({
    name: String
})

const Question = mongoose.model('Question',questionSchema)
const Attempt = mongoose.model('Attempt', attemptSchema);
const User = mongoose.model('User',userSchema)


app.post('/create', async (req, res) => {
    const { question, answer } = req.body;
    const answers = answer.split(','); // split the string into an array of answers
    const newQuestion = new Question({
        question: question,
        answer: answers
    });
    try {
        await newQuestion.save();
        res.status(201).json(newQuestion);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.get("/",(req,res)=>{
    res.render('home')
})
app.post('/start', async (req, res) => {
    const name  = req.body.name;
    const questions = await Question.aggregate([{ $sample: { size: 5 } }]);
    const questionIds = questions.map(question => question._id);
    const existingAttempt = await Attempt.findOne({ userName: name }).sort({ attemptNo: -1 });
    const attemptNo = existingAttempt ? existingAttempt.attemptNo + 1 : 1;
    const attempt = new Attempt({ userName: name, questionIds, attemptNo });
    await attempt.save();
    res.redirect(`/submit?name=${name}`)
});
app.get('/submit', async (req, res) => {
    const name = req.query.name;
    const attempt = await Attempt.findOne({ userName:name, isActive: true });
    if (!attempt) {
        return res.status(400).json({ message: 'No active attempt found for this user' });
    }
    const question = await Question.findById(attempt.questionIds[attempt.currentQuestionIndex]);
    res.render('quiz', { question,name });
});

app.post('/submit', async (req, res) => {
    const { name, answer } = req.body;
    const attempt = await Attempt.findOne({ userName:name, isActive: true })
    if (!attempt) {
        return res.status(400).json({ message: 'No active attempt found for this user' });
    }
    const question = await Question.findById(attempt.questionIds[attempt.currentQuestionIndex]);
    if (arraysAreEqual(question.answer, answer)) {
        attempt.score += 1;
    }
    attempt.currentQuestionIndex += 1;
    if (attempt.currentQuestionIndex === attempt.questionIds.length) {
        attempt.isActive = false;
        await attempt.save();
        res.render('final',{name,score:attempt.score})
    } else {
        await attempt.save();
        const nextQuestion = await Question.findById(attempt.questionIds[attempt.currentQuestionIndex]);
        res.render('quiz',{question:nextQuestion,name})
    }
});


app.listen(3000,()=>{
    console.log("Alright let's go.")
})
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
function question_addition(set) {
    if(set==="dva")
        return Dev
    if(set==="clf")
        return Practitioner
}
async function questions_selection(set,number) {
    let x;
    if (set === "dva") {
        x = await Dev.aggregate([{$sample: {size: parseInt(number)}}]);
    }
    if(set === "clf") {
        x = await Practitioner.aggregate([{$sample: {size: parseInt(number)}}])
    }
    return x;
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
    set: {
        type:String,
        required: true
    },
    questionIds: [{
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'set'
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

const Dev = mongoose.model('Dev',questionSchema)
const Attempt = mongoose.model('Attempt', attemptSchema);
const Practitioner = mongoose.model('Practitioner',questionSchema)


app.post('/create', async (req, res) => {
    const { question, answer, set } = req.body;
    const answers = answer.split(','); // split the string into an array of answers
    let x = question_addition(set)
    const newQuestion = new x({
        question: question,
        answer: answers
    })
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
    const set = req.body.set;
    const total = req.body.total;
    const questions = await questions_selection(set,total)
    const questionIds = questions.map(question => question._id);
    const existingAttempt = await Attempt.findOne({ userName: name,set:set }).sort({ attemptNo: -1 });
    const attemptNo = existingAttempt ? existingAttempt.attemptNo + 1 : 1;
    const attempt = new Attempt({ userName: name, set:set,questionIds, attemptNo });
    await attempt.save();
    res.redirect(`/submit?name=${name}&set=${set}`)
});
app.get('/submit', async (req, res) => {
    let {name,set} = req.query;
    let x=question_addition(set)
    const attempt = await Attempt.findOne({ userName:name, set:set, isActive: true });
    if (!attempt) {
        return res.status(400).json({ message: 'No active attempt found for this user' });
    }
    const question = await x.findById(attempt.questionIds[attempt.currentQuestionIndex]);
    res.render('quiz', { question,name,set });
});

app.post('/submit', async (req, res) => {
    const { name, answer,set } = req.body;
    let x = question_addition(set)
    const attempt = await Attempt.findOne({ userName:name, set:set, isActive: true })
    if (!attempt) {
        return res.status(400).json({ message: 'No active attempt found for this user' });
    }
    const question = await x.findById(attempt.questionIds[attempt.currentQuestionIndex]);
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
        const nextQuestion = await x.findById(attempt.questionIds[attempt.currentQuestionIndex]);
        res.render('quiz',{question:nextQuestion,name,set})
    }
});


app.listen(3000,()=>{
    console.log("Alright let's go.")
})
// const mongoose = require('mongoose');

// mongoose.connect('mongodb://localhost/noderest', {});
// mongoose.Promise = global.Promisse;

// module.exports = mongoose;

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost:27017/noderest", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
});

module.exports = mongoose;
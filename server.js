// http://101.78.220.133:8099/22.316109/114.180459
// http://101.78.220.133:8099/?lat=22.316109&lon=114.180459&zoom=18

var express = require('express');
var fileUpload = require('express-fileupload');
var app = express();
var session = require('cookie-session');
var bodyParser = require('body-parser'); //for POST method handling


var MongoClient = require('mongodb').MongoClient; 
var ObjectID = require('mongodb').ObjectID;
var assert = require('assert');
var mongourl = "mongodb://user01:user01@ds139964.mlab.com:39964/381db";


// var restaurants = [
// ];

var SECRETKEY1 = 'COMPS381F';
var SECRETKEY2 = 'SUEN - OUHK 2017-2018';

// var users = new Array(
// 	{name: 'demo', password: 'demo'},
// 	{name: 'demo2', password: 'demo2'}
// );

app.set('view engine', 'ejs');

app.use(session({
	name: 'session',
	keys: [SECRETKEY1,SECRETKEY2]
  }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(fileUpload());


app.get('/api/restaurant/read/:inTitle/:inValue', function (req, res) {
	//res.send(req.params);
	api_read_handle(req,res);
});

app.post("/api/restaurant/create", function(req,res) {
	//console.log('/new post body: ' + JSON.stringify(req.body));
	api_create_handle(req,res);
});

app.get("/", function(req,res) {
	console.log(req.session);
	//if (!req.session.authenticated) res.redirect('/login');
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else res.redirect('/read'); //success
});

app.get('/login',function(req,res) {
	//res.sendFile(__dirname + '/public/login.html');
	res.render("login", {});
});

app.post('/login',function(req,res) {
	console.log('/login (POST)');
	if (req.body.way == 1) {
		console.log('/login login (POST)');
		regist_read_handle(req,res,{},0);
	} else if (req.body.way == 2) {
		console.log('/login registration (POST)');
		regist_create_handle(req,res);
	} else {
		res.render('login', {
			msg: 'ERROR: Unknown POST method'
		});
		res.end();
	}
});

// login checker
app.use(function(req,res,next){
	if (!req.session.authenticated) {
		// res.redirect('/login');
		res.render("login", {});
		res.end();
	} else next();
});

app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});

app.get("/read", function(req,res) {
	//var max = (queryAsObject.max) ? Number(queryAsObject.max) : 20;
	console.log('/read');			
	main_read_handle(req,res,{},0);
});

app.get("/display", function(req,res) {
	console.log('/display _id: ' + req.query._id);			
	display_read_handle(req,res,{},0);
});

app.get("/new", function(req,res) {	
	console.log('/new');		
	res.render("new", {
		userid:req.session.username, //User ID
	});
});

app.post("/new", function(req,res) {
	console.log('/new post body: ' + JSON.stringify(req.body));
	
	new_create_handle(req,res);

	//res.end();
});

app.get("/change", function(req,res) {
	console.log('/change _id: ' + req.query._id);			
	change_read_handle(req,res,{},0);
});

app.post("/change", function(req,res) {
	console.log('/change _id: ' + req.body._id);
	console.log('/change post body: ' + JSON.stringify(req.body));
	
	if (req.body.owner==req.session.username) {
		change_update_handle(req,res);
	} else {
		res.render('message', {
			msgTitle: 'ERROR',
			msg: 'This is not your restaurant.'
		});
		res.end();
	}
	
	
	//res.end();
});

app.get("/remove", function(req,res) {
	console.log('/remove _id: ' + req.query._id);
	var criteria = {};
	criteria['_id'] = ObjectID(req.query._id);
	//criteria['owner'] = 'demo';
	//ADD CHECKING FOR USER HERE (owner=user)
	console.log('/remove criteria : ' + JSON.stringify(criteria));			
	remove_delete_handle(req,res,criteria); 
});

app.post("/rate", function(req,res) {
	console.log('/rate _id: ' + req.body._id);
	console.log('/rate score: ' + req.body.score);
	rate_update_handle(req,res);
});

app.get("/search", function(req,res) {
	console.log('/search (GET)');
	search_get_handle(req,res);
	//res.end();
});

app.post("/search", function(req,res) {
	console.log('/search (POST) body: ' + JSON.stringify(req.body));
	search_post_handle(req,res)
	//res.end();
});

app.get("/map", function(req,res) {
	console.log('/map');
	if (req.query._id&&req.query.name&&req.query.lat&&req.query.lon) {
		res.render("gmap", {
			_id:req.query._id,
			name:req.query.name,
			lat:req.query.lat,
			lon:req.query.lon,
			zoom:req.query.zoom?req.query.zoom:3
		});
	} else {
		res.render('message', {
			msgTitle: 'ERROR',
			msg: 'ID/lat/lon not found or missing.'
		});
	}
	res.end();
});

//curl -X GET ouhk-381-project.mybluemix.net/api/restaurant/read/name/123 
function api_read_handle(req,res) {
	if (req.params.inTitle == 'name' || req.params.inTitle == 'borough' || req.params.inTitle == 'cuisine'){
		
		var criteria = {};
		criteria[req.params.inTitle] = req.params.inValue;
		console.log('criteria: ' + JSON.stringify(criteria));
	
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err,null);
			console.log('Connected to MongoDB\n');
			findRestaurants(db,criteria,0,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');

				console.log('restaurants.length: ' + restaurants.length);
				
				(restaurants.length>0) ? res.send(restaurants) : res.send({});
				res.end();
			}); 
		});
	} else {
		res.send({});
		res.end();
	}
}

//curl -H "Content-Type: application/json" -X POST -d '{"name":"curltesting", "owner":"curltesting"}' ouhk-381-project.mybluemix.net/api/restaurant/create
function api_create_handle(req,res) {
	var obj = req.body;
	if (obj.name && obj.owner){
		
		var new_r = {};	// document to be inserted
		new_r['restaurant_id'] = Number(new Date());
		new_r['name'] = (obj.name) ? obj.name : 'Unknown';
		new_r['borough'] = (obj.borough) ? obj.borough : '';
		new_r['cuisine'] = (obj.cuisine) ? obj.cuisine : '';
	
		var address = {};
		address['building'] = (obj.building) ? obj.building : '';
		address['street'] = (obj.street) ? obj.street : '';
		address['zipcode'] = (obj.zipcode) ? obj.zipcode : '';
		address['coord'] = [2];
		address['coord'][0] = (obj.lon) ? obj.lon : '';
		address['coord'][1] = (obj.lat) ? obj.lat : '';
		new_r['address'] = address;
	
		new_r['grades'] = [];
		new_r['owner'] = (obj.owner) ? obj.owner : 'Unknown';
	
		new_r['photo'] = '';
		new_r['mimetype'] = '';
		try {
			new_r['photo'] = new Buffer(req.files.upload.data).toString('base64');
			new_r['mimetype'] = req.files.upload.mimetype;
			console.log('\n File mimetype: ' + new_r['mimetype']);
		} catch (err) {
			console.log('\n No file to upload.');
		}
		
		MongoClient.connect(mongourl,function(err,db) {
			assert.equal(err,null);
			console.log('Connected to MongoDB\n');
			insertRestaurant(db,new_r,function(result) {
				
				console.log(JSON.stringify(result));
				var rMsg = JSON.parse(result);
				if (rMsg.n>0) {
					// insert success
					findRestaurants(db,{},0,function(restaurants) {
						db.close();
						console.log('Disconnected MongoDB\n');
		
						console.log('restaurants.length: ' + restaurants.length);
						
						res.send({
							'status': 'ok',
							'_id': restaurants[0]._id
						});
						res.end();
					}); 
					
				} else {
					// insert error
					db.close();
					res.send({'status': 'failed'});
					res.end();
				}
				
				
			});
		});

	} else {
		res.send({'status': 'failed'});
		res.end();
	}
}

function main_read_handle(req,res,criteria,max) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findRestaurants(db,criteria,max,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');

			console.log('restaurants.length: ' + restaurants.length);
			res.render("main", {
				userid:req.session.username, //User ID
				r:restaurants
			});
			res.end();
		}); 
	});
}

function display_read_handle(req,res,criteria,max) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findRestaurants(db,criteria,max,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');

			//console.log('restaurants.length: ' + restaurants.length);
			if (req.query._id != null) {
				for (var i=0; i<restaurants.length; i++) {
					if (restaurants[i]._id == req.query._id) {
						res.render('display', {
							userid:req.session.username, //User ID
							r: restaurants[i]
						});
						return; //end
					}
				}
			}
			res.render('message', {
				msgTitle: 'ERROR',
				msg: 'ID not found or missing.'
			});
			res.end();
		}); 
	});
}

function new_create_handle(req,res) {
	var obj = req.body;
	var new_r = {};	// document to be inserted
	//if (obj.id) new_r['id'] = obj.id;
	new_r['restaurant_id'] = Number(new Date());
	new_r['name'] = (obj.name) ? obj.name : 'Unknown';
	new_r['borough'] = (obj.borough) ? obj.borough : '';
	new_r['cuisine'] = (obj.cuisine) ? obj.cuisine : '';

	var address = {};
	address['building'] = (obj.building) ? obj.building : '';
	address['street'] = (obj.street) ? obj.street : '';
	address['zipcode'] = (obj.zipcode) ? obj.zipcode : '';
	address['coord'] = [2];
	address['coord'][0] = (obj.lon) ? obj.lon : '';
	address['coord'][1] = (obj.lat) ? obj.lat : '';
	new_r['address'] = address;

	new_r['grades'] = [];
	new_r['owner'] = (obj.owner) ? obj.owner : 'Unknown';

	new_r['photo'] = '';
	new_r['mimetype'] = '';
	try {
		new_r['photo'] = new Buffer(req.files.upload.data).toString('base64');
		new_r['mimetype'] = req.files.upload.mimetype;
		console.log('\n File mimetype: ' + new_r['mimetype']);
	} catch (err) {
		console.log('\n No file to upload.');
	}

	//console.log('About to insert: ' + JSON.stringify(new_r));
	
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		insertRestaurant(db,new_r,function(result) {
			db.close();
			console.log(JSON.stringify(result));

			res.render('message', {
				msgTitle: 'SUCCESS',
				msg: 'New restaurant record ('+new_r['name']+') added.'
			});
			res.end();
			return;		
		});
	});
}


function change_read_handle(req,res,criteria,max) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findRestaurants(db,criteria,max,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');

			//console.log('restaurants.length: ' + restaurants.length);
			if (req.query._id != null) {
				for (var i=0; i<restaurants.length; i++) {
					if (restaurants[i]._id == req.query._id) {
						res.render('change', {
							userid:req.session.username, //User ID
							r: restaurants[i]
						});
						res.end();
						return; //end
					}
				}
			}
			res.render('message', {
				msgTitle: 'ERROR',
				msg: 'ID not found or missing.'
			});
			res.end();
		}); 
	});
}

function change_update_handle(req,res) {
	var obj = req.body;

	var criteria = {};
	criteria['_id'] = ObjectID(obj._id);

	var new_r = {};	// document to be inserted
	//new_r['restaurant_id'] = Number(new Date());
	new_r['name'] = (obj.name) ? obj.name : 'Unknown';
	new_r['borough'] = (obj.borough) ? obj.borough : '';
	new_r['cuisine'] = (obj.cuisine) ? obj.cuisine : '';

	var address = {};
	address['building'] = (obj.building) ? obj.building : '';
	address['street'] = (obj.street) ? obj.street : '';
	address['zipcode'] = (obj.zipcode) ? obj.zipcode : '';
	address['coord'] = [2];
	address['coord'][0] = (obj.lon) ? obj.lon : '';
	address['coord'][1] = (obj.lat) ? obj.lat : '';
	new_r['address'] = address;

	//new_r['grades'] = [];
	//new_r['owner'] = (obj.owner) ? obj.owner : 'Unknown';

	// new_r['photo'] = '';
	// new_r['mimetype'] = '';
	try {
		new_r['photo'] = new Buffer(req.files.upload.data).toString('base64');
		new_r['mimetype'] = req.files.upload.mimetype;
		console.log('\n File mimetype: ' + new_r['mimetype']);
	} catch (err) {
		console.log('\n No file to upload.');
	}

	console.log('About to change: ' + JSON.stringify(new_r));
	
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		updateRestaurant(db,criteria,new_r,function(result) {
			db.close();
			console.log(JSON.stringify(result));
			res.redirect('/display?_id='+obj._id);
			// res.render('message', {
			// 	msgTitle: 'SUCCESS',
			// 	msg: 'The restaurant record ('+new_r['name']+') updated.'
			// });
			// res.end();
			return;		
		});
	});
}


function rate_update_handle(req,res) {
	var obj = req.body;

	var criteria = {};
	criteria['_id'] = ObjectID(obj._id);

	var new_r = {};	// document to be inserted

	var grades = {};
	grades['user'] = (req.session.username) ? req.session.username : 'Unknown';
	grades['score'] = (obj.score) ? obj.score : '1';
	new_r['grades'] = grades;

	console.log('About to change: ' + JSON.stringify(new_r));
	
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		rateRestaurant(db,criteria,new_r,function(result) {
			db.close();
			console.log(JSON.stringify(result));

			res.redirect('/display?_id='+obj._id);
			// res.render('message', {
			// 	msgTitle: 'SUCCESS',
			// 	msg: 'The restaurant record ('+new_r['name']+') updated.'
			// });
			// res.end();
			return;		
		});
	});
}

function remove_delete_handle(req,res,criteria) {
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		deleteRestaurant(db,criteria,function(result) {
			db.close();
			console.log(JSON.stringify(result));
			var rMsg = JSON.parse(result);
			if (rMsg.n>0) {
				res.render('message', {
					msgTitle: 'SUCCESS',
					msg: 'The restaurant record (_id: '+req.query._id+') has been deleted.'
				});	
				res.end();
			} else {
				res.render('message', {
					msgTitle: 'ERROR',
					msg: 'The restaurant record (_id: '+req.query._id+') may not exists or owned by you.'
				});	
				res.end();
			}
				
		});
	});
}

function search_get_handle(req,res) {
	var displayObj = {};
	var restaurants = {}; //empty result

	displayObj['name'] = '';
	displayObj['borough'] = '';
	displayObj['cuisine'] = '';
	var d_address = {};
		d_address['building'] = '';
		d_address['street'] = '';
		d_address['zipcode'] = '';
	displayObj['address'] = d_address;
	displayObj['owner'] = '';

	res.render('search', {
		d: displayObj,
		r: restaurants
	});
	res.end();
}

function search_post_handle(req,res) {
	var obj = req.body;

	//for form display
	var displayObj = {};

	displayObj['name'] = (obj.name) ? obj.name : '';
	displayObj['borough'] = (obj.borough) ? obj.borough : '';
	displayObj['cuisine'] = (obj.cuisine) ? obj.cuisine : '';
	// var d_address = {};
	// 	d_address['building'] = (obj.building) ? obj.building : '';
	// 	d_address['street'] = (obj.street) ? obj.street : '';
	// 	d_address['zipcode'] = (obj.zipcode) ? obj.zipcode : '';
	// displayObj['address'] = d_address;
	displayObj['owner'] = (obj.owner) ? obj.owner : '';
	console.log("\ndisplayObj: " + JSON.stringify(displayObj));

	//for criteria
	var criteria = {};
	
	if (obj.name) criteria['name'] = {$regex:obj.name};
	if (obj.borough) criteria['borough'] = {$regex:obj.borough};
	if (obj.cuisine) criteria['cuisine'] = {$regex:obj.cuisine};
	
	// if (obj.building||obj.street||obj.zipcode){
	// 	var address = {};
	// 	if (obj.building) address['building'] = obj.building;
	// 	if (obj.street) address['street'] = obj.street;
	// 	if (obj.zipcode) address['zipcode'] = obj.zipcode;
	// 	criteria['address'] = {$elemMatch:address};
	// }
	if (obj.owner) criteria['owner'] = {$regex:obj.owner};
	console.log("\ncriteria: " + JSON.stringify(criteria));

	//db operation
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findRestaurants(db,criteria,0,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');

			console.log('restaurants.length (search): ' + restaurants.length);
			res.render("search", {
				d: displayObj,
				r: restaurants
			});
			res.end();
		}); 
	});
}

function findRestaurants(db,criteria,max,callback) {
	var restaurants = [];

	//testing
	// var aaaa = "123";
	// criteria = {name:{$regex:aaaa}};

	// testing2
	// criteria = {};
	// var aaaa = "123";
	// criteria['name'] = {$regex:aaaa};

	if (max > 0) {
		cursor = db.collection('restaurants').find(criteria).limit(max); 		
	} else {
		cursor = db.collection('restaurants').find(criteria); 				
	}

	

	cursor.sort({restaurant_id:-1});
	cursor.each(function(err, doc) {
		assert.equal(err, null); 
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants); 
		}
	});
}

function insertRestaurant(db,r,callback) {
	db.collection('restaurants').insertOne(r,function(err,result) {
		assert.equal(err,null);
		console.log("Insert was successful!");
		callback(result);
	});
}

function updateRestaurant(db,criteria,newValues,callback) {
	db.collection('restaurants').updateOne(
		criteria,{$set: newValues},function(err,result) {
			assert.equal(err,null);
			console.log("Update function active");
			callback(result);
	});
}

function rateRestaurant(db,criteria,newValues,callback) {
	db.collection('restaurants').updateOne(
		criteria,{$push: newValues},function(err,result) {
			assert.equal(err,null);
			console.log("Update function active");
			callback(result);
	});
}

function deleteRestaurant(db,criteria,callback) {
	db.collection('restaurants').deleteMany(criteria,function(err,result) {
		assert.equal(err,null);
		console.log("Delete function active");
		callback(result);
	});
}





// ----------------------------------------------------------------------
// --vvvvvvvvvvvvvvvvvvvvvvvv For registration vvvvvvvvvvvvvvvvvvvvvvvv--
// ----------------------------------------------------------------------

function regist_read_handle(req,res,criteria,max) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findUsers(db,criteria,max,function(users) {
			db.close();
			console.log('Disconnected MongoDB\n');
			
			for (var i=0; i<users.length; i++) {
				if (users[i].name == req.body.inputName &&
					users[i].password == req.body.inputPassword) {
					req.session.authenticated = true;
					req.session.username = users[i].name;
				}
			}
			if (req.session.authenticated) 
				res.redirect('/')
			else {
				res.render('login', {
					msg: 'FAIL: Incorrect username/password'
				});
				res.end();
			}


			// res.render('message', {
			// 	msgTitle: 'ERROR',
			// 	msg: 'ID not found or missing.'
			// });
			// res.end();
		}); 
	});
}

function regist_create_handle(req,res) {
	var obj = req.body;
	var new_r = {};	// document to be inserted
	//new_r['restaurant_id'] = Number(new Date());
	new_r['name'] = (obj.inputName) ? obj.inputName : 'Unknown';
	new_r['password'] = (obj.inputPassword) ? obj.inputPassword : '';

	//console.log('About to insert: ' + JSON.stringify(new_r));
	
	MongoClient.connect(mongourl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		insertUsers(db,new_r,function(result) {
			db.close();
			console.log(JSON.stringify(result));
			res.render('login', {
				msg: 'SUCCESS: New user ['+obj.inputName+'] joined',
				preinput1: obj.inputName,
				preinput2: obj.inputPassword
			});
			res.end();
			return;		
		});
	});
}

function findUsers(db,criteria,max,callback) {
	var users = [];

	cursor = db.collection('restaurants_users').find(criteria);

	cursor.sort({restaurant_id:-1});
	cursor.each(function(err, doc) {
		assert.equal(err, null); 
		if (doc != null) {
			users.push(doc);
		} else {
			callback(users); 
		}
	});
}

function insertUsers(db,r,callback) {
	db.collection('restaurants_users').insertOne(r,function(err,result) {
		assert.equal(err,null);
		console.log("Insert user was successful!");
		callback(result);
	});
}

// ----------------------------------------------------------------------
// --^^^^^^^^^^^^^^^^^^^^^^^^ For registration ^^^^^^^^^^^^^^^^^^^^^^^^--
// ----------------------------------------------------------------------








// app.get("/read", function(req,res) {
// 	res.render("list", {c: cafes});
// });

// app.get('/cafe', function(req,res) {
// 	if (req.query.id != null) {
// 		for (var i=0; i<cafes.length; i++) {
// 			if (cafes[i].id == req.query.id) {
// 				res.render('details', {c: cafes[i]});				
// 			}
// 		}
// 		res.status(500).end(req.query.id + ' not found!');
// 	} else {
// 		res.status(500).end('id missing!');
// 	}
// });

// app.use(express.static(__dirname +  '/public')); //css

// app.get("/", function(req,res) {
// 	res.render("gmap.ejs", {
// 		lat:req.query.lat,
// 		lon:req.query.lon,
// 		zoom:req.query.zoom
// 	});
// 	res.end();
// });

app.listen(process.env.PORT || 8099);
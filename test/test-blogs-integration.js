const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require ('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function seedBlogPostsData() {
	console.info('seeding blog posts data');
	const seedData = [];
	for (let i=1; i<=5; i++) {
		seedData.push(generatePostData());
	}
	return BlogPost.insertMany(seedData);
}

function generatePostData() {
	return {
		author: {
			firstName: faker.name.firstName(),
			lastName: faker.name.lastName()
		},
		title: faker.lorem.words(),
		content: faker.lorem.sentence()
	}
}

function tearDownDb() {
	console.warn('Deleting database');
	return mongoose.connection.dropDatabase();
}


describe('BlogPost API resource', function() {
	before(function() {
		return runServer(TEST_DATABASE_URL);
	});
	
	beforeEach(function() {
		return seedBlogPostsData();
	});

	afterEach(function() {
		return tearDownDb();
	});

	after(function() {
		return closeServer();
	});

	describe('GET endpoint', function() {

		it('should return all existing posts', function() {
		  let res;
		  return chai.request(app)
		    .get('/posts')
		    .then(function(_res) {
		      // so subsequent .then blocks can access resp obj.
		      res = _res;
		      res.should.have.status(200);
		      // otherwise our db seeding didn't work
		      res.body.should.have.length.of.at.least(1);
		      return BlogPost.count();
		    })
		    .then(function(count) {
		      return res.body.should.have.length.of(count);
		    });
		});

		it('should return posts with correct fields', function() {
			let resBlogPost;
			return chai.request(app)
				.get('/posts')
				.then(function(res) {
					res.should.have.status(200);
					res.should.be.json;
					res.body.should.be.a('array');
					res.body.should.have.length.of.at.least(1);

					res.body.forEach(function(post) {
						post.should.be.a('object');
						post.should.include.keys('id', 'author', 'content', 'title', 'created');
					});
					resBlogPost = res.body[0];
					return BlogPost.findById(resBlogPost.id);
				})
				.then(function(post) {
					resBlogPost.id.should.equal(post.id);
					resBlogPost.author.should.contain(post.author.firstName);
					resBlogPost.content.should.equal(post.content);
					resBlogPost.title.should.equal(post.title);
				});
		});
	});

	describe('POST endpoint', function() {
		it('should add a new blog post', function() {
			const newBlogPost = generatePostData();
			return chai.request(app)
				.post('/posts')
				.send(newBlogPost)
				.then(function(res) {
					res.should.have.status(201);
					res.should.be.json;
					res.body.should.be.a('object');
					res.body.should.include.keys('id', 'author', 'title', 'content', 'created');
					res.body.id.should.not.be.null;
					res.body.author.should.include(newBlogPost.author.firstName);
					res.body.title.should.equal(newBlogPost.title);
					res.body.content.should.equal(newBlogPost.content);
					return BlogPost.findById(res.body.id);
				})
				.then(function(post) {
					post.author.firstName.should.equal(newBlogPost.author.firstName);
					post.author.lastName.should.equal(newBlogPost.author.lastName);
					post.title.should.equal(newBlogPost.title);
					post.content.should.equal(newBlogPost.content);
				});
		});
	});

	describe('PUT endpoint', function() {
		it('should update fields you send over', function() {
			const updateData = {
				title: 'Test Testing Title',
				content: 'Test Testing Content'
			};
			return BlogPost
				.findOne()
				.then(function(post) {
					updateData.id = post.id;
					return chai.request(app)
						.put(`/posts/${post.id}`)
						.send(updateData);
				})
				.then(function(res) {
					res.should.have.status(204);
					return BlogPost.findById(updateData.id);
				})
				.then(function(post) {
					post.title.should.equal(updateData.title);
					post.content.should.equal(updateData.content);
				});
		});
	});

	describe('DELETE endpoint', function() {
		it('should delete a blog post by id', function() {
			let post;
			return BlogPost
				.findOne()
				.then(function(_post) {
					post = _post;
					return chai.request(app).delete(`/posts/${post.id}`);
				})
				.then(function(res) {
					res.should.have.status(204);
					return BlogPost.findById(post.id);
				})
				.then(function(_post) {
					should.not.exist(_post);
				});
		});
	});
});
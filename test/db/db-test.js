var Promise = require('bluebird');

describe("Database API", function () {
  before(function () {
    return TEST_SERVER.create({
      name: 'testdb_dbapi',
      type: 'graph',
      storage: 'memory'
    })
    .bind(this)
    .then(function (db) {
      this.db = db;
    });
  });
  after(function () {
    return TEST_SERVER.drop({
      name: 'testdb_dbapi',
      storage: 'memory'
    });
  });

  describe('Db::open()', function () {
    it('should open the database', function () {
      return this.db.open()
      .then(function (db) {
        db.sessionId.should.be.above(-1);
      });
    });
  });

  describe('Db::query()', function () {
    it('should execute a simple query', function () {
      return this.db.query('SELECT * FROM OUser')
      .then(function (response) {
        response.length.should.be.above(1);
      });
    });
    it('should execute a simple query with a limit', function () {
      return this.db.query('SELECT * FROM OUser LIMIT 1')
      .then(function (response) {
        response.length.should.equal(1);
      });
    });
    it('should execute a simple query with a limit and a condition', function () {
      return this.db.query('SELECT * FROM OUser WHERE name = \'reader\'LIMIT 1')
      .then(function (response) {
        response.length.should.equal(1);
      });
    });
    it('should execute a simple query with a limit and a condition that fails', function () {
      return this.db.query('SELECT * FROM OUser WHERE name = \'not_an_existing_user\'LIMIT 1')
      .then(function (response) {
        response.length.should.equal(0);
      });
    });
    it('should execute a numerical parameterized query', function () {
      return this.db.query('SELECT * FROM OUser WHERE name = ? LIMIT 1', {
        params: ['reader']
      })
      .then(function (response) {
        response.length.should.equal(1);
        response[0].name.should.equal('reader');
      });
    });
    it('should execute a named parameterized query', function () {
      return this.db.query('SELECT * FROM OUser WHERE name = :name LIMIT 1', {
        params: {
          name: 'writer'
        }
      })
      .then(function (response) {
        response.length.should.equal(1);
        response[0].name.should.equal('writer');
      });
    });
  });

  describe('Db::registerTransformer()', function () {
    function OUser (data) {
      if (!(this instanceof OUser)) {
        return new OUser(data);
      }
      var keys = Object.keys(data),
          length = keys.length,
          key, i;
      for (i = 0; i < length; i++) {
        key = keys[i];
        this[key] = data[key];
      }
    }

    function ORole (data) {
      if (!(this instanceof ORole)) {
        return new ORole(data);
      }
      var keys = Object.keys(data),
          length = keys.length,
          key, i;
      for (i = 0; i < length; i++) {
        key = keys[i];
        this[key] = data[key];
      }
    }


    before(function () {
      this.db.registerTransformer('OUser', OUser);
      this.db.registerTransformer('ORole', ORole);
    });

    it('should register a transformation function for a class', function () {
      return Promise.all([
        this.db.select().from('OUser').all(),
        this.db.select().from('ORole').all()
      ])
      .spread(function (users, roles) {
        users.length.should.be.above(0);
        users.forEach(function (user) {
          user.should.be.an.instanceOf(OUser);
        });
        roles.length.should.be.above(0);
        roles.forEach(function (role) {
          role.should.be.an.instanceOf(ORole);
        });
      });
    });

    it('should transform documents even when they are nested', function () {
      return this.db.select().from('OUser').fetch({roles: 1}).all()
      .then(function (users) {
        users.length.should.be.above(0);
        users.forEach(function (user) {
          user.should.be.an.instanceOf(OUser);
          user.roles.length.should.be.above(0);
          user.roles.forEach(function (role) {
            role.should.be.an.instanceOf(ORole);
          });
        });
      });
    });

    it('should still allow scalars', function () {
      return this.db.select().from('OUser').limit(1).scalar()
      .then(function (result) {
        result.should.equal('admin');
      });
    });

    it('should not transform when individual columns are selected', function () {
      return this.db.select('name, status').from('OUser').limit(1).one()
      .then(function (result) {
        result.should.not.be.an.instanceOf(OUser);
      });
    });
  });
});
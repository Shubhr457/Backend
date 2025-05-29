const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

describe('Authentication Endpoints', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/blockchain_test');
    }
  });

  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and close database connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: {
          firstName: 'Test',
          lastName: 'User'
        }
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      
      // Password should not be returned
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'password123'
      };

      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to create second user with same email
      const duplicateData = {
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User already exists');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const userData = {
        username: 'logintest',
        email: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      testUser = response.body.data.user;
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      authToken = response.body.data.tokens.accessToken;
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return error for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeEach(async () => {
      // Create and login a test user
      const userData = {
        username: 'profiletest',
        email: 'profile@example.com',
        password: 'password123',
        profile: {
          firstName: 'Profile',
          lastName: 'Test'
        }
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.tokens.accessToken;
      testUser = registerResponse.body.data.user;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('profiletest');
      expect(response.body.data.user.email).toBe('profile@example.com');
      expect(response.body.data.user.profile.firstName).toBe('Profile');
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('PUT /api/auth/profile', () => {
    beforeEach(async () => {
      // Create and login a test user
      const userData = {
        username: 'updatetest',
        email: 'update@example.com',
        password: 'password123',
        profile: {
          firstName: 'Original',
          lastName: 'Name'
        }
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.tokens.accessToken;
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        profile: {
          firstName: 'Updated',
          lastName: 'Name',
          avatar: 'https://example.com/avatar.jpg'
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.user.profile.firstName).toBe('Updated');
      expect(response.body.data.user.profile.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        profile: {
          avatar: 'invalid-url'
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 102; i++) {
        requests.push(
          request(app)
            .get('/api/blockchain/status')
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});

// Test helper functions
const createTestUser = async (userData = {}) => {
  const defaultData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    ...userData
  };

  const response = await request(app)
    .post('/api/auth/register')
    .send(defaultData);

  return {
    user: response.body.data.user,
    tokens: response.body.data.tokens
  };
};

module.exports = { createTestUser }; 
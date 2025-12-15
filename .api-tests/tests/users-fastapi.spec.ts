import { test, expect } from '@playwright/test';

const BASE_URL = process.env.USERS_FASTAPI_BASE_URL || 'http://localhost:8080';

// Helper to generate random string
const randomString = (length = 8) => Math.random().toString(36).substring(2, 2 + length);

// Helper to create a user
async function createUser(apiContext) {
  const email = `test_${randomString()}@example.com`;
  const password = `pass_${randomString()}`;
  
  const response = await apiContext.post(`${BASE_URL}/users`, {
    form: {
      username: email,
      password: password
    }
  });
  
  if (response.status() !== 201) {
    throw new Error(`Failed to create user in setup: ${response.status()} ${await response.text()}`);
  }

  return { email, password, response };
}

// Helper to login and get token
async function loginUser(apiContext, email, password) {
  const response = await apiContext.post(`${BASE_URL}/token`, {
    form: {
      username: email,
      password: password
    }
  });
  if (!response.ok()) {
    throw new Error(`Failed to login in setup: ${response.status()}`);
  }
  const data = await response.json();
  return data.access_token;
}

test.describe('users-fastapi', () => {

  test.describe('GET /', () => {
    test('should return welcome message', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('message');
    });
  });

  test.describe('POST /users (Create User)', () => {
    test('should create a new user successfully', async ({ request }) => {
      const email = `new_${randomString()}@example.com`;
      const password = 'securepassword';
      
      const response = await request.post(`${BASE_URL}/users`, {
        form: {
          username: email,
          password: password
        }
      });
      
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.email).toBe(email);
      expect(body).toHaveProperty('id');
    });

    test('should fail when creating a duplicate user', async ({ request }) => {
      const { email, password } = await createUser(request);
      
      const response = await request.post(`${BASE_URL}/users`, {
        form: {
          username: email,
          password: password
        }
      });
      
      expect(response.status()).toBe(409); // User already exists
    });
  });

  test.describe('POST /token (Login)', () => {
    test('should return token with valid credentials', async ({ request }) => {
      const { email, password } = await createUser(request);
      
      const response = await request.post(`${BASE_URL}/token`, {
        form: {
          username: email,
          password: password
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('access_token');
      expect(body.token_type).toBe('bearer');
    });

    test('should fail with invalid credentials', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/token`, {
        form: {
          username: 'nonexistent@example.com',
          password: 'wrongpassword'
        }
      });
      
      expect(response.status()).toBe(401);
    });
  });

  test.describe('GET /users/me', () => {
    test('should return current user details when authenticated', async ({ request }) => {
      const { email, password } = await createUser(request);
      const token = await loginUser(request, email, password);
      
      const response = await request.get(`${BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.email).toBe(email);
    });

    test('should fail when not authenticated', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/users/me`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('PUT /users', () => {
    test('should update user email successfully', async ({ request }) => {
      const { email, password } = await createUser(request);
      const token = await loginUser(request, email, password);
      
      const newEmail = `updated_${randomString()}@example.com`;
      
      const response = await request.put(`${BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          field: 'email',
          value: newEmail
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.email).toBe(newEmail);
    });

    test('should fail when not authenticated', async ({ request }) => {
      const response = await request.put(`${BASE_URL}/users`, {
        data: {
          field: 'email',
          value: 'some@example.com'
        }
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('GET /users/all', () => {
    test('should fail for non-admin user', async ({ request }) => {
      const { email, password } = await createUser(request);
      const token = await loginUser(request, email, password);
      
      const response = await request.get(`${BASE_URL}/users/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Logic from source: if not user.is_admin(): raise 401
      expect(response.status()).toBe(401);
    });

    test('should fail when not authenticated', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/users/all`);
      expect(response.status()).toBe(401);
    });

    // TODO: Add test for admin user if admin creation is exposed or seeded.
  });

  test.describe('DELETE /users', () => {
    test('should delete the current user', async ({ request }) => {
      const { email, password } = await createUser(request);
      const token = await loginUser(request, email, password);
      
      const response = await request.delete(`${BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(response.status()).toBe(204);
      
      // Verify user is gone
      const loginResponse = await request.post(`${BASE_URL}/token`, {
        form: {
          username: email,
          password: password
        }
      });
      expect(loginResponse.status()).toBe(401);
    });

    test('should fail when not authenticated', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/users`);
      expect(response.status()).toBe(401);
    });
  });

});

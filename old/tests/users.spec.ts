
import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

// Helper function to create a new user and return their token and ID
async function createTestUser(request: APIRequestContext, email: string, password: string, userType: 'ADMIN' | 'CUSTOMER' = 'CUSTOMER') {
    // First, get an admin token to create the user
    const adminToken = await getAdminToken(request);

    const createUserResponse = await request.post(`${BASE_URL}/users`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
        },
        data: {
            email: email,
            passhash: password, // In a real scenario, this would be hashed on the client or by a dedicated endpoint.
            user_type: userType,
        },
    });
    expect(createUserResponse.status()).toBe(201);
    const user = await createUserResponse.json();

    // Now, log in as the new user to get their token
    const loginResponse = await request.post(`${BASE_URL}/token`, {
        form: {
            username: email,
            password: password,
        },
    });
    expect(loginResponse.status()).toBe(200);
    const tokenData = await loginResponse.json();
    return { token: tokenData.access_token, userId: user.id };
}

// Helper function to get an admin token (assuming a default admin user exists for testing)
// TODO: Replace with actual admin credentials or a dedicated test setup for creating an admin
async function getAdminToken(request: APIRequestContext) {
    const adminEmail = 'admin@example.com'; // TODO: Get from env or setup
    const adminPassword = 'adminpassword'; // TODO: Get from env or setup

    const response = await request.post(`${BASE_URL}/token`, {
        form: {
            username: adminEmail,
            password: adminPassword,
        },
    });
    expect(response.status()).toBe(200);
    const tokenData = await response.json();
    return tokenData.access_token;
}

test.describe('Users Service API Tests', () => {

    test('GET / - Should return a welcome message', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ message: 'User Microservice' });
    });

    test.describe('POST /token', () => {
        const testUserEmail = `token_user_${Date.now()}@example.com`;
        const testUserPassword = 'testpassword123';
        let adminToken: string;

        test.beforeAll(async ({ request }) => {
            // Create a test user for login scenarios
            adminToken = await getAdminToken(request); // Ensure admin token exists
            await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    email: testUserEmail,
                    passhash: testUserPassword,
                    user_type: 'CUSTOMER',
                },
            });
        });

        test('Should successfully authenticate and return a token with valid credentials', async ({ request }) => {
            const response = await request.post(`${BASE_URL}/token`, {
                form: {
                    username: testUserEmail,
                    password: testUserPassword,
                },
            });
            expect(response.status()).toBe(200);
            const token = await response.json();
            expect(token).toHaveProperty('access_token');
            expect(token.token_type).toBe('bearer');
        });

        test('Should return 401 for incorrect username or password', async ({ request }) => {
            const response = await request.post(`${BASE_URL}/token`, {
                form: {
                    username: 'nonexistent@example.com',
                    password: 'wrongpassword',
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Incorrect username or password' });
        });
    });

    test.describe('GET /users/me', () => {
        let userToken: string;
        let userId: string;
        const testUserEmail = `me_user_${Date.now()}@example.com`;
        const testUserPassword = 'testpassword123';

        test.beforeAll(async ({ request }) => {
            const userData = await createTestUser(request, testUserEmail, testUserPassword, 'CUSTOMER');
            userToken = userData.token;
            userId = userData.userId;
        });

        test('Should return current user information with a valid token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                },
            });
            expect(response.status()).toBe(200);
            const user = await response.json();
            expect(user.email).toBe(testUserEmail);
            expect(user.id).toBe(userId);
            expect(user.user_type).toBe('CUSTOMER');
        });

        test('Should return 401 without a token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/me`);
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Not authenticated' }); // TODO: Verify exact error message. Snapshot says "Could not validate credentials"
        });

        test('Should return 401 with an invalid token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer invalidtoken`,
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Could not validate credentials' });
        });
    });

    test.describe('GET /users/all', () => {
        let adminToken: string;
        let customerToken: string;
        const adminEmail = `admin_${Date.now()}@example.com`;
        const adminPassword = 'adminpassword';
        const customerEmail = `customer_${Date.now()}@example.com`;
        const customerPassword = 'customerpassword';

        test.beforeAll(async ({ request }) => {
            const adminData = await createTestUser(request, adminEmail, adminPassword, 'ADMIN');
            adminToken = adminData.token;
            const customerData = await createTestUser(request, customerEmail, customerPassword, 'CUSTOMER');
            customerToken = customerData.token;
        });

        test('Should return a list of all users with a valid admin token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/all`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });
            expect(response.status()).toBe(200);
            const users = await response.json();
            expect(users.users).toBeInstanceOf(Array);
            expect(users.users.length).toBeGreaterThan(0);
        });

        test('Should return 401 for a non-admin user', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/all`, {
                headers: {
                    'Authorization': `Bearer ${customerToken}`,
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Operation not allowerd' });
        });

        test('Should return 401 without a token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/all`);
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Not authenticated' }); // TODO: Verify exact error message. Snapshot says "Could not validate credentials"
        });

        test('Should return 401 with an invalid token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/all`, {
                headers: {
                    'Authorization': `Bearer invalidtoken`,
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Could not validate credentials' });
        });

        test('Should respect skip and limit query parameters', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/users/all?skip=0&limit=1`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });
            expect(response.status()).toBe(200);
            const users = await response.json();
            expect(users.users).toBeInstanceOf(Array);
            expect(users.users.length).toBe(1);
        });
    });

    test.describe('POST /users', () => {
        let adminToken: string;

        test.beforeAll(async ({ request }) => {
            adminToken = await getAdminToken(request);
        });

        test('Should create a new user successfully with valid data and admin token', async ({ request }) => {
            const email = `new_user_${Date.now()}@example.com`;
            const password = 'securepassword';

            const response = await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    email: email,
                    passhash: password,
                    user_type: 'CUSTOMER',
                },
            });
            expect(response.status()).toBe(201);
            const newUser = await response.json();
            expect(newUser.email).toBe(email);
            expect(newUser.user_type).toBe('CUSTOMER');
            expect(newUser).toHaveProperty('id');
            expect(newUser).toHaveProperty('created_at');
        });

        test('Should return 409 if user with email already exists', async ({ request }) => {
            const email = `existing_user_${Date.now()}@example.com`;
            const password = 'securepassword';

            // Create user first
            await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    email: email,
                    passhash: password,
                    user_type: 'CUSTOMER',
                },
            });

            // Try to create again
            const response = await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    email: email,
                    passhash: password,
                    user_type: 'CUSTOMER',
                },
            });
            expect(response.status()).toBe(409);
            expect(await response.json()).toEqual({ detail: 'User already exists' });
        });

        test('Should return 401 without a token', async ({ request }) => {
            const email = `no_auth_user_${Date.now()}@example.com`;
            const password = 'securepassword';

            const response = await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    email: email,
                    passhash: password,
                    user_type: 'CUSTOMER',
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Not authenticated' }); // TODO: Verify exact error message. Snapshot says "Could not validate credentials"
        });

        test('Should return 401 with an invalid token', async ({ request }) => {
            const email = `invalid_auth_user_${Date.now()}@example.com`;
            const password = 'securepassword';

            const response = await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer invalidtoken`,
                    'Content-Type': 'application/json',
                },
                data: {
                    email: email,
                    passhash: password,
                    user_type: 'CUSTOMER',
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Could not validate credentials' });
        });

        test('Should return 422 for invalid request body (missing required fields)', async ({ request }) => {
            const response = await request.post(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    email: `incomplete_user_${Date.now()}@example.com`,
                    // passhash is missing
                },
            });
            expect(response.status()).toBe(422); // FastAPI validation error
        });
    });

    test.describe('PUT /users', () => {
        let userToken: string;
        let userId: string;
        const testUserEmail = `update_user_${Date.now()}@example.com`;
        const testUserPassword = 'testpassword123';
        const newEmail = `updated_user_${Date.now()}@example.com`;
        let adminToken: string;

        test.beforeAll(async ({ request }) => {
            adminToken = await getAdminToken(request);
            const userData = await createTestUser(request, testUserEmail, testUserPassword, 'CUSTOMER');
            userToken = userData.token;
            userId = userData.userId;
        });

        test('Should update user email successfully with valid data and token', async ({ request }) => {
            const response = await request.put(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    field: 'email',
                    value: newEmail,
                },
            });
            expect(response.status()).toBe(200);
            const updatedUser = await response.json();
            expect(updatedUser.email).toBe(newEmail);
            expect(updatedUser.id).toBe(userId);
        });

        test('Should return 409 if new email already exists', async ({ request }) => {
            const anotherUserEmail = `another_user_${Date.now()}@example.com`;
            await createTestUser(request, anotherUserEmail, 'anotherpass', 'CUSTOMER');

            const response = await request.put(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    field: 'email',
                    value: anotherUserEmail, // Try to update to an existing email
                },
            });
            expect(response.status()).toBe(409);
            expect(await response.json()).toEqual({ detail: 'Email already exists' });
        });

        test('Should return 401 without a token', async ({ request }) => {
            const response = await request.put(`${BASE_URL}/users`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    field: 'email',
                    value: `unauthorized_${Date.now()}@example.com`,
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Not authenticated' }); // TODO: Verify exact error message. Snapshot says "Could not validate credentials"
        });

        test('Should return 401 with an invalid token', async ({ request }) => {
            const response = await request.put(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer invalidtoken`,
                    'Content-Type': 'application/json',
                },
                data: {
                    field: 'email',
                    value: `invalid_token_update_${Date.now()}@example.com`,
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Could not validate credentials' });
        });

        test('Should return 422 for invalid request body (invalid field)', async ({ request }) => {
            const response = await request.put(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    field: 'invalid_field', // Invalid field
                    value: 'some_value',
                },
            });
            expect(response.status()).toBe(422); // FastAPI validation error
        });
    });

    test.describe('DELETE /users', () => {
        let userTokenToDelete: string;
        let userIdToDelete: string;
        const emailToDelete = `delete_user_${Date.now()}@example.com`;
        const passwordToDelete = 'deletepassword';
        let adminToken: string;

        test.beforeEach(async ({ request }) => {
            adminToken = await getAdminToken(request);
            const userData = await createTestUser(request, emailToDelete, passwordToDelete, 'CUSTOMER');
            userTokenToDelete = userData.token;
            userIdToDelete = userData.userId;
        });

        test('Should delete the current user successfully with a valid token', async ({ request }) => {
            const response = await request.delete(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${userTokenToDelete}`,
                },
            });
            expect(response.status()).toBe(204);

            // Verify the user is actually deleted by trying to fetch their info
            const verifyDeleteResponse = await request.get(`${BASE_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${userTokenToDelete}`,
                },
            });
            expect(verifyDeleteResponse.status()).toBe(401); // User should no longer be authenticated
        });

        test('Should return 401 without a token', async ({ request }) => {
            const response = await request.delete(`${BASE_URL}/users`);
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Not authenticated' }); // TODO: Verify exact error message. Snapshot says "Could not validate credentials"
        });

        test('Should return 401 with an invalid token', async ({ request }) => {
            const response = await request.delete(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer invalidtoken`,
                },
            });
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual({ detail: 'Could not validate credentials' });
        });
    });
});

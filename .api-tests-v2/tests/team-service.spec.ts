import { test, expect, APIResponse } from '@playwright/test';

const BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:8002';

test.describe('GET /teams/{id}/', () => {
  test('should return 200 and a team if team exists', async ({ request }) => {
    // Assuming a team with ID 1 exists for a successful GET operation
    // First, create a team to ensure it exists for the GET request
    const createResponse = await request.post(`${BASE_URL}/teams/`, {
      data: { name: 'Test Team' },
    });
    expect(createResponse.status()).toBe(201);
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const response = await request.get(`${BASE_URL}/teams/${teamId}/`);
    expect(response.status()).toBe(200);
    const team = await response.json();
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name');
    expect(team.id).toBe(teamId);
    expect(team.name).toBe('Test Team');

    // Clean up: Delete the created team
    await request.delete(`${BASE_URL}/teams/${teamId}/`);
  });

  test('should return 404 if team does not exist', async ({ request }) => {
    const nonExistentId = 99999; // Assuming this ID does not exist
    const response = await request.get(`${BASE_URL}/teams/${nonExistentId}/`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Team not found!' });
  });

  test('should return 422 for invalid id (e.g., id <= 0)', async ({ request }) => {
    const invalidId = 0;
    const response = await request.get(`${BASE_URL}/teams/${invalidId}/`);
    expect(response.status()).toBe(422); // FastAPI returns 422 for validation errors
    // Optionally, assert on the error message structure if known
  });
});

test.describe('GET /teams/', () => {
  test('should return 200 and a list of teams', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/teams/`);
    expect(response.status()).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
  });
});

test.describe('POST /teams/', () => {
  test('should return 201 and create a new team with valid payload', async ({ request }) => {
    const teamName = 'New Playwright Team';
    const response = await request.post(`${BASE_URL}/teams/`, {
      data: { name: teamName },
    });
    expect(response.status()).toBe(201);
    const team = await response.json();
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name', teamName);

    // Clean up: Delete the created team
    await request.delete(`${BASE_URL}/teams/${team.id}/`);
  });

  test('should return 422 with invalid payload (missing name)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/teams/`, {
      data: {}, // Missing 'name' field
    });
    expect(response.status()).toBe(422); // FastAPI returns 422 for validation errors
    // Optionally, assert on the error message structure if known
  });

  test('should return 422 with invalid payload (name is not a string)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/teams/`, {
      data: { name: 123 }, // Name should be a string
    });
    expect(response.status()).toBe(422); // FastAPI returns 422 for validation errors
    // Optionally, assert on the error message structure if known
  });
});

test.describe('DELETE /teams/{id}/', () => {
  test('should return 200 and the deleted team ID if team exists', async ({ request }) => {
    // First, create a team to ensure it exists for deletion
    const createResponse = await request.post(`${BASE_URL}/teams/`, {
      data: { name: 'Team to Delete' },
    });
    expect(createResponse.status()).toBe(201);
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const deleteResponse = await request.delete(`${BASE_URL}/teams/${teamId}/`);
    expect(deleteResponse.status()).toBe(200);
    expect(await deleteResponse.json()).toBe(teamId);

    // Verify the team is actually deleted
    const getResponse = await request.get(`${BASE_URL}/teams/${teamId}/`);
    expect(getResponse.status()).toBe(404);
  });

  test('should return 404 if team does not exist', async ({ request }) => {
    const nonExistentId = 99998; // Assuming this ID does not exist
    const response = await request.delete(`${BASE_URL}/teams/${nonExistentId}/`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Team not found!' });
  });

  test('should return 422 for invalid id (e.g., id <= 0)', async ({ request }) => {
    const invalidId = 0;
    const response = await request.delete(`${BASE_URL}/teams/${invalidId}/`);
    expect(response.status()).toBe(422); // FastAPI returns 422 for validation errors
    // Optionally, assert on the error message structure if known
  });
});

test.describe('PUT /teams/{id}/', () => {
  test('should return 200 and update an existing team with valid payload', async ({ request }) => {
    // First, create a team to ensure it exists for update
    const createResponse = await request.post(`${BASE_URL}/teams/`, {
      data: { name: 'Original Team Name' },
    });
    expect(createResponse.status()).toBe(201);
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const updatedName = 'Updated Team Name';
    const putResponse = await request.put(`${BASE_URL}/teams/${teamId}/`, {
      data: { name: updatedName },
    });
    expect(putResponse.status()).toBe(200);
    const updatedTeam = await putResponse.json();
    expect(updatedTeam).toHaveProperty('id', teamId);
    expect(updatedTeam).toHaveProperty('name', updatedName);

    // Verify the team is actually updated
    const getResponse = await request.get(`${BASE_URL}/teams/${teamId}/`);
    expect(getResponse.status()).toBe(200);
    expect(await getResponse.json()).toHaveProperty('name', updatedName);

    // Clean up: Delete the created team
    await request.delete(`${BASE_URL}/teams/${teamId}/`);
  });

  test('should return 404 if team does not exist', async ({ request }) => {
    const nonExistentId = 99997; // Assuming this ID does not exist
    const response = await request.put(`${BASE_URL}/teams/${nonExistentId}/`, {
      data: { name: 'Non Existent Team Update' },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Team not found!' });
  });

  test('should return 422 with invalid payload (missing name)', async ({ request }) => {
    // First, create a team to ensure it exists for the PUT request
    const createResponse = await request.post(`${BASE_URL}/teams/`, {
      data: { name: 'Team to update with invalid payload' },
    });
    expect(createResponse.status()).toBe(201);
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const response = await request.put(`${BASE_URL}/teams/${teamId}/`, {
      data: {}, // Missing 'name' field
    });
    expect(response.status()).toBe(422); // FastAPI returns 422 for validation errors
    // Optionally, assert on the error message structure if known

    // Clean up: Delete the created team
    await request.delete(`${BASE_URL}/teams/${teamId}/`);
  });

  test('should return 422 for invalid id (e.g., id <= 0)', async ({ request }) => {
    const invalidId = 0;
    const response = await request.put(`${BASE_URL}/teams/${invalidId}/`, {
      data: { name: 'Invalid ID Team Update' },
    });
    expect(response.status()).toBe(422); // FastAPI returns 422 for validation errors
    // Optionally, assert on the error message structure if known
  });
});

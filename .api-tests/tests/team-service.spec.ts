
import { test, expect } from '@playwright/test';

test.describe('Team Service API Tests', () => {
  const BASE_URL = 'http://localhost:8002'; // TODO: Replace with actual base URL for the team service

  test('GET /teams/ should return a list of teams', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/teams/`);
    expect(response.ok()).toBeTruthy();
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
    // TODO: Add more specific assertions about the structure or content if known
  });

  test('POST /teams/ should create a new team', async ({ request }) => {
    const newTeam = {
      name: 'TestTeam',
      trainer: 'Ash Ketchum',
      members: [] // Assuming members can be an empty array initially
    };
    const response = await request.post(`${BASE_URL}/teams/`, { data: newTeam });
    expect(response.ok()).toBeTruthy();
    const createdTeam = await response.json();
    expect(createdTeam).toMatchObject(newTeam);
    expect(createdTeam.id).toBeDefined(); // Assuming the service assigns an ID
    // TODO: Store this ID for subsequent tests (e.g., PUT, DELETE)
  });

  test('POST /teams/ should fail with invalid data', async ({ request }) => {
    const invalidTeam = {
      name: 'Invalid',
      // Missing 'trainer' field which might be required
    };
    const response = await request.post(`${BASE_URL}/teams/`, { data: invalidTeam });
    expect(response.status()).toBe(422); // Unprocessable Entity for validation errors
    // TODO: Assert specific error message if available and consistent
  });

  test('GET /teams/{id}/ should return a specific team', async ({ request }) => {
    // Pre-create a team to fetch
    const newTeam = {
      name: 'FetchableTeam',
      trainer: 'Misty',
      members: []
    };
    const createResponse = await request.post(`${BASE_URL}/teams/`, { data: newTeam });
    expect(createResponse.ok()).toBeTruthy();
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const response = await request.get(`${BASE_URL}/teams/${teamId}/`);
    expect(response.ok()).toBeTruthy();
    const fetchedTeam = await response.json();
    expect(fetchedTeam).toMatchObject(newTeam);
    expect(fetchedTeam.id).toBe(teamId);
  });

  test('GET /teams/{id}/ should return 404 for non-existent team', async ({ request }) => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999'; // Assuming UUID or similar format
    const response = await request.get(`${BASE_URL}/teams/${nonExistentId}/`);
    expect(response.status()).toBe(404);
  });

  test('PUT /teams/{id}/ should update an existing team', async ({ request }) => {
    // Pre-create a team to update
    const newTeam = {
      name: 'UpdatableTeam',
      trainer: 'Brock',
      members: []
    };
    const createResponse = await request.post(`${BASE_URL}/teams/`, { data: newTeam });
    expect(createResponse.ok()).toBeTruthy();
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const updatedData = {
      name: 'UpdatedUpdatableTeam',
      trainer: 'Professor Oak',
      members: ['Pikachu'] // Adding a member
    };
    const response = await request.put(`${BASE_URL}/teams/${teamId}/`, { data: updatedData });
    expect(response.ok()).toBeTruthy();
    const updatedTeam = await response.json();
    expect(updatedTeam.id).toBe(teamId);
    expect(updatedTeam.name).toBe(updatedData.name);
    expect(updatedTeam.trainer).toBe(updatedData.trainer);
    expect(updatedTeam.members).toEqual(updatedData.members);
    // TODO: Verify all fields are updated or merged correctly based on API behavior
  });

  test('PUT /teams/{id}/ should return 404 for non-existent team', async ({ request }) => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999';
    const updatedData = { name: 'NonExistent', trainer: 'Nobody' };
    const response = await request.put(`${BASE_URL}/teams/${nonExistentId}/`, { data: updatedData });
    expect(response.status()).toBe(404);
  });

  test('DELETE /teams/{id}/ should delete a team', async ({ request }) => {
    // Pre-create a team to delete
    const newTeam = {
      name: 'DeletableTeam',
      trainer: 'Jessie',
      members: []
    };
    const createResponse = await request.post(`${BASE_URL}/teams/`, { data: newTeam });
    expect(createResponse.ok()).toBeTruthy();
    const createdTeam = await createResponse.json();
    const teamId = createdTeam.id;

    const deleteResponse = await request.delete(`${BASE_URL}/teams/${teamId}/`);
    expect(deleteResponse.ok()).toBeTruthy();
    expect(deleteResponse.status()).toBe(204); // Expecting 204 No Content for successful deletion

    // Verify deletion by trying to get the team
    const getResponse = await request.get(`${BASE_URL}/teams/${teamId}/`);
    expect(getResponse.status()).toBe(404);
  });

  test('DELETE /teams/{id}/ should return 404 for non-existent team', async ({ request }) => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999';
    const response = await request.delete(`${BASE_URL}/teams/${nonExistentId}/`);
    expect(response.status()).toBe(404);
  });
});


import { test, expect, APIResponse } from '@playwright/test';

test.describe('Team Service API', () => {

  const BASE_URL = 'http://localhost:8002'; // Assuming the service runs locally

  // Helper function to create a team for tests that require an existing team
  async function createTeam(request: any, name: string): Promise<any> {
    const response = await request.post(`${BASE_URL}/teams/`, {
      data: { name }
    });
    expect(response.status()).toBe(201);
    return response.json();
  }

  test('GET /teams/{id}/ - should return a team by ID', async ({ request }) => {
    // Assuming a team with ID 1 exists for this positive test case.
    const teamId = 1;
    const response = await request.get(`${BASE_URL}/teams/${teamId}/`);
    expect(response.status()).toBe(200);
    const team = await response.json();
    expect(team).toHaveProperty('id', teamId);
    expect(team).toHaveProperty('name');
    // Further schema validation could be added here
  });

  test('GET /teams/{id}/ - should return 404 for non-existent team', async ({ request }) => {
    const nonExistentTeamId = 999;
    const response = await request.get(`${BASE_URL}/teams/${nonExistentTeamId}/`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Team not found!' });
  });

  test('GET /teams/ - should return all teams', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/teams/`);
    expect(response.status()).toBe(200);
    const teamList = await response.json();
    expect(Array.isArray(teamList)).toBe(true);
    // Optionally check if the list contains objects conforming to TeamSchema
    if (teamList.length > 0) {
      expect(teamList[0]).toHaveProperty('id');
      expect(teamList[0]).toHaveProperty('name');
    }
  });

  test('POST /teams/ - should create a new team', async ({ request }) => {
    const newTeam = {
      name: 'Team Rocket'
    };
    const response = await request.post(`${BASE_URL}/teams/`, {
      data: newTeam
    });
    expect(response.status()).toBe(201);
    const createdTeam = await response.json();
    expect(createdTeam).toHaveProperty('id');
    expect(createdTeam).toHaveProperty('name', newTeam.name);
  });

  test('PUT /teams/{id}/ - should update an existing team', async ({ request }) => {
    // First, create a team to update
    const created = await createTeam(request, 'Team Aqua');
    const teamIdToUpdate = created.id;

    const updatedTeamData = {
      name: 'Team Magma'
    };
    const response = await request.put(`${BASE_URL}/teams/${teamIdToUpdate}/`, {
      data: updatedTeamData
    });
    expect(response.status()).toBe(200);
    const updatedTeam = await response.json();
    expect(updatedTeam).toHaveProperty('id', teamIdToUpdate);
    expect(updatedTeam).toHaveProperty('name', updatedTeamData.name);
  });

  test('PUT /teams/{id}/ - should return 404 for non-existent team during update', async ({ request }) => {
    const nonExistentTeamId = 999;
    const updatedTeamData = {
      name: 'NonExistent Team'
    };
    const response = await request.put(`${BASE_URL}/teams/${nonExistentTeamId}/`, {
      data: updatedTeamData
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Team not found!' });
  });

  test('DELETE /teams/{id}/ - should delete an existing team', async ({ request }) => {
    // First, create a team to delete
    const created = await createTeam(request, 'Team Galactic');
    const teamIdToDelete = created.id;

    const response = await request.delete(`${BASE_URL}/teams/${teamIdToDelete}/`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toBe(teamIdToDelete);

    // Verify it's actually deleted
    const getResponse = await request.get(`${BASE_URL}/teams/${teamIdToDelete}/`);
    expect(getResponse.status()).toBe(404);
  });

  test('DELETE /teams/{id}/ - should return 404 for non-existent team', async ({ request }) => {
    const nonExistentTeamId = 999;
    const response = await request.delete(`${BASE_URL}/teams/${nonExistentTeamId}/`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Team not found!' });
  });

});

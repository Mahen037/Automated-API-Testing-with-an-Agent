import { test, expect } from '@playwright/test';

// Define the base URL for the team-service, derived from the snapshot or environment
const TEAM_SERVICE_BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:8002';

// Helper function to create a team for testing purposes
async function createTeam(request: any, name: string): Promise<any> {
    const response = await request.post(`${TEAM_SERVICE_BASE_URL}/teams/`, {
        data: { name },
    });
    expect(response.status()).toBe(201);
    return await response.json();
}

// Helper function to delete a team after testing
async function deleteTeam(request: any, teamId: number): Promise<void> {
    const response = await request.delete(`${TEAM_SERVICE_BASE_URL}/teams/${teamId}/`);
    expect(response.status()).toBe(200);
}

test.describe('Team Service API Tests', () => {

    test('GET /teams/{id}/ - should retrieve a single team by ID', async ({ request }) => {
        // Create a team first to ensure it exists for retrieval
        const newTeam = await createTeam(request, 'Team Rocket');

        const response = await request.get(`${TEAM_SERVICE_BASE_URL}/teams/${newTeam.id}/`);
        expect(response.status()).toBe(200);
        const team = await response.json();
        expect(team).toEqual(expect.objectContaining({
            id: newTeam.id,
            name: 'Team Rocket',
        }));

        // Clean up
        await deleteTeam(request, newTeam.id);
    });

    test('GET /teams/{id}/ - should return 404 for a non-existent team ID', async ({ request }) => {
        const nonExistentId = 99999;
        const response = await request.get(`${TEAM_SERVICE_BASE_URL}/teams/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('GET /teams/ - should retrieve all teams', async ({ request }) => {
        // Create a couple of teams to ensure the list is not empty
        const team1 = await createTeam(request, 'Team Magma');
        const team2 = await createTeam(request, 'Team Aqua');

        const response = await request.get(`${TEAM_SERVICE_BASE_URL}/teams/`);
        expect(response.status()).toBe(200);
        const allTeams = await response.json();
        expect(Array.isArray(allTeams)).toBe(true);
        expect(allTeams.length).toBeGreaterThanOrEqual(2);
        expect(allTeams).toContainEqual(expect.objectContaining({ id: team1.id, name: 'Team Magma' }));
        expect(allTeams).toContainEqual(expect.objectContaining({ id: team2.id, name: 'Team Aqua' }));

        // Clean up
        await deleteTeam(request, team1.id);
        await deleteTeam(request, team2.id);
    });

    test('POST /teams/ - should create a new team', async ({ request }) => {
        const response = await request.post(`${TEAM_SERVICE_BASE_URL}/teams/`, {
            data: {
                name: 'Team Galactic',
            },
        });
        expect(response.status()).toBe(201);
        const newTeam = await response.json();
        expect(newTeam).toEqual(expect.objectContaining({
            id: expect.any(Number),
            name: 'Team Galactic',
        }));

        // Clean up
        await deleteTeam(request, newTeam.id);
    });

    test('POST /teams/ - should return 422 for missing required fields', async ({ request }) => {
        const response = await request.post(`${TEAM_SERVICE_BASE_URL}/teams/`, {
            data: {
                // Missing name
            },
        });
        expect(response.status()).toBe(422); // Unprocessable Entity due to validation error
        expect(await response.json()).toEqual(expect.objectContaining({
            detail: expect.arrayContaining([
                expect.objectContaining({ loc: ['body', 'name'], msg: 'field required' }),
            ]),
        }));
    });

    test('DELETE /teams/{id}/ - should delete a team by ID', async ({ request }) => {
        // Create a team to delete
        const teamToDelete = await createTeam(request, 'Team Plasma');

        const response = await request.delete(`${TEAM_SERVICE_BASE_URL}/teams/${teamToDelete.id}/`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toBe(teamToDelete.id);

        // Verify it's actually deleted
        const getResponse = await request.get(`${TEAM_SERVICE_BASE_URL}/teams/${teamToDelete.id}/`);
        expect(getResponse.status()).toBe(404);
    });

    test('DELETE /teams/{id}/ - should return 404 for a non-existent team ID', async ({ request }) => {
        const nonExistentId = 99998;
        const response = await request.delete(`${TEAM_SERVICE_BASE_URL}/teams/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('PUT /teams/{id}/ - should update an existing team', async ({ request }) => {
        // Create a team to update
        const teamToUpdate = await createTeam(request, 'Team Flare');

        const updatedName = 'Team Flare V2';
        const response = await request.put(`${TEAM_SERVICE_BASE_URL}/teams/${teamToUpdate.id}/`, {
            data: {
                name: updatedName,
            },
        });
        expect(response.status()).toBe(200);
        const updatedTeam = await response.json();
        expect(updatedTeam).toEqual(expect.objectContaining({
            id: teamToUpdate.id,
            name: updatedName,
        }));

        // Clean up
        await deleteTeam(request, teamToUpdate.id);
    });

    test('PUT /teams/{id}/ - should return 404 for a non-existent team ID', async ({ request }) => {
        const nonExistentId = 99997;
        const response = await request.put(`${TEAM_SERVICE_BASE_URL}/teams/${nonExistentId}/`, {
            data: {
                name: 'Team Skull',
            },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('PUT /teams/{id}/ - should return 422 for missing required fields', async ({ request }) => {
        // Create a team first
        const teamToUpdate = await createTeam(request, 'Team Yell');

        const response = await request.put(`${TEAM_SERVICE_BASE_URL}/teams/${teamToUpdate.id}/`, {
            data: {
                // Missing name
            },
        });
        expect(response.status()).toBe(422);
        expect(await response.json()).toEqual(expect.objectContaining({
            detail: expect.arrayContaining([
                expect.objectContaining({ loc: ['body', 'name'], msg: 'field required' }),
            ]),
        }));

        // Clean up
        await deleteTeam(request, teamToUpdate.id);
    });
});
import { test, expect, APIRequestContext } from '@playwright/test';

const TEAM_BASE_URL = process.env.TEAM_BASE_URL || 'http://localhost:8080/teams';

// Helper function to create a team for testing purposes
async function createTeam(request: APIRequestContext, name: string): Promise<number> {
    const response = await request.post(`${TEAM_BASE_URL}/`, {
        data: { name },
    });
    expect(response.status()).toBe(201);
    const team = await response.json();
    return team.id;
}

// Helper function to delete a team
async function deleteTeam(request: APIRequestContext, id: number) {
    const response = await request.delete(`${TEAM_BASE_URL}/${id}/`);
    expect(response.status()).toBe(200);
}

test.describe('Team Service API Tests', () => {
    test.describe('GET /teams/{id}/', () => {
        let teamId: number;
        test.beforeEach(async ({ request }) => {
            // Create a team before each test that requires a valid team id
            teamId = await createTeam(request, 'Test Team Get ID');
        });

        test.afterEach(async ({ request }) => {
            // Clean up the created team after each test
            if (teamId) {
                await deleteTeam(request, teamId);
            }
        });

        test('should return a team by ID (happy path)', async ({ request }) => {
            const response = await request.get(`${TEAM_BASE_URL}/${teamId}/`);
            expect(response.status()).toBe(200);
            const team = await response.json();
            expect(team).toHaveProperty('id', teamId);
            expect(team).toHaveProperty('name', 'Test Team Get ID');
        });

        test('should return 404 for a non-existent team ID (negative path)', async ({ request }) => {
            const response = await request.get(`${TEAM_BASE_URL}/99999/`);
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', 'Team not found!');
        });

        test('should return 422 for invalid team ID (path param constraint violation)', async ({ request }) => {
            // Path param 'id' has constraint 'gt 0'
            const response = await request.get(`${TEAM_BASE_URL}/0/`);
            expect(response.status()).toBe(422);
        });
    });

    test.describe('GET /teams/', () => {
        test('should return all teams (happy path)', async ({ request }) => {
            // Create a temporary team to ensure there's at least one
            const tempTeamId = await createTeam(request, 'Temporary Team');

            const response = await request.get(`${TEAM_BASE_URL}/`);
            expect(response.status()).toBe(200);
            const teamList = await response.json();
            expect(Array.isArray(teamList)).toBeTruthy();
            expect(teamList.length).toBeGreaterThanOrEqual(1);

            // Clean up temporary team
            await deleteTeam(request, tempTeamId);
        });
    });

    test.describe('POST /teams/', () => {
        let teamId: number;
        test.afterEach(async ({ request }) => {
            // Clean up the created team if the test was successful
            if (teamId) {
                await deleteTeam(request, teamId);
                teamId = 0; // Reset for next test
            }
        });

        test('should create a new team (happy path)', async ({ request }) => {
            const newTeam = {
                name: 'New Team Name',
            };
            const response = await request.post(`${TEAM_BASE_URL}/`, {
                data: newTeam,
            });
            expect(response.status()).toBe(201);
            const createdTeam = await response.json();
            expect(createdTeam).toHaveProperty('id');
            expect(createdTeam).toMatchObject(newTeam);
            teamId = createdTeam.id;
        });

        test('should return 422 for invalid payload (missing required field)', async ({ request }) => {
            const invalidTeam = {
                // name is missing
            };
            const response = await request.post(`${TEAM_BASE_URL}/`, {
                data: invalidTeam,
            });
            expect(response.status()).toBe(422);
        });
    });

    test.describe('DELETE /teams/{id}/', () => {
        let teamIdToDelete: number;
        test.beforeEach(async ({ request }) => {
            teamIdToDelete = await createTeam(request, 'Team to Delete');
        });

        test('should delete a team by ID (happy path)', async ({ request }) => {
            const response = await request.delete(`${TEAM_BASE_URL}/${teamIdToDelete}/`);
            expect(response.status()).toBe(200);
            expect(await response.json()).toBe(teamIdToDelete);

            // Verify it's actually deleted
            const getResponse = await request.get(`${TEAM_BASE_URL}/${teamIdToDelete}/`);
            expect(getResponse.status()).toBe(404);
        });

        test('should return 404 for a non-existent team ID (negative path)', async ({ request }) => {
            const response = await request.delete(`${TEAM_BASE_URL}/99999/`);
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', 'Team not found!');
        });

        test('should return 422 for invalid team ID (path param constraint violation)', async ({ request }) => {
            const response = await request.delete(`${TEAM_BASE_URL}/0/`);
            expect(response.status()).toBe(422);
        });
    });

    test.describe('PUT /teams/{id}/', () => {
        let teamIdToUpdate: number;
        test.beforeEach(async ({ request }) => {
            teamIdToUpdate = await createTeam(request, 'Team to Update');
        });

        test.afterEach(async ({ request }) => {
            if (teamIdToUpdate) {
                await deleteTeam(request, teamIdToUpdate);
            }
        });

        test('should update an existing team by ID (happy path)', async ({ request }) => {
            const updatedTeamData = {
                name: 'Updated Team Name',
            };
            const response = await request.put(`${TEAM_BASE_URL}/${teamIdToUpdate}/`, {
                data: updatedTeamData,
            });
            expect(response.status()).toBe(200);
            const updatedTeam = await response.json();
            expect(updatedTeam).toHaveProperty('id', teamIdToUpdate);
            expect(updatedTeam).toMatchObject(updatedTeamData);
        });

        test('should return 404 for a non-existent team ID (negative path)', async ({ request }) => {
            const updatedTeamData = {
                name: 'Ghost Team',
            };
            const response = await request.put(`${TEAM_BASE_URL}/99999/`, {
                data: updatedTeamData,
            });
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', 'Team not found!');
        });

        test('should return 422 for invalid team ID (path param constraint violation)', async ({ request }) => {
            const updatedTeamData = {
                name: 'Invalid ID Team',
            };
            const response = await request.put(`${TEAM_BASE_URL}/0/`, {
                data: updatedTeamData,
            });
            expect(response.status()).toBe(422);
        });

        test('should return 422 for invalid payload (missing required field)', async ({ request }) => {
            const invalidTeam = {
                // name is missing
            };
            const response = await request.put(`${TEAM_BASE_URL}/${teamIdToUpdate}/`, {
                data: invalidTeam,
            });
            expect(response.status()).toBe(422);
        });
    });
});

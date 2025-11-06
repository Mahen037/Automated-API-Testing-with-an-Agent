import { test, expect, APIRequestContext } from '@playwright/test';

// Define the base URL for the API
const BASE_URL = 'http://localhost:8080';

test.describe('Team Service API Tests', () => {
    test('GET /teams/ should return all teams', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/teams/`);
        expect(response.status()).toBe(200);
        const teamList = await response.json();
        expect(Array.isArray(teamList)).toBeTruthy();
    });

    test('POST /teams/ should create a new team', async ({ request }) => {
        const newTeam = {
            name: 'Valor',
        };
        const response = await request.post(`${BASE_URL}/teams/`, {
            data: newTeam,
        });
        expect(response.status()).toBe(201);
        const createdTeam = await response.json();
        expect(createdTeam).toMatchObject({
            id: expect.any(Number),
            name: newTeam.name,
        });

        // Clean up the created team
        await request.delete(`${BASE_URL}/teams/${createdTeam.id}/`);
    });

    test('GET /teams/{id}/ should return a specific team', async ({ request }) => {
        // First create a team to retrieve
        const newTeam = {
            name: 'Mystic',
        };
        const createResponse = await request.post(`${BASE_URL}/teams/`, {
            data: newTeam,
        });
        expect(createResponse.status()).toBe(201);
        const createdTeam = await createResponse.json();

        const getResponse = await request.get(`${BASE_URL}/teams/${createdTeam.id}/`);
        expect(getResponse.status()).toBe(200);
        const retrievedTeam = await getResponse.json();
        expect(retrievedTeam).toMatchObject(createdTeam);

        // Clean up
        await request.delete(`${BASE_URL}/teams/${createdTeam.id}/`);
    });

    test('GET /teams/{id}/ should return 404 for a non-existent team', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/teams/99999/`); // Non-existent ID
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('PUT /teams/{id}/ should update an existing team', async ({ request }) => {
        // First create a team to update
        const originalTeam = {
            name: 'Instinct',
        };
        const createResponse = await request.post(`${BASE_URL}/teams/`, {
            data: originalTeam,
        });
        expect(createResponse.status()).toBe(201);
        const createdTeam = await createResponse.json();

        const updatedTeamData = {
            name: 'Harmony',
        };
        const updateResponse = await request.put(`${BASE_URL}/teams/${createdTeam.id}/`, {
            data: updatedTeamData,
        });
        expect(updateResponse.status()).toBe(200);
        const updatedTeam = await updateResponse.json();
        expect(updatedTeam).toMatchObject({
            id: createdTeam.id,
            name: updatedTeamData.name,
        });

        // Clean up
        await request.delete(`${BASE_URL}/teams/${createdTeam.id}/`);
    });

    test('PUT /teams/{id}/ should return 404 for updating a non-existent team', async ({ request }) => {
        const updatedTeamData = {
            name: 'Phantom',
        };
        const response = await request.put(`${BASE_URL}/teams/99999/`, { // Non-existent ID
            data: updatedTeamData,
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('DELETE /teams/{id}/ should delete an existing team', async ({ request }) => {
        // First create a team to delete
        const newTeam = {
            name: 'Rocket',
        };
        const createResponse = await request.post(`${BASE_URL}/teams/`, {
            data: newTeam,
        });
        expect(createResponse.status()).toBe(201);
        const createdTeam = await createResponse.json();

        const deleteResponse = await request.delete(`${BASE_URL}/teams/${createdTeam.id}/`);
        expect(deleteResponse.status()).toBe(200);
        expect(await deleteResponse.json()).toBe(createdTeam.id); // Expecting the ID of the deleted team

        // Verify it's actually deleted
        const getResponse = await request.get(`${BASE_URL}/teams/${createdTeam.id}/`);
        expect(getResponse.status()).toBe(404);
    });

    test('DELETE /teams/{id}/ should return 404 for a non-existent team', async ({ request }) => {
        const response = await request.delete(`${BASE_URL}/teams/99999/`); // Non-existent ID
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });
});
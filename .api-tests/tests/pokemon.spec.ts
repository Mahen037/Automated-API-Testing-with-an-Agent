import { test, expect, APIRequestContext } from '@playwright/test';

// Define the base URL for the API
const BASE_URL = 'http://localhost:8080';

// Helper function to create a team for testing purposes
async function createTeam(request: APIRequestContext, name: string) {
    const response = await request.post(`${BASE_URL}/teams/`, {
        data: { name },
    });
    expect(response.status()).toBe(201);
    return response.json();
}

// Helper function to delete a team
async function deleteTeam(request: APIRequestContext, id: number) {
    const response = await request.delete(`${BASE_URL}/teams/${id}/`);
    expect(response.status()).toBe(200);
    return response.json();
}

test.describe('Pokemon Service API Tests', () => {
    let teamId: number;

    test.beforeAll(async ({ request }) => {
        // Create a team before all tests that require a valid team_id
        const team = await createTeam(request, 'Test Team for Pokemon Service');
        teamId = team.id;
        expect(teamId).toBeDefined();
    });

    test.afterAll(async ({ request }) => {
        // Clean up the created team after all tests
        if (teamId) {
            await deleteTeam(request, teamId);
        }
    });

    test('GET /pokemon/ should return all pokemon', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/pokemon/`);
        expect(response.status()).toBe(200);
        const pokemonList = await response.json();
        expect(Array.isArray(pokemonList)).toBeTruthy();
    });

    test('POST /pokemon/ should create a new pokemon', async ({ request }) => {
        const newPokemon = {
            name: 'Pikachu',
            type: 'Electric',
            team_id: teamId, // Use the dynamically created teamId
        };
        const response = await request.post(`${BASE_URL}/pokemon/`, {
            data: newPokemon,
        });
        expect(response.status()).toBe(201);
        const createdPokemon = await response.json();
        expect(createdPokemon).toMatchObject({
            id: expect.any(Number),
            name: newPokemon.name,
            type: newPokemon.type,
            team_id: newPokemon.team_id,
        });

        // Clean up the created pokemon
        await request.delete(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
    });

    test('POST /pokemon/ should return 404 if team_id does not exist', async ({ request }) => {
        const newPokemon = {
            name: 'Charmander',
            type: 'Fire',
            team_id: 99999, // Non-existent team_id
        };
        const response = await request.post(`${BASE_URL}/pokemon/`, {
            data: newPokemon,
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: `Team with id:${newPokemon.team_id} not found!` });
    });

    test('GET /pokemon/{id}/ should return a specific pokemon', async ({ request }) => {
        // First create a pokemon to retrieve
        const newPokemon = {
            name: 'Squirtle',
            type: 'Water',
            team_id: teamId,
        };
        const createResponse = await request.post(`${BASE_URL}/pokemon/`, {
            data: newPokemon,
        });
        expect(createResponse.status()).toBe(201);
        const createdPokemon = await createResponse.json();

        const getResponse = await request.get(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
        expect(getResponse.status()).toBe(200);
        const retrievedPokemon = await getResponse.json();
        expect(retrievedPokemon).toMatchObject(createdPokemon);

        // Clean up
        await request.delete(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
    });

    test('GET /pokemon/{id}/ should return 404 for a non-existent pokemon', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/pokemon/99999/`); // Non-existent ID
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('PUT /pokemon/{id}/ should update an existing pokemon', async ({ request }) => {
        // First create a pokemon to update
        const originalPokemon = {
            name: 'Bulbasaur',
            type: 'Grass',
            team_id: teamId,
        };
        const createResponse = await request.post(`${BASE_URL}/pokemon/`, {
            data: originalPokemon,
        });
        expect(createResponse.status()).toBe(201);
        const createdPokemon = await createResponse.json();

        const updatedPokemonData = {
            name: 'Ivysaur',
            type: 'Poison',
            team_id: teamId,
        };
        const updateResponse = await request.put(`${BASE_URL}/pokemon/${createdPokemon.id}/`, {
            data: updatedPokemonData,
        });
        expect(updateResponse.status()).toBe(200);
        const updatedPokemon = await updateResponse.json();
        expect(updatedPokemon).toMatchObject({
            id: createdPokemon.id,
            name: updatedPokemonData.name,
            type: updatedPokemonData.type,
            team_id: updatedPokemonData.team_id,
        });

        // Clean up
        await request.delete(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
    });

    test('PUT /pokemon/{id}/ should return 404 for updating a non-existent pokemon', async ({ request }) => {
        const updatedPokemonData = {
            name: 'Missingno',
            type: 'Bird',
            team_id: teamId,
        };
        const response = await request.put(`${BASE_URL}/pokemon/99999/`, { // Non-existent ID
            data: updatedPokemonData,
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('PUT /pokemon/{id}/ should return 404 if team_id does not exist for an existing pokemon', async ({ request }) => {
        // First create a pokemon
        const originalPokemon = {
            name: 'Jigglypuff',
            type: 'Normal',
            team_id: teamId,
        };
        const createResponse = await request.post(`${BASE_URL}/pokemon/`, {
            data: originalPokemon,
        });
        expect(createResponse.status()).toBe(201);
        const createdPokemon = await createResponse.json();

        const updatedPokemonData = {
            name: 'Wigglytuff',
            type: 'Fairy',
            team_id: 99999, // Non-existent team_id
        };
        const updateResponse = await request.put(`${BASE_URL}/pokemon/${createdPokemon.id}/`, {
            data: updatedPokemonData,
        });
        expect(updateResponse.status()).toBe(404);
        expect(await updateResponse.json()).toEqual({ detail: `Team with id:${updatedPokemonData.team_id} not found!` });

        // Clean up
        await request.delete(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
    });

    test('DELETE /pokemon/{id}/ should delete an existing pokemon', async ({ request }) => {
        // First create a pokemon to delete
        const newPokemon = {
            name: 'Snorlax',
            type: 'Normal',
            team_id: teamId,
        };
        const createResponse = await request.post(`${BASE_URL}/pokemon/`, {
            data: newPokemon,
        });
        expect(createResponse.status()).toBe(201);
        const createdPokemon = await createResponse.json();

        const deleteResponse = await request.delete(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
        expect(deleteResponse.status()).toBe(200);
        expect(await deleteResponse.json()).toBe(createdPokemon.id); // Expecting the ID of the deleted pokemon

        // Verify it's actually deleted
        const getResponse = await request.get(`${BASE_URL}/pokemon/${createdPokemon.id}/`);
        expect(getResponse.status()).toBe(404);
    });

    test('DELETE /pokemon/{id}/ should return 404 for a non-existent pokemon', async ({ request }) => {
        const response = await request.delete(`${BASE_URL}/pokemon/99999/`); // Non-existent ID
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });
});

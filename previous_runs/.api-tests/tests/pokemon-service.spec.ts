import { test, expect, APIResponse } from '@playwright/test';

// Define the base URL for the pokemon-service, derived from the snapshot or environment
const POKEMON_SERVICE_BASE_URL = process.env.POKEMON_SERVICE_BASE_URL || 'http://localhost:8001';
const TEAM_SERVICE_BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:8002'; // TODO: Get this from team-service snapshot or env

// Helper function to create a team for testing purposes
async function createTeam(request: any, name: string): Promise<number> {
    const response = await request.post(`${TEAM_SERVICE_BASE_URL}/teams/`, {
        data: { name },
    });
    expect(response.status()).toBe(201);
    const team = await response.json();
    return team.id;
}

// Helper function to delete a team after testing
async function deleteTeam(request: any, teamId: number): Promise<void> {
    const response = await request.delete(`${TEAM_SERVICE_BASE_URL}/teams/${teamId}/`);
    expect(response.status()).toBe(200);
}

// Helper function to create a pokemon
async function createPokemon(request: any, name: string, type: string, team_id: number): Promise<any> {
    const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { name, type, team_id },
    });
    expect(response.status()).toBe(201);
    return await response.json();
}

// Helper function to delete a pokemon
async function deletePokemon(request: any, id: number): Promise<void> {
    const response = await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${id}/`);
    expect(response.status()).toBe(200);
}


test.describe('Pokemon Service API Tests', () => {
    let teamId: number; // To store the team ID for cross-service dependency

    test.beforeAll(async ({ request }) => {
        // Create a team before all tests that require it
        teamId = await createTeam(request, 'Test Team for Pokemon');
        expect(teamId).toBeGreaterThan(0);
    });

    test.afterAll(async ({ request }) => {
        // Clean up the created team after all tests
        if (teamId) {
            await deleteTeam(request, teamId);
        }
    });

    test('GET /pokemon/{id}/ - should retrieve a single pokemon by ID', async ({ request }) => {
        // Create a pokemon first to ensure it exists for retrieval
        const newPokemon = await createPokemon(request, 'Pikachu', 'Electric', teamId);

        const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${newPokemon.id}/`);
        expect(response.status()).toBe(200);
        const pokemon = await response.json();
        expect(pokemon).toEqual(expect.objectContaining({
            id: newPokemon.id,
            name: 'Pikachu',
            type: 'Electric',
            team_id: teamId,
        }));

        // Clean up the created pokemon
        await deletePokemon(request, newPokemon.id);
    });

    test('GET /pokemon/{id}/ - should return 404 for a non-existent pokemon ID', async ({ request }) => {
        const nonExistentId = 99999;
        const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('GET /pokemon/ - should retrieve all pokemon', async ({ request }) => {
        // Create a couple of pokemon to ensure the list is not empty
        const pokemon1 = await createPokemon(request, 'Charmander', 'Fire', teamId);
        const pokemon2 = await createPokemon(request, 'Squirtle', 'Water', teamId);

        const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/`);
        expect(response.status()).toBe(200);
        const allPokemon = await response.json();
        expect(Array.isArray(allPokemon)).toBe(true);
        expect(allPokemon.length).toBeGreaterThanOrEqual(2);
        expect(allPokemon).toContainEqual(expect.objectContaining({ id: pokemon1.id, name: 'Charmander' }));
        expect(allPokemon).toContainEqual(expect.objectContaining({ id: pokemon2.id, name: 'Squirtle' }));

        // Clean up
        await deletePokemon(request, pokemon1.id);
        await deletePokemon(request, pokemon2.id);
    });

    test('POST /pokemon/ - should create a new pokemon', async ({ request }) => {
        const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
            data: {
                name: 'Bulbasaur',
                type: 'Grass',
                team_id: teamId,
            },
        });
        expect(response.status()).toBe(201);
        const newPokemon = await response.json();
        expect(newPokemon).toEqual(expect.objectContaining({
            id: expect.any(Number),
            name: 'Bulbasaur',
            type: 'Grass',
            team_id: teamId,
        }));

        // Clean up
        await deletePokemon(request, newPokemon.id);
    });

    test('POST /pokemon/ - should return 404 for a non-existent team_id', async ({ request }) => {
        const nonExistentTeamId = 99999;
        const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
            data: {
                name: 'Jigglypuff',
                type: 'Fairy',
                team_id: nonExistentTeamId,
            },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: `Team with id:${nonExistentTeamId} not found!` });
    });

    test('POST /pokemon/ - should return 422 for missing required fields', async ({ request }) => {
        const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
            data: {
                name: 'Snorlax',
                // Missing type and team_id
            },
        });
        expect(response.status()).toBe(422); // Unprocessable Entity due to validation error
        expect(await response.json()).toEqual(expect.objectContaining({
            detail: expect.arrayContaining([
                expect.objectContaining({ loc: ['body', 'type'], msg: 'field required' }),
                expect.objectContaining({ loc: ['body', 'team_id'], msg: 'field required' }),
            ]),
        }));
    });

    test('DELETE /pokemon/{id}/ - should delete a pokemon by ID', async ({ request }) => {
        // Create a pokemon to delete
        const pokemonToDelete = await createPokemon(request, 'Eevee', 'Normal', teamId);

        const response = await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonToDelete.id}/`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toBe(pokemonToDelete.id);

        // Verify it's actually deleted
        const getResponse = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonToDelete.id}/`);
        expect(getResponse.status()).toBe(404);
    });

    test('DELETE /pokemon/{id}/ - should return 404 for a non-existent pokemon ID', async ({ request }) => {
        const nonExistentId = 99998;
        const response = await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('PUT /pokemon/{id}/ - should update an existing pokemon', async ({ request }) => {
        // Create a pokemon to update
        const pokemonToUpdate = await createPokemon(request, 'Mewtwo', 'Psychic', teamId);

        const updatedName = 'Mewtwo-X';
        const updatedType = 'Psychic-Fighting';
        const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonToUpdate.id}/`, {
            data: {
                name: updatedName,
                type: updatedType,
                team_id: teamId,
            },
        });
        expect(response.status()).toBe(200);
        const updatedPokemon = await response.json();
        expect(updatedPokemon).toEqual(expect.objectContaining({
            id: pokemonToUpdate.id,
            name: updatedName,
            type: updatedType,
            team_id: teamId,
        }));

        // Clean up
        await deletePokemon(request, pokemonToUpdate.id);
    });

    test('PUT /pokemon/{id}/ - should return 404 for a non-existent pokemon ID', async ({ request }) => {
        const nonExistentId = 99997;
        const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${nonExistentId}/`, {
            data: {
                name: 'Ditto',
                type: 'Normal',
                team_id: teamId,
            },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('PUT /pokemon/{id}/ - should return 404 for a non-existent team_id', async ({ request }) => {
        // Create a pokemon first
        const pokemonToUpdate = await createPokemon(request, 'Zapdos', 'Electric', teamId);
        const nonExistentTeamId = 99996;

        const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonToUpdate.id}/`, {
            data: {
                name: 'Zapdos',
                type: 'Electric',
                team_id: nonExistentTeamId,
            },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: `Team with id:${nonExistentTeamId} not found!` });

        // Clean up
        await deletePokemon(request, pokemonToUpdate.id);
    });

    test('PUT /pokemon/{id}/ - should return 422 for missing required fields', async ({ request }) => {
        // Create a pokemon first
        const pokemonToUpdate = await createPokemon(request, 'Articuno', 'Ice', teamId);

        const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonToUpdate.id}/`, {
            data: {
                name: 'Articuno',
                // Missing type and team_id
            },
        });
        expect(response.status()).toBe(422);
        expect(await response.json()).toEqual(expect.objectContaining({
            detail: expect.arrayContaining([
                expect.objectContaining({ loc: ['body', 'type'], msg: 'field required' }),
                expect.objectContaining({ loc: ['body', 'team_id'], msg: 'field required' }),
            ]),
        }));

        // Clean up
        await deletePokemon(request, pokemonToUpdate.id);
    });
});
import { test, expect, APIRequestContext } from '@playwright/test';

const POKEMON_BASE_URL = process.env.POKEMON_BASE_URL || 'http://localhost:8080/pokemon';
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

// Helper function to create a pokemon for testing purposes
async function createPokemon(request: APIRequestContext, name: string, type: string, teamId: number): Promise<number> {
    const response = await request.post(`${POKEMON_BASE_URL}/`, {
        data: { name, type, team_id: teamId },
    });
    expect(response.status()).toBe(201);
    const pokemon = await response.json();
    return pokemon.id;
}

// Helper function to delete a pokemon
async function deletePokemon(request: APIRequestContext, id: number) {
    const response = await request.delete(`${POKEMON_BASE_URL}/${id}/`);
    expect(response.status()).toBe(200);
}

test.describe('Pokemon Service API Tests', () => {
    let teamId: number;
    test.beforeAll(async ({ request }) => {
        // Create a team before all tests that require a valid team_id
        teamId = await createTeam(request, 'Test Team');
    });

    test.afterAll(async ({ request }) => {
        // Clean up the created team after all tests
        if (teamId) {
            await deleteTeam(request, teamId);
        }
    });

    test.describe('GET /pokemon/{id}/', () => {
        let pokemonId: number;
        test.beforeEach(async ({ request }) => {
            // Create a pokemon before each test that requires a valid pokemon id
            pokemonId = await createPokemon(request, 'Pikachu', 'Electric', teamId);
        });

        test.afterEach(async ({ request }) => {
            // Clean up the created pokemon after each test
            if (pokemonId) {
                await deletePokemon(request, pokemonId);
            }
        });

        test('should return a pokemon by ID (happy path)', async ({ request }) => {
            const response = await request.get(`${POKEMON_BASE_URL}/${pokemonId}/`);
            expect(response.status()).toBe(200);
            const pokemon = await response.json();
            expect(pokemon).toHaveProperty('id', pokemonId);
            expect(pokemon).toHaveProperty('name', 'Pikachu');
        });

        test('should return 404 for a non-existent pokemon ID (negative path)', async ({ request }) => {
            const response = await request.get(`${POKEMON_BASE_URL}/99999/`);
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', 'Pokemon not found!');
        });

        test('should return 422 for invalid pokemon ID (path param constraint violation)', async ({ request }) => {
            // Path param 'id' has constraint 'gt 0'
            const response = await request.get(`${POKEMON_BASE_URL}/0/`);
            expect(response.status()).toBe(422);
        });
    });

    test.describe('GET /pokemon/', () => {
        test('should return all pokemon (happy path)', async ({ request }) => {
            // Create a temporary pokemon to ensure there's at least one
            const tempPokemonId = await createPokemon(request, 'Charmander', 'Fire', teamId);

            const response = await request.get(`${POKEMON_BASE_URL}/`);
            expect(response.status()).toBe(200);
            const pokemonList = await response.json();
            expect(Array.isArray(pokemonList)).toBeTruthy();
            expect(pokemonList.length).toBeGreaterThanOrEqual(1);

            // Clean up temporary pokemon
            await deletePokemon(request, tempPokemonId);
        });
    });

    test.describe('POST /pokemon/', () => {
        let pokemonId: number;
        test.afterEach(async ({ request }) => {
            // Clean up the created pokemon if the test was successful
            if (pokemonId) {
                await deletePokemon(request, pokemonId);
                pokemonId = 0; // Reset for next test
            }
        });

        test('should create a new pokemon (happy path)', async ({ request }) => {
            const newPokemon = {
                name: 'Bulbasaur',
                type: 'Grass',
                team_id: teamId,
            };
            const response = await request.post(`${POKEMON_BASE_URL}/`, {
                data: newPokemon,
            });
            expect(response.status()).toBe(201);
            const createdPokemon = await response.json();
            expect(createdPokemon).toHaveProperty('id');
            expect(createdPokemon).toMatchObject(newPokemon);
            pokemonId = createdPokemon.id;
        });

        test('should return 404 if team_id does not exist (negative path)', async ({ request }) => {
            const newPokemon = {
                name: 'Squirtle',
                type: 'Water',
                team_id: 99999, // Non-existent team ID
            };
            const response = await request.post(`${POKEMON_BASE_URL}/`, {
                data: newPokemon,
            });
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', `Team with id:${newPokemon.team_id} not found!`);
        });

        test('should return 422 for invalid payload (missing required field)', async ({ request }) => {
            const invalidPokemon = {
                name: 'Jigglypuff',
                // type is missing
                team_id: teamId,
            };
            const response = await request.post(`${POKEMON_BASE_URL}/`, {
                data: invalidPokemon,
            });
            expect(response.status()).toBe(422);
        });
    });

    test.describe('DELETE /pokemon/{id}/', () => {
        let pokemonIdToDelete: number;
        test.beforeEach(async ({ request }) => {
            pokemonIdToDelete = await createPokemon(request, 'Meowth', 'Normal', teamId);
        });

        test('should delete a pokemon by ID (happy path)', async ({ request }) => {
            const response = await request.delete(`${POKEMON_BASE_URL}/${pokemonIdToDelete}/`);
            expect(response.status()).toBe(200);
            expect(await response.json()).toBe(pokemonIdToDelete);

            // Verify it's actually deleted
            const getResponse = await request.get(`${POKEMON_BASE_URL}/${pokemonIdToDelete}/`);
            expect(getResponse.status()).toBe(404);
        });

        test('should return 404 for a non-existent pokemon ID (negative path)', async ({ request }) => {
            const response = await request.delete(`${POKEMON_BASE_URL}/99999/`);
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', 'Pokemon not found!');
        });

        test('should return 422 for invalid pokemon ID (path param constraint violation)', async ({ request }) => {
            const response = await request.delete(`${POKEMON_BASE_URL}/0/`);
            expect(response.status()).toBe(422);
        });
    });

    test.describe('PUT /pokemon/{id}/', () => {
        let pokemonIdToUpdate: number;
        test.beforeEach(async ({ request }) => {
            pokemonIdToUpdate = await createPokemon(request, 'Snorlax', 'Normal', teamId);
        });

        test.afterEach(async ({ request }) => {
            if (pokemonIdToUpdate) {
                await deletePokemon(request, pokemonIdToUpdate);
            }
        });

        test('should update an existing pokemon by ID (happy path)', async ({ request }) => {
            const updatedPokemonData = {
                name: 'Snorlax-Updated',
                type: 'Sleeping',
                team_id: teamId,
            };
            const response = await request.put(`${POKEMON_BASE_URL}/${pokemonIdToUpdate}/`, {
                data: updatedPokemonData,
            });
            expect(response.status()).toBe(200);
            const updatedPokemon = await response.json();
            expect(updatedPokemon).toHaveProperty('id', pokemonIdToUpdate);
            expect(updatedPokemon).toMatchObject(updatedPokemonData);
        });

        test('should return 404 for a non-existent pokemon ID (negative path)', async ({ request }) => {
            const updatedPokemonData = {
                name: 'Missingno',
                type: 'Glitch',
                team_id: teamId,
            };
            const response = await request.put(`${POKEMON_BASE_URL}/99999/`, {
                data: updatedPokemonData,
            });
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', 'Pokemon not found!');
        });

        test('should return 404 if team_id does not exist (negative path for team_id)', async ({ request }) => {
            const updatedPokemonData = {
                name: 'Pidgey',
                type: 'Flying',
                team_id: 99999, // Non-existent team ID
            };
            const response = await request.put(`${POKEMON_BASE_URL}/${pokemonIdToUpdate}/`, {
                data: updatedPokemonData,
            });
            expect(response.status()).toBe(404);
            expect(await response.json()).toHaveProperty('detail', `Team with id:${updatedPokemonData.team_id} not found!`);
        });

        test('should return 422 for invalid pokemon ID (path param constraint violation)', async ({ request }) => {
            const updatedPokemonData = {
                name: 'Snorlax-Updated',
                type: 'Sleeping',
                team_id: teamId,
            };
            const response = await request.put(`${POKEMON_BASE_URL}/0/`, {
                data: updatedPokemonData,
            });
            expect(response.status()).toBe(422);
        });

        test('should return 422 for invalid payload (missing required field)', async ({ request }) => {
            const invalidPokemon = {
                name: 'Gengar',
                // type is missing
                team_id: teamId,
            };
            const response = await request.put(`${POKEMON_BASE_URL}/${pokemonIdToUpdate}/`, {
                data: invalidPokemon,
            });
            expect(response.status()).toBe(422);
        });
    });
});
import { test, expect, APIResponse } from '@playwright/test';

const POKEMON_SERVICE_BASE_URL = process.env.POKEMON_SERVICE_BASE_URL || 'http://localhost:8001';
const TEAM_SERVICE_BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:8002';

test.describe('Pokemon Service API Tests', () => {

  let teamId: number;

  test.beforeAll(async ({ request }) => {
    // Create a team to be used for Pokemon creation/update tests
    const createTeamResponse = await request.post(`${TEAM_SERVICE_BASE_URL}/teams/`, {
      data: { name: 'Pokemon Test Team' },
    });
    expect(createTeamResponse.status()).toBe(201);
    const createdTeam = await createTeamResponse.json();
    teamId = createdTeam.id;
  });

  test.afterAll(async ({ request }) => {
    // Clean up the created team after all tests are done
    if (teamId) {
      const deleteTeamResponse = await request.delete(`${TEAM_SERVICE_BASE_URL}/teams/${teamId}/`);
      expect(deleteTeamResponse.status()).toBe(200);
    }
  });

  test.describe('GET /pokemon/{id}/', () => {
    let pokemonId: number;

    test.beforeEach(async ({ request }) => {
      // Create a pokemon for individual GET, PUT, DELETE tests
      const createPokemonResponse = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { name: 'Pikachu', type: 'Electric', team_id: teamId },
      });
      expect(createPokemonResponse.status()).toBe(201);
      const createdPokemon = await createPokemonResponse.json();
      pokemonId = createdPokemon.id;
    });

    test.afterEach(async ({ request }) => {
      // Clean up the created pokemon after each test
      if (pokemonId) {
        await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`);
      }
    });

    test('should return 200 and a pokemon if it exists', async ({ request }) => {
      const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`);
      expect(response.status()).toBe(200);
      const pokemon = await response.json();
      expect(pokemon).toHaveProperty('id', pokemonId);
      expect(pokemon).toHaveProperty('name', 'Pikachu');
      expect(pokemon).toHaveProperty('type', 'Electric');
      expect(pokemon).toHaveProperty('team_id', teamId);
    });

    test('should return 404 if pokemon does not exist', async ({ request }) => {
      const nonExistentId = 99999;
      const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${nonExistentId}/`);
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('should return 422 for invalid id (e.g., id <= 0)', async ({ request }) => {
      const invalidId = 0;
      const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${invalidId}/`);
      expect(response.status()).toBe(422);
      // TODO: Optionally assert on the specific error message structure for 422
    });
  });

  test.describe('GET /pokemon/', () => {
    test('should return 200 and a list of pokemon', async ({ request }) => {
      const response = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/`);
      expect(response.status()).toBe(200);
      const pokemonList = await response.json();
      expect(Array.isArray(pokemonList)).toBe(true);
    });
  });

  test.describe('POST /pokemon/', () => {
    test('should return 201 and create a new pokemon with valid payload', async ({ request }) => {
      const pokemonName = 'Charmander';
      const pokemonType = 'Fire';
      const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { name: pokemonName, type: pokemonType, team_id: teamId },
      });
      expect(response.status()).toBe(201);
      const pokemon = await response.json();
      expect(pokemon).toHaveProperty('id');
      expect(pokemon).toHaveProperty('name', pokemonName);
      expect(pokemon).toHaveProperty('type', pokemonType);
      expect(pokemon).toHaveProperty('team_id', teamId);

      // Clean up: Delete the created pokemon
      await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemon.id}/`);
    });

    test('should return 422 with invalid payload (missing name)', async ({ request }) => {
      const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { type: 'Water', team_id: teamId }, // Missing 'name' field
      });
      expect(response.status()).toBe(422);
      // TODO: Optionally assert on the specific error message structure for 422
    });

    test('should return 404 if team_id does not exist', async ({ request }) => {
      const nonExistentTeamId = 99999;
      const response = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { name: 'Squirtle', type: 'Water', team_id: nonExistentTeamId },
      });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ detail: `Team with id:${nonExistentTeamId} not found!` });
    });
  });

  test.describe('DELETE /pokemon/{id}/', () => {
    let pokemonId: number;

    test.beforeEach(async ({ request }) => {
      // Create a pokemon for deletion
      const createPokemonResponse = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { name: 'Bulbasaur', type: 'Grass', team_id: teamId },
      });
      expect(createPokemonResponse.status()).toBe(201);
      const createdPokemon = await createPokemonResponse.json();
      pokemonId = createdPokemon.id;
    });

    test('should return 200 and delete a pokemon if it exists', async ({ request }) => {
      const response = await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`);
      expect(response.status()).toBe(200);
      expect(await response.json()).toBe(pokemonId);

      // Verify deletion
      const getResponse = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`);
      expect(getResponse.status()).toBe(404);
      pokemonId = 0; // Clear pokemonId to prevent afterEach from trying to delete again
    });

    test('should return 404 if pokemon does not exist', async ({ request }) => {
      const nonExistentId = 99998;
      const response = await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${nonExistentId}/`);
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('should return 422 for invalid id (e.g., id <= 0)', async ({ request }) => {
      const invalidId = 0;
      const response = await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${invalidId}/`);
      expect(response.status()).toBe(422);
      // TODO: Optionally assert on the specific error message structure for 422
    });
  });

  test.describe('PUT /pokemon/{id}/', () => {
    let pokemonId: number;

    test.beforeEach(async ({ request }) => {
      // Create a pokemon for update
      const createPokemonResponse = await request.post(`${POKEMON_SERVICE_BASE_URL}/pokemon/`, {
        data: { name: 'Eevee', type: 'Normal', team_id: teamId },
      });
      expect(createPokemonResponse.status()).toBe(201);
      const createdPokemon = await createPokemonResponse.json();
      pokemonId = createdPokemon.id;
    });

    test.afterEach(async ({ request }) => {
      // Clean up the created pokemon after each test
      if (pokemonId) {
        await request.delete(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`);
      }
    });

    test('should return 200 and update a pokemon with valid payload', async ({ request }) => {
      const updatedName = 'Jolteon';
      const updatedType = 'Electric';
      const putResponse = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`, {
        data: { name: updatedName, type: updatedType, team_id: teamId },
      });
      expect(putResponse.status()).toBe(200);
      const updatedPokemon = await putResponse.json();
      expect(updatedPokemon).toHaveProperty('id', pokemonId);
      expect(updatedPokemon).toHaveProperty('name', updatedName);
      expect(updatedPokemon).toHaveProperty('type', updatedType);
      expect(updatedPokemon).toHaveProperty('team_id', teamId);

      // Verify the update
      const getResponse = await request.get(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`);
      expect(getResponse.status()).toBe(200);
      const fetchedPokemon = await getResponse.json();
      expect(fetchedPokemon).toHaveProperty('name', updatedName);
      expect(fetchedPokemon).toHaveProperty('type', updatedType);
    });

    test('should return 404 if pokemon does not exist', async ({ request }) => {
      const nonExistentId = 99997;
      const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${nonExistentId}/`, {
        data: { name: 'MissingMon', type: 'Ghost', team_id: teamId },
      });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('should return 422 with invalid payload (missing type)', async ({ request }) => {
      const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`, {
        data: { name: 'InvalidPayloadMon', team_id: teamId }, // Missing 'type' field
      });
      expect(response.status()).toBe(422);
      // TODO: Optionally assert on the specific error message structure for 422
    });

    test('should return 404 if team_id in payload does not exist', async ({ request }) => {
      const nonExistentTeamId = 99996;
      const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${pokemonId}/`, {
        data: { name: 'BadTeamMon', type: 'Dark', team_id: nonExistentTeamId },
      });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ detail: `Team with id:${nonExistentTeamId} not found!` });
    });

    test('should return 422 for invalid id (e.g., id <= 0)', async ({ request }) => {
      const invalidId = 0;
      const response = await request.put(`${POKEMON_SERVICE_BASE_URL}/pokemon/${invalidId}/`, {
        data: { name: 'InvalidIDMon', type: 'Normal', team_id: teamId },
      });
      expect(response.status()).toBe(422);
      // TODO: Optionally assert on the specific error message structure for 422
    });
  });
});

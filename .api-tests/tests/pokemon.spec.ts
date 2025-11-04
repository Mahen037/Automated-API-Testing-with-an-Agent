
import { test, expect, APIResponse } from '@playwright/test';

test.describe('Pokemon Service API', () => {

  const BASE_URL = 'http://localhost:8000'; // Assuming the service runs locally

  // Helper function to create a pokemon for tests that require an existing pokemon
  async function createPokemon(request: any, name: string, type: string, team_id: number): Promise<any> {
    const response = await request.post(`${BASE_URL}/pokemon/`, {
      data: { name, type, team_id }
    });
    expect(response.status()).toBe(201);
    return response.json();
  }

  // Helper function to create a team if needed for valid team_id, but here just assuming team_id 1 exists
  // For now, we'll assume team_id 1 always exists for positive test cases.
  // And 999 for negative team_id cases.

  test('GET /pokemon/{id}/ - should return a pokemon by ID', async ({ request }) => {
    // Assuming a pokemon with ID 1 exists for this positive test case.
    // In a real scenario, you might create one first or retrieve an existing one.
    const pokemonId = 1;
    const response = await request.get(`${BASE_URL}/pokemon/${pokemonId}/`);
    expect(response.status()).toBe(200);
    const pokemon = await response.json();
    expect(pokemon).toHaveProperty('id', pokemonId);
    expect(pokemon).toHaveProperty('name');
    expect(pokemon).toHaveProperty('type');
    expect(pokemon).toHaveProperty('team_id');
    // Further schema validation could be added here if a detailed schema is provided
  });

  test('GET /pokemon/{id}/ - should return 404 for non-existent pokemon', async ({ request }) => {
    const nonExistentPokemonId = 999;
    const response = await request.get(`${BASE_URL}/pokemon/${nonExistentPokemonId}/`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
  });

  test('GET /pokemon/ - should return all pokemon', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/pokemon/`);
    expect(response.status()).toBe(200);
    const pokemonList = await response.json();
    expect(Array.isArray(pokemonList)).toBe(true);
    // Optionally check if the list contains objects conforming to PokemonResponseSchema
    if (pokemonList.length > 0) {
      expect(pokemonList[0]).toHaveProperty('id');
      expect(pokemonList[0]).toHaveProperty('name');
      expect(pokemonList[0]).toHaveProperty('type');
      expect(pokemonList[0]).toHaveProperty('team_id');
    }
  });

  test('POST /pokemon/ - should create a new pokemon', async ({ request }) => {
    const newPokemon = {
      name: 'Pikachu',
      type: 'Electric',
      team_id: 1 // Assuming team_id 1 exists
    };
    const response = await request.post(`${BASE_URL}/pokemon/`, {
      data: newPokemon
    });
    expect(response.status()).toBe(201);
    const createdPokemon = await response.json();
    expect(createdPokemon).toHaveProperty('id');
    expect(createdPokemon).toHaveProperty('name', newPokemon.name);
    expect(createdPokemon).toHaveProperty('type', newPokemon.type);
    expect(createdPokemon).toHaveProperty('team_id', newPokemon.team_id);
  });

  test('POST /pokemon/ - should return 404 if team_id does not exist', async ({ request }) => {
    const newPokemonWithInvalidTeam = {
      name: 'Charmander',
      type: 'Fire',
      team_id: 999 // Assuming team_id 999 does not exist
    };
    const response = await request.post(`${BASE_URL}/pokemon/`, {
      data: newPokemonWithInvalidTeam
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: `Team with id:${newPokemonWithInvalidTeam.team_id} not found!` });
  });

  test('PUT /pokemon/{id}/ - should update an existing pokemon', async ({ request }) => {
    // First, create a pokemon to update
    const created = await createPokemon(request, 'Bulbasaur', 'Grass', 1);
    const pokemonIdToUpdate = created.id;

    const updatedPokemonData = {
      name: 'Bulbasaur-Updated',
      type: 'Grass/Poison',
      team_id: 1
    };
    const response = await request.put(`${BASE_URL}/pokemon/${pokemonIdToUpdate}/`, {
      data: updatedPokemonData
    });
    expect(response.status()).toBe(200);
    const updatedPokemon = await response.json();
    expect(updatedPokemon).toHaveProperty('id', pokemonIdToUpdate);
    expect(updatedPokemon).toHaveProperty('name', updatedPokemonData.name);
    expect(updatedPokemon).toHaveProperty('type', updatedPokemonData.type);
    expect(updatedPokemon).toHaveProperty('team_id', updatedPokemonData.team_id);
  });

  test('PUT /pokemon/{id}/ - should return 404 for non-existent pokemon during update', async ({ request }) => {
    const nonExistentPokemonId = 999;
    const updatedPokemonData = {
      name: 'Missingno',
      type: 'Glitch',
      team_id: 1
    };
    const response = await request.put(`${BASE_URL}/pokemon/${nonExistentPokemonId}/`, {
      data: updatedPokemonData
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
  });

  test('PUT /pokemon/{id}/ - should return 404 if team_id does not exist during update', async ({ request }) => {
    // First, create a pokemon to attempt to update with an invalid team_id
    const created = await createPokemon(request, 'Squirtle', 'Water', 1);
    const pokemonIdToUpdate = created.id;

    const updatedPokemonData = {
      name: 'Squirtle-Updated',
      type: 'Water',
      team_id: 999 // Invalid team_id
    };
    const response = await request.put(`${BASE_URL}/pokemon/${pokemonIdToUpdate}/`, {
      data: updatedPokemonData
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: `Team with id:${updatedPokemonData.team_id} not found!` });
  });


  test('DELETE /pokemon/{id}/ - should delete an existing pokemon', async ({ request }) => {
    // First, create a pokemon to delete
    const created = await createPokemon(request, 'Charmander', 'Fire', 1);
    const pokemonIdToDelete = created.id;

    const response = await request.delete(`${BASE_URL}/pokemon/${pokemonIdToDelete}/`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toBe(pokemonIdToDelete);

    // Verify it's actually deleted
    const getResponse = await request.get(`${BASE_URL}/pokemon/${pokemonIdToDelete}/`);
    expect(getResponse.status()).toBe(404);
  });

  test('DELETE /pokemon/{id}/ - should return 404 for non-existent pokemon', async ({ request }) => {
    const nonExistentPokemonId = 999;
    const response = await request.delete(`${BASE_URL}/pokemon/${nonExistentPokemonId}/`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
  });

});

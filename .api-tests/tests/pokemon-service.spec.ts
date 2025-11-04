
import { test, expect } from '@playwright/test';

test.describe('Pokemon Service API Tests', () => {
  const BASE_URL = 'http://localhost:8001'; // TODO: Replace with actual base URL for the pokemon service

  test('GET /pokemon/ should return a list of pokemons', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/pokemon/`);
    expect(response.ok()).toBeTruthy();
    const pokemons = await response.json();
    expect(Array.isArray(pokemons)).toBe(true);
    // TODO: Add more specific assertions about the structure or content if known
  });

  test('POST /pokemon/ should create a new pokemon', async ({ request }) => {
    const newPokemon = {
      name: 'TestPokemon',
      type: 'Fire',
      abilities: ['Blaze'],
      hp: 100,
      attack: 50,
      defense: 50,
      speed: 50
    };
    const response = await request.post(`${BASE_URL}/pokemon/`, { data: newPokemon });
    expect(response.ok()).toBeTruthy();
    const createdPokemon = await response.json();
    expect(createdPokemon).toMatchObject(newPokemon);
    expect(createdPokemon.id).toBeDefined(); // Assuming the service assigns an ID
    // TODO: Store this ID for subsequent tests (e.g., PUT, DELETE)
  });

  test('POST /pokemon/ should fail with invalid data', async ({ request }) => {
    const invalidPokemon = {
      name: 'Invalid',
      // Missing 'type' field which might be required
      hp: 10
    };
    const response = await request.post(`${BASE_URL}/pokemon/`, { data: invalidPokemon });
    expect(response.status()).toBe(422); // Unprocessable Entity for validation errors
    // TODO: Assert specific error message if available and consistent
  });

  test('GET /pokemon/{id}/ should return a specific pokemon', async ({ request }) => {
    // Pre-create a pokemon to fetch
    const newPokemon = {
      name: 'FetchablePokemon',
      type: 'Water',
      abilities: ['Torrent'],
      hp: 100,
      attack: 50,
      defense: 50,
      speed: 50
    };
    const createResponse = await request.post(`${BASE_URL}/pokemon/`, { data: newPokemon });
    expect(createResponse.ok()).toBeTruthy();
    const createdPokemon = await createResponse.json();
    const pokemonId = createdPokemon.id;

    const response = await request.get(`${BASE_URL}/pokemon/${pokemonId}/`);
    expect(response.ok()).toBeTruthy();
    const fetchedPokemon = await response.json();
    expect(fetchedPokemon).toMatchObject(newPokemon);
    expect(fetchedPokemon.id).toBe(pokemonId);
  });

  test('GET /pokemon/{id}/ should return 404 for non-existent pokemon', async ({ request }) => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999'; // Assuming UUID or similar format
    const response = await request.get(`${BASE_URL}/pokemon/${nonExistentId}/`);
    expect(response.status()).toBe(404);
  });

  test('PUT /pokemon/{id}/ should update an existing pokemon', async ({ request }) => {
    // Pre-create a pokemon to update
    const newPokemon = {
      name: 'UpdatablePokemon',
      type: 'Grass',
      abilities: ['Overgrow'],
      hp: 80,
      attack: 40,
      defense: 40,
      speed: 40
    };
    const createResponse = await request.post(`${BASE_URL}/pokemon/`, { data: newPokemon });
    expect(createResponse.ok()).toBeTruthy();
    const createdPokemon = await createResponse.json();
    const pokemonId = createdPokemon.id;

    const updatedData = {
      name: 'UpdatedUpdatablePokemon',
      hp: 90,
      attack: 45
    };
    const response = await request.put(`${BASE_URL}/pokemon/${pokemonId}/`, { data: updatedData });
    expect(response.ok()).toBeTruthy();
    const updatedPokemon = await response.json();
    expect(updatedPokemon.id).toBe(pokemonId);
    expect(updatedPokemon.name).toBe(updatedData.name);
    expect(updatedPokemon.hp).toBe(updatedData.hp);
    expect(updatedPokemon.attack).toBe(updatedData.attack);
    // Ensure other fields not updated remain the same if partial update is supported
    expect(updatedPokemon.type).toBe(newPokemon.type);
    // TODO: Verify all fields are updated or merged correctly based on API behavior
  });

  test('PUT /pokemon/{id}/ should return 404 for non-existent pokemon', async ({ request }) => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999';
    const updatedData = { name: 'NonExistent', hp: 1 };
    const response = await request.put(`${BASE_URL}/pokemon/${nonExistentId}/`, { data: updatedData });
    expect(response.status()).toBe(404);
  });

  test('DELETE /pokemon/{id}/ should delete a pokemon', async ({ request }) => {
    // Pre-create a pokemon to delete
    const newPokemon = {
      name: 'DeletablePokemon',
      type: 'Electric',
      abilities: ['Static'],
      hp: 70,
      attack: 30,
      defense: 30,
      speed: 30
    };
    const createResponse = await request.post(`${BASE_URL}/pokemon/`, { data: newPokemon });
    expect(createResponse.ok()).toBeTruthy();
    const createdPokemon = await createResponse.json();
    const pokemonId = createdPokemon.id;

    const deleteResponse = await request.delete(`${BASE_URL}/pokemon/${pokemonId}/`);
    expect(deleteResponse.ok()).toBeTruthy();
    expect(deleteResponse.status()).toBe(204); // Expecting 204 No Content for successful deletion

    // Verify deletion by trying to get the pokemon
    const getResponse = await request.get(`${BASE_URL}/pokemon/${pokemonId}/`);
    expect(getResponse.status()).toBe(404);
  });

  test('DELETE /pokemon/{id}/ should return 404 for non-existent pokemon', async ({ request }) => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999';
    const response = await request.delete(`${BASE_URL}/pokemon/${nonExistentId}/`);
    expect(response.status()).toBe(404);
  });
});

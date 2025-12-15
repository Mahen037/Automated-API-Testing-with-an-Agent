import { test, expect } from '@playwright/test';

const POKEMON_BASE_URL = process.env.POKEMON_SERVICE_BASE_URL || 'http://localhost:8001';
const TEAM_BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:8002';

async function createTeam(request) {
  const response = await request.post(`${TEAM_BASE_URL}/teams/`, {
    data: { name: 'Pokemon Trainer Team' }
  });
  expect(response.status(), 'Failed to create team dependency').toBe(201);
  const body = await response.json();
  return body.id;
}

test.describe('pokemon-service', () => {

  test.describe('GET /pokemon/', () => {
    test('should return list of pokemon', async ({ request }) => {
      const response = await request.get(`${POKEMON_BASE_URL}/pokemon/`);
      expect(response.status()).toBe(200);
      expect(Array.isArray(await response.json())).toBeTruthy();
    });
  });

  test.describe('POST /pokemon/', () => {
    test('should create a new pokemon', async ({ request }) => {
      const teamId = await createTeam(request);
      const payload = { name: 'Pikachu', type: 'Electric', team_id: teamId };
      const response = await request.post(`${POKEMON_BASE_URL}/pokemon/`, { data: payload });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('Pikachu');
      expect(body.team_id).toBe(teamId);
    });

    test('should return 404 if team does not exist', async ({ request }) => {
      const payload = { name: 'Mew', type: 'Psychic', team_id: 999999 };
      const response = await request.post(`${POKEMON_BASE_URL}/pokemon/`, { data: payload });
      expect(response.status()).toBe(404);
    });
  });

  test.describe('GET /pokemon/{id}/', () => {
    test('should return pokemon details', async ({ request }) => {
      const teamId = await createTeam(request);
      const createResponse = await request.post(`${POKEMON_BASE_URL}/pokemon/`, {
        data: { name: 'Charmander', type: 'Fire', team_id: teamId }
      });
      const created = await createResponse.json();

      const response = await request.get(`${POKEMON_BASE_URL}/pokemon/${created.id}/`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(created.id);
    });

    test('should return 404 for non-existent pokemon', async ({ request }) => {
      const response = await request.get(`${POKEMON_BASE_URL}/pokemon/999999/`);
      expect(response.status()).toBe(404);
    });
  });

  test.describe('PUT /pokemon/{id}/', () => {
    test('should update pokemon details', async ({ request }) => {
      const teamId = await createTeam(request);
      const createResponse = await request.post(`${POKEMON_BASE_URL}/pokemon/`, {
        data: { name: 'Bulbasaur', type: 'Grass', team_id: teamId }
      });
      const created = await createResponse.json();

      const updatePayload = { name: 'Ivysaur', type: 'Grass/Poison', team_id: teamId };
      const response = await request.put(`${POKEMON_BASE_URL}/pokemon/${created.id}/`, { data: updatePayload });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Ivysaur');
    });

    test('should return 404 for non-existent pokemon', async ({ request }) => {
      // Need valid payload to pass validation, but invalid ID
      const teamId = await createTeam(request);
      const payload = { name: 'Ghost', type: 'Ghost', team_id: teamId };
      const response = await request.put(`${POKEMON_BASE_URL}/pokemon/999999/`, { data: payload });
      expect(response.status()).toBe(404);
    });
  });

  test.describe('DELETE /pokemon/{id}/', () => {
    test('should delete pokemon', async ({ request }) => {
      const teamId = await createTeam(request);
      const createResponse = await request.post(`${POKEMON_BASE_URL}/pokemon/`, {
        data: { name: 'Squirtle', type: 'Water', team_id: teamId }
      });
      const created = await createResponse.json();

      const response = await request.delete(`${POKEMON_BASE_URL}/pokemon/${created.id}/`);
      expect(response.status()).toBe(200);
      // Snapshot implies response body is the integer ID
      expect(await response.json()).toBe(created.id);
    });

    test('should return 404 for non-existent pokemon', async ({ request }) => {
      const response = await request.delete(`${POKEMON_BASE_URL}/pokemon/999999/`);
      expect(response.status()).toBe(404);
    });
  });

});

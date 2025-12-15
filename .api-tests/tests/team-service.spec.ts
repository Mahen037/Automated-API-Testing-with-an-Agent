import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:8002';

test.describe('team-service', () => {

  test.describe('GET /teams/', () => {
    test('should return list of teams', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/teams/`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBeTruthy();
    });
  });

  test.describe('POST /teams/', () => {
    test('should create a new team', async ({ request }) => {
      const payload = { name: 'Test Team' };
      const response = await request.post(`${BASE_URL}/teams/`, { data: payload });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.name).toBe(payload.name);
      expect(body.id).toBeDefined();
    });
  });

  test.describe('GET /teams/{id}/', () => {
    test('should return team details', async ({ request }) => {
      // Setup
      const createResponse = await request.post(`${BASE_URL}/teams/`, { data: { name: 'Team For Get' } });
      const created = await createResponse.json();
      const id = created.id;

      const response = await request.get(`${BASE_URL}/teams/${id}/`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(id);
    });

    test('should return 404 for non-existent team', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/teams/999999/`);
      expect(response.status()).toBe(404);
    });
  });

  test.describe('PUT /teams/{id}/', () => {
    test('should update team details', async ({ request }) => {
      // Setup
      const createResponse = await request.post(`${BASE_URL}/teams/`, { data: { name: 'Team For Update' } });
      const created = await createResponse.json();
      const id = created.id;

      const response = await request.put(`${BASE_URL}/teams/${id}/`, { data: { name: 'Updated Team' } });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Updated Team');
      expect(body.id).toBe(id);
    });

    test('should return 404 for non-existent team', async ({ request }) => {
      const response = await request.put(`${BASE_URL}/teams/999999/`, { data: { name: 'Ghost' } });
      expect(response.status()).toBe(404);
    });
  });

  test.describe('DELETE /teams/{id}/', () => {
    test('should delete team', async ({ request }) => {
      // Setup
      const createResponse = await request.post(`${BASE_URL}/teams/`, { data: { name: 'Team For Delete' } });
      const created = await createResponse.json();
      const id = created.id;

      const response = await request.delete(`${BASE_URL}/teams/${id}/`);
      expect(response.status()).toBe(200);
      // The snapshot indicates the response body is the integer ID
      const body = await response.json();
      expect(body).toBe(id);
    });

    test('should return 404 for non-existent team', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/teams/999999/`);
      expect(response.status()).toBe(404);
    });
  });

});

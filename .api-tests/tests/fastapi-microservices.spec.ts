
import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

test.describe('Pokemon Service API Tests', () => {
    let apiContext: APIRequestContext;
    let createdPokemonId: number;
    let createdTeamIdForPokemon: number;

    test.beforeAll(async ({ playwright }) => {
        apiContext = await playwright.request.newContext({
            baseURL: BASE_URL,
            extraHTTPHeaders: {
                'Content-Type': 'application/json',
            },
        });

        // Setup: Create a team for pokemon tests
        const createTeamResponse = await apiContext.post('/teams/', {
            data: { name: 'Test Team for Pokemon' },
        });
        expect(createTeamResponse.ok()).toBeTruthy();
        const team = await createTeamResponse.json();
        createdTeamIdForPokemon = team.id;
    });

    test.afterAll(async () => {
        // Cleanup: Delete the created team
        if (createdTeamIdForPokemon) {
            await apiContext.delete(`/teams/${createdTeamIdForPokemon}/`);
        }
        await apiContext.dispose();
    });

    test('GET /pokemon/{id}/ - should retrieve a specific pokemon', async () => {
        // Create a pokemon first to retrieve it
        const createPokemonResponse = await apiContext.post('/pokemon/', {
            data: { name: 'Pikachu', type: 'Electric', team_id: createdTeamIdForPokemon },
        });
        expect(createPokemonResponse.status()).toBe(201);
        const newPokemon = await createPokemonResponse.json();
        const pokemonId = newPokemon.id;

        const response = await apiContext.get(`/pokemon/${pokemonId}/`);
        expect(response.status()).toBe(200);
        const pokemon = await response.json();
        expect(pokemon.id).toBe(pokemonId);
        expect(pokemon.name).toBe('Pikachu');
        expect(pokemon.type).toBe('Electric');
        expect(pokemon.team_id).toBe(createdTeamIdForPokemon);

        // Clean up the created pokemon
        await apiContext.delete(`/pokemon/${pokemonId}/`);
    });

    test('GET /pokemon/{id}/ - should return 404 for a non-existent pokemon', async () => {
        const nonExistentId = 99999;
        const response = await apiContext.get(`/pokemon/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('GET /pokemon/ - should retrieve all pokemon', async () => {
        // Create two pokemon to ensure list is not empty
        const pokemon1 = await apiContext.post('/pokemon/', {
            data: { name: 'Bulbasaur', type: 'Grass', team_id: createdTeamIdForPokemon },
        });
        expect(pokemon1.status()).toBe(201);
        const pokemon1Id = (await pokemon1.json()).id;

        const pokemon2 = await apiContext.post('/pokemon/', {
            data: { name: 'Charmander', type: 'Fire', team_id: createdTeamIdForPokemon },
        });
        expect(pokemon2.status()).toBe(201);
        const pokemon2Id = (await pokemon2.json()).id;

        const response = await apiContext.get('/pokemon/');
        expect(response.status()).toBe(200);
        const pokemonList = await response.json();
        expect(Array.isArray(pokemonList)).toBeTruthy();
        expect(pokemonList.length).toBeGreaterThanOrEqual(2);
        expect(pokemonList.some((p: any) => p.id === pokemon1Id && p.name === 'Bulbasaur')).toBeTruthy();
        expect(pokemonList.some((p: any) => p.id === pokemon2Id && p.name === 'Charmander')).toBeTruthy();

        // Clean up
        await apiContext.delete(`/pokemon/${pokemon1Id}/`);
        await apiContext.delete(`/pokemon/${pokemon2Id}/`);
    });

    test('POST /pokemon/ - should create a new pokemon', async () => {
        const response = await apiContext.post('/pokemon/', {
            data: { name: 'Squirtle', type: 'Water', team_id: createdTeamIdForPokemon },
        });
        expect(response.status()).toBe(201);
        const pokemon = await response.json();
        expect(pokemon.id).toBeDefined();
        expect(pokemon.name).toBe('Squirtle');
        expect(pokemon.type).toBe('Water');
        expect(pokemon.team_id).toBe(createdTeamIdForPokemon);
        createdPokemonId = pokemon.id;
    });

    test('POST /pokemon/ - should return 404 if team_id does not exist', async () => {
        const nonExistentTeamId = 99999;
        const response = await apiContext.post('/pokemon/', {
            data: { name: 'Jigglypuff', type: 'Normal', team_id: nonExistentTeamId },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: `Team with id:${nonExistentTeamId} not found!` });
    });

    test('POST /pokemon/ - should return 422 for invalid payload', async () => {
        const response = await apiContext.post('/pokemon/', {
            data: { name: 'MissingTypePokemon' }, // Missing 'type' and 'team_id'
        });
        expect(response.status()).toBe(422); // Unprocessable Entity
        const error = await response.json();
        expect(error.detail).toBeDefined();
    });

    test('PUT /pokemon/{id}/ - should update an existing pokemon', async () => {
        // Create a pokemon first
        const createResponse = await apiContext.post('/pokemon/', {
            data: { name: 'Originalmon', type: 'Normal', team_id: createdTeamIdForPokemon },
        });
        const originalPokemon = await createResponse.json();
        const pokemonIdToUpdate = originalPokemon.id;

        const updateResponse = await apiContext.put(`/pokemon/${pokemonIdToUpdate}/`, {
            data: { name: 'Updatedmon', type: 'Flying', team_id: createdTeamIdForPokemon },
        });
        expect(updateResponse.status()).toBe(200);
        const updatedPokemon = await updateResponse.json();
        expect(updatedPokemon.id).toBe(pokemonIdToUpdate);
        expect(updatedPokemon.name).toBe('Updatedmon');
        expect(updatedPokemon.type).toBe('Flying');

        // Clean up
        await apiContext.delete(`/pokemon/${pokemonIdToUpdate}/`);
    });

    test('PUT /pokemon/{id}/ - should return 404 for updating a non-existent pokemon', async () => {
        const nonExistentId = 99999;
        const response = await apiContext.put(`/pokemon/${nonExistentId}/`, {
            data: { name: 'Ghostmon', type: 'Ghost', team_id: createdTeamIdForPokemon },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });

    test('PUT /pokemon/{id}/ - should return 404 if team_id for update does not exist', async () => {
        // Create a pokemon first
        const createResponse = await apiContext.post('/pokemon/', {
            data: { name: 'Tempmon', type: 'Rock', team_id: createdTeamIdForPokemon },
        });
        const tempPokemon = await createResponse.json();
        const pokemonIdToUpdate = tempPokemon.id;
        const nonExistentTeamId = 99999;

        const response = await apiContext.put(`/pokemon/${pokemonIdToUpdate}/`, {
            data: { name: 'Tempmon', type: 'Rock', team_id: nonExistentTeamId },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: `Team with id:${nonExistentTeamId} not found!` });

        // Clean up
        await apiContext.delete(`/pokemon/${pokemonIdToUpdate}/`);
    });

    test('PUT /pokemon/{id}/ - should return 422 for invalid payload during update', async () => {
        // Create a pokemon first
        const createResponse = await apiContext.post('/pokemon/', {
            data: { name: 'IncompleteMon', type: 'Bug', team_id: createdTeamIdForPokemon },
        });
        const incompletePokemon = await createResponse.json();
        const pokemonIdToUpdate = incompletePokemon.id;

        const response = await apiContext.put(`/pokemon/${pokemonIdToUpdate}/`, {
            data: { name: 'UpdatedIncompleteMon' }, // Missing 'type' and 'team_id'
        });
        expect(response.status()).toBe(422); // Unprocessable Entity
        const error = await response.json();
        expect(error.detail).toBeDefined();

        // Clean up
        await apiContext.delete(`/pokemon/${pokemonIdToUpdate}/`);
    });

    test('DELETE /pokemon/{id}/ - should delete an existing pokemon', async () => {
        // Create a pokemon first to delete it
        const createResponse = await apiContext.post('/pokemon/', {
            data: { name: 'Deletemon', type: 'Poison', team_id: createdTeamIdForPokemon },
        });
        const pokemonToDelete = await createResponse.json();
        const pokemonId = pokemonToDelete.id;

        const response = await apiContext.delete(`/pokemon/${pokemonId}/`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toBe(pokemonId);

        // Verify it's deleted
        const getResponse = await apiContext.get(`/pokemon/${pokemonId}/`);
        expect(getResponse.status()).toBe(404);
    });

    test('DELETE /pokemon/{id}/ - should return 404 for deleting a non-existent pokemon', async () => {
        const nonExistentId = 99999;
        const response = await apiContext.delete(`/pokemon/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Pokemon not found!' });
    });
});

test.describe('Team Service API Tests', () => {
    let apiContext: APIRequestContext;
    let createdTeamId: number;

    test.beforeAll(async ({ playwright }) => {
        apiContext = await playwright.request.newContext({
            baseURL: BASE_URL,
            extraHTTPHeaders: {
                'Content-Type': 'application/json',
            },
        });
    });

    test.afterAll(async () => {
        await apiContext.dispose();
    });

    test('POST /teams/ - should create a new team', async () => {
        const response = await apiContext.post('/teams/', {
            data: { name: 'Team Rocket' },
        });
        expect(response.status()).toBe(201);
        const team = await response.json();
        expect(team.id).toBeDefined();
        expect(team.name).toBe('Team Rocket');
        createdTeamId = team.id; // Store for later tests or cleanup
    });

    test('POST /teams/ - should return 422 for invalid payload', async () => {
        const response = await apiContext.post('/teams/', {
            data: {}, // Missing 'name'
        });
        expect(response.status()).toBe(422); // Unprocessable Entity
        const error = await response.json();
        expect(error.detail).toBeDefined();
    });

    test('GET /teams/{id}/ - should retrieve a specific team', async () => {
        // Create a team first to retrieve it
        const createTeamResponse = await apiContext.post('/teams/', {
            data: { name: 'Valor' },
        });
        expect(createTeamResponse.status()).toBe(201);
        const newTeam = await createTeamResponse.json();
        const teamId = newTeam.id;

        const response = await apiContext.get(`/teams/${teamId}/`);
        expect(response.status()).toBe(200);
        const team = await response.json();
        expect(team.id).toBe(teamId);
        expect(team.name).toBe('Valor');

        // Clean up
        await apiContext.delete(`/teams/${teamId}/`);
    });

    test('GET /teams/{id}/ - should return 404 for a non-existent team', async () => {
        const nonExistentId = 99999;
        const response = await apiContext.get(`/teams/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('GET /teams/ - should retrieve all teams', async () => {
        // Create two teams to ensure list is not empty
        const team1 = await apiContext.post('/teams/', {
            data: { name: 'Mystic' },
        });
        expect(team1.status()).toBe(201);
        const team1Id = (await team1.json()).id;

        const team2 = await apiContext.post('/teams/', {
            data: { name: 'Instinct' },
        });
        expect(team2.status()).toBe(201);
        const team2Id = (await team2.json()).id;

        const response = await apiContext.get('/teams/');
        expect(response.status()).toBe(200);
        const teamList = await response.json();
        expect(Array.isArray(teamList)).toBeTruthy();
        expect(teamList.length).toBeGreaterThanOrEqual(2);
        expect(teamList.some((t: any) => t.id === team1Id && t.name === 'Mystic')).toBeTruthy();
        expect(teamList.some((t: any) => t.id === team2Id && t.name === 'Instinct')).toBeTruthy();

        // Clean up
        await apiContext.delete(`/teams/${team1Id}/`);
        await apiContext.delete(`/teams/${team2Id}/`);
    });

    test('PUT /teams/{id}/ - should update an existing team', async () => {
        // Create a team first
        const createResponse = await apiContext.post('/teams/', {
            data: { name: 'Old Team Name' },
        });
        const oldTeam = await createResponse.json();
        const teamIdToUpdate = oldTeam.id;

        const updateResponse = await apiContext.put(`/teams/${teamIdToUpdate}/`, {
            data: { name: 'New Team Name' },
        });
        expect(updateResponse.status()).toBe(200);
        const updatedTeam = await updateResponse.json();
        expect(updatedTeam.id).toBe(teamIdToUpdate);
        expect(updatedTeam.name).toBe('New Team Name');

        // Clean up
        await apiContext.delete(`/teams/${teamIdToUpdate}/`);
    });

    test('PUT /teams/{id}/ - should return 404 for updating a non-existent team', async () => {
        const nonExistentId = 99999;
        const response = await apiContext.put(`/teams/${nonExistentId}/`, {
            data: { name: 'Non Existent Team' },
        });
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });

    test('PUT /teams/{id}/ - should return 422 for invalid payload during update', async () => {
        // Create a team first
        const createResponse = await apiContext.post('/teams/', {
            data: { name: 'Incomplete Team' },
        });
        const incompleteTeam = await createResponse.json();
        const teamIdToUpdate = incompleteTeam.id;

        const response = await apiContext.put(`/teams/${teamIdToUpdate}/`, {
            data: {}, // Missing 'name'
        });
        expect(response.status()).toBe(422); // Unprocessable Entity
        const error = await response.json();
        expect(error.detail).toBeDefined();

        // Clean up
        await apiContext.delete(`/teams/${teamIdToUpdate}/`);
    });

    test('DELETE /teams/{id}/ - should delete an existing team', async () => {
        // Create a team first to delete it
        const createResponse = await apiContext.post('/teams/', {
            data: { name: 'Team To Be Deleted' },
        });
        const teamToDelete = await createResponse.json();
        const teamId = teamToDelete.id;

        const response = await apiContext.delete(`/teams/${teamId}/`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toBe(teamId);

        // Verify it's deleted
        const getResponse = await apiContext.get(`/teams/${teamId}/`);
        expect(getResponse.status()).toBe(404);
    });

    test('DELETE /teams/{id}/ - should return 404 for deleting a non-existent team', async () => {
        const nonExistentId = 99999;
        const response = await apiContext.delete(`/teams/${nonExistentId}/`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Team not found!' });
    });
});

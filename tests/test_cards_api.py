"""Testes de integração da API de cartas (HTTP + SQLite real)."""

from __future__ import annotations


class TestCreate:
    def test_cria_carta_de_monstro(self, client, monster_payload):
        response = client.post("/api/cards", json=monster_payload)

        assert response.status_code == 201
        card = response.json()
        assert card["id"]
        assert card["slug"].startswith("aurora-sentinela-do-veu")
        assert card["name"] == monster_payload["name"]
        assert card["kind"] == "monster"
        assert card["views"] == 0
        assert card["created_at"]

    def test_cria_magia_sem_estatisticas(self, client, spell_payload):
        response = client.post("/api/cards", json=spell_payload)

        assert response.status_code == 201
        card = response.json()
        assert card["spell_kind"] == "quick_play"
        assert card["atk"] is None
        assert card["defense"] is None
        assert card["level"] is None

    def test_payload_invalido_retorna_422(self, client, monster_payload):
        monster_payload.pop("attribute")
        response = client.post("/api/cards", json=monster_payload)

        assert response.status_code == 422
        assert response.json()["code"] == "validation_error"

    def test_limite_de_cartas_por_duelista(self, client, monster_payload, settings):
        for index in range(settings.max_cards_per_owner):
            payload = {**monster_payload, "name": f"Carta {index}"}
            assert client.post("/api/cards", json=payload).status_code == 201

        response = client.post("/api/cards", json={**monster_payload, "name": "Excedente"})
        assert response.status_code == 429
        assert response.json()["code"] == "limit_exceeded"


class TestRead:
    def test_lista_minhas_cartas(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.get("/api/cards/mine")

        assert response.status_code == 200
        body = response.json()
        assert body["limit"] == 50
        assert [item["id"] for item in body["items"]] == [created["id"]]

    def test_minhas_cartas_nao_vaza_para_outro_duelista(
        self, client, other_client, monster_payload
    ):
        client.post("/api/cards", json=monster_payload)

        response = other_client.get("/api/cards/mine")

        assert response.status_code == 200
        assert response.json()["items"] == []

    def test_busca_por_id(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.get(f"/api/cards/{created['id']}")

        assert response.status_code == 200
        assert response.json()["slug"] == created["slug"]

    def test_id_inexistente_retorna_404(self, client):
        response = client.get("/api/cards/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        assert response.json()["code"] == "not_found"

    def test_busca_por_slug(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.get(f"/api/cards/slug/{created['slug']}")

        assert response.status_code == 200
        assert response.json()["name"] == monster_payload["name"]

    def test_galeria_publica_ordena_e_pagina(self, client, monster_payload):
        for index in range(3):
            client.post("/api/cards", json={**monster_payload, "name": f"Carta {index}"})

        response = client.get("/api/cards?limit=2")

        assert response.status_code == 200
        assert len(response.json()["items"]) == 2

    def test_galeria_filtra_por_busca(self, client, monster_payload):
        client.post("/api/cards", json=monster_payload)
        client.post(
            "/api/cards",
            json={**monster_payload, "name": "Buraco Negro", "archetype": "Escuridão"},
        )

        response = client.get("/api/cards?q=buraco")

        assert [item["name"] for item in response.json()["items"]] == ["Buraco Negro"]

    def test_carta_privada_nao_aparece_na_galeria(self, client, monster_payload):
        client.post("/api/cards", json={**monster_payload, "is_public": False})

        response = client.get("/api/cards")

        assert response.json()["items"] == []


class TestUpdateAndDelete:
    def test_atualiza_campos(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.patch(
            f"/api/cards/{created['id']}",
            json={"name": "Aurora Renascida", "level": 9, "atk": 3000},
        )

        assert response.status_code == 200
        card = response.json()
        assert card["name"] == "Aurora Renascida"
        assert card["level"] == 9
        assert card["atk"] == 3000
        assert card["updated_at"] >= card["created_at"]

    def test_atualizacao_invalida_retorna_422(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.patch(f"/api/cards/{created['id']}", json={"level": 13})

        assert response.status_code == 422
        assert response.json()["code"] == "invalid_payload"

    def test_outro_duelista_nao_pode_editar(self, client, other_client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = other_client.patch(f"/api/cards/{created['id']}", json={"name": "invadida"})

        assert response.status_code == 403
        assert response.json()["code"] == "forbidden"

    def test_remove_carta(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.delete(f"/api/cards/{created['id']}")

        assert response.status_code == 204
        assert client.get(f"/api/cards/{created['id']}").status_code == 404

    def test_outro_duelista_nao_pode_remover(self, client, other_client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = other_client.delete(f"/api/cards/{created['id']}")

        assert response.status_code == 403
        assert client.get(f"/api/cards/{created['id']}").status_code == 200

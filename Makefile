dev: 
	docker compose -f compose.yaml --env-file ./.env up --build
prod:
	docker compose -f compose.yaml --env-file ./.env up -d --build
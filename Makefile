dev: 
	docker compose -f compose.yaml --env-file ./.env up --build
prod:
	docker compose -f compose.yaml --env-file ./.env up -d --build
front:
	docker compose -f compose.yaml --env-file ./.env up -d --build frontend
kafka-ui:
	docker compose -f compose.yaml --env-file ./.env --profile debug up -d kafka-ui